/**
 * Authentication Service
 * Servizio per la gestione dell'autenticazione
 */
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { config } from '../config/app.js';
import { dbManager } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { 
  AuthenticationError, 
  ValidationError, 
  DatabaseError, 
  ConflictError 
} from '../utils/errors.js';

class AuthService {
  constructor() {
    this.tokenSecret = config.jwt.secret;
    this.tokenExpiration = config.jwt.expiresIn;
    this.saltRounds = config.security.saltRounds;
  }

  /**
   * Autentica un utente
   */
  async authenticateUser(username, password) {
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    try {
      // Cerca utente nel database
      const user = await this.findUserByUsername(username);
      
      if (!user) {
        logger.auth('login_failed', username, false, { reason: 'user_not_found' });
        throw new AuthenticationError('Invalid username or password');
      }

      // Verifica password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        logger.auth('login_failed', username, false, { reason: 'invalid_password' });
        throw new AuthenticationError('Invalid username or password');
      }

      // Aggiorna ultimo login
      await this.updateLastLogin(username);

      logger.auth('login_success', username, true, { role: user.role });

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        created_at: user.created_at,
        last_login: new Date()
      };

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      logger.error('Authentication service error', error);
      throw new DatabaseError('Authentication failed due to system error');
    }
  }

  /**
   * Genera JWT token
   */
  generateToken(user) {
    const payload = {
      username: user.username,
      role: user.role,
      id: user.id,
      iat: Math.floor(Date.now() / 1000)
    };

    try {
      const token = jwt.sign(payload, this.tokenSecret, {
        expiresIn: this.tokenExpiration,
        algorithm: config.jwt.algorithm || 'HS256'
      });

      logger.auth('token_generated', user.username, true);
      return token;

    } catch (error) {
      logger.error('Token generation failed', error);
      throw new Error('Failed to generate authentication token');
    }
  }

  /**
   * Verifica JWT token
   */
  async verifyToken(token) {
    if (!token) {
      throw new AuthenticationError('Token is required');
    }

    try {
      const decoded = jwt.verify(token, this.tokenSecret);
      
      // Verifica che l'utente esista ancora
      const user = await this.findUserByUsername(decoded.username);
      if (!user) {
        throw new AuthenticationError('User no longer exists');
      }

      return {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        iat: decoded.iat,
        exp: decoded.exp
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Token has expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid token');
      }

      throw error;
    }
  }

  /**
   * Hash password
   */
  async hashPassword(password) {
    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      logger.error('Password hashing failed', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Crea nuovo utente
   */
  async createUser(userData) {
    const { username, password, role = 'user' } = userData;

    // Validazione
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    if (!['user', 'admin'].includes(role)) {
      throw new ValidationError('Role must be either "user" or "admin"');
    }

    if (username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters long');
    }

    try {
      // Verifica se l'utente esiste già
      const existingUser = await this.findUserByUsername(username);
      if (existingUser) {
        throw new ConflictError('Username already exists');
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Inserisci utente
      const result = await dbManager.executeQuery(
        'INSERT INTO USERS (username, password, role, created_at) VALUES (?, ?, ?, NOW())',
        [username, hashedPassword, role]
      );

      logger.auth('user_created', username, true, { 
        role, 
        id: result.insertId,
        createdBy: 'system' 
      });

      return {
        id: result.insertId,
        username,
        role,
        created_at: new Date()
      };

    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      
      logger.error('User creation failed', error);
      throw new DatabaseError('Failed to create user');
    }
  }

  /**
   * Aggiorna utente
   */
  async updateUser(userId, updateData, currentUser) {
    const { username, password, role } = updateData;

    // Validazione permessi
    if (currentUser.role !== 'admin' && currentUser.id !== parseInt(userId)) {
      throw new AuthenticationError('Insufficient permissions to update user');
    }

    try {
      // Verifica che l'utente esista
      const existingUser = await this.findUserById(userId);
      if (!existingUser) {
        throw new ValidationError('User not found');
      }

      // Costruisci query di aggiornamento
      const updates = [];
      const params = [];

      if (username && username !== existingUser.username) {
        // Verifica che il nuovo username non sia già in uso
        const duplicateUser = await this.findUserByUsername(username);
        if (duplicateUser && duplicateUser.id !== parseInt(userId)) {
          throw new ConflictError('Username already in use');
        }
        updates.push('username = ?');
        params.push(username);
      }

      if (password) {
        const hashedPassword = await this.hashPassword(password);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      if (role && ['user', 'admin'].includes(role) && role !== existingUser.role) {
        // Solo admin può cambiare i ruoli
        if (currentUser.role !== 'admin') {
          throw new AuthenticationError('Only administrators can change user roles');
        }
        updates.push('role = ?');
        params.push(role);
      }

      if (updates.length === 0) {
        return existingUser; // Nessun cambiamento
      }

      params.push(userId);
      const query = `UPDATE USERS SET ${updates.join(', ')} WHERE id = ?`;
      
      await dbManager.executeQuery(query, params);

      logger.auth('user_updated', existingUser.username, true, {
        updatedBy: currentUser.username,
        fields: updates.map(u => u.split(' = ?')[0])
      });

      // Ritorna utente aggiornato
      return await this.findUserById(userId);

    } catch (error) {
      if (error instanceof ValidationError || 
          error instanceof ConflictError || 
          error instanceof AuthenticationError) {
        throw error;
      }
      
      logger.error('User update failed', error);
      throw new DatabaseError('Failed to update user');
    }
  }

  /**
   * Elimina utente
   */
  async deleteUser(userId, currentUser) {
    // Solo admin può eliminare utenti
    if (currentUser.role !== 'admin') {
      throw new AuthenticationError('Only administrators can delete users');
    }

    // Non permettere auto-eliminazione
    if (currentUser.id === parseInt(userId)) {
      throw new ValidationError('Cannot delete your own account');
    }

    try {
      const user = await this.findUserById(userId);
      if (!user) {
        throw new ValidationError('User not found');
      }

      await dbManager.executeQuery('DELETE FROM USERS WHERE id = ?', [userId]);

      logger.auth('user_deleted', user.username, true, {
        deletedBy: currentUser.username,
        userId: parseInt(userId)
      });

      return { success: true, message: 'User deleted successfully' };

    } catch (error) {
      if (error instanceof ValidationError || error instanceof AuthenticationError) {
        throw error;
      }
      
      logger.error('User deletion failed', error);
      throw new DatabaseError('Failed to delete user');
    }
  }

  /**
   * Trova utente per username
   */
  async findUserByUsername(username) {
    try {
      const users = await dbManager.executeQuery(
        'SELECT * FROM USERS WHERE username = ? LIMIT 1',
        [username]
      );
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Database query failed in findUserByUsername', error);
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Trova utente per ID
   */
  async findUserById(userId) {
    try {
      const users = await dbManager.executeQuery(
        'SELECT * FROM USERS WHERE id = ? LIMIT 1',
        [userId]
      );
      
      return users.length > 0 ? users[0] : null;
    } catch (error) {
      logger.error('Database query failed in findUserById', error);
      throw new DatabaseError('Failed to find user');
    }
  }

  /**
   * Ottieni tutti gli utenti (solo admin)
   */
  async getAllUsers() {
    try {
      return await dbManager.executeQuery(
        'SELECT id, username, role, created_at, last_login FROM USERS ORDER BY created_at DESC'
      );
    } catch (error) {
      logger.error('Failed to fetch all users', error);
      throw new DatabaseError('Failed to fetch users');
    }
  }

  /**
   * Aggiorna ultimo login
   */
  async updateLastLogin(username) {
    try {
      await dbManager.executeQuery(
        'UPDATE USERS SET last_login = NOW() WHERE username = ?',
        [username]
      );
    } catch (error) {
      // Non bloccare il login per errori di aggiornamento timestamp
      logger.warn('Failed to update last login timestamp', { username, error: error.message });
    }
  }

  /**
   * Valida formato username
   */
  validateUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return usernameRegex.test(username);
  }

  /**
   * Valida forza password
   */
  validatePasswordStrength(password) {
    const minLength = 6;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return {
      isValid: password.length >= minLength,
      length: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
      score: [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length
    };
  }
}

// Singleton instance
const authService = new AuthService();

export { authService };
export default authService;