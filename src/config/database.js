/**
 * Database Configuration and Connection Management
 * Gestisce la configurazione e connessione al database MySQL
 */
import mysql from 'mysql2';
import { logger } from '../utils/logger.js';

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.config = {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    };
  }

  /**
   * Inizializza la connessione al database
   */
  async initialize() {
    try {
      this.connection = mysql.createConnection(this.config);
      await this.connectWithRetry();
      logger.info('Database connection initialized successfully');
      return this.connection;
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Connessione con retry automatico
   */
  async connectWithRetry(maxRetries = 5, delay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          this.connection.connect((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        
        logger.info('MySQL connected successfully');
        return;
      } catch (error) {
        logger.warn(`Database connection attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  /**
   * Ottieni l'istanza della connessione
   */
  getConnection() {
    if (!this.connection) {
      throw new Error('Database connection not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  /**
   * Ottieni la promise API della connessione
   */
  getPromiseConnection() {
    return this.getConnection().promise();
  }

  /**
   * Esegui una query con logging automatico
   */
  async executeQuery(query, params = []) {
    const startTime = Date.now();
    try {
      const [result] = await this.getPromiseConnection().execute(query, params);
      const duration = Date.now() - startTime;
      
      logger.debug('Query executed successfully', {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        params: params.length > 0 ? '[PARAMS]' : 'none',
        duration: `${duration}ms`
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution failed', {
        query,
        params,
        duration: `${duration}ms`,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Chiudi la connessione
   */
  async close() {
    if (this.connection) {
      await new Promise((resolve) => {
        this.connection.end(() => {
          logger.info('Database connection closed');
          resolve();
        });
      });
      this.connection = null;
    }
  }

  /**
   * Health check del database
   */
  async healthCheck() {
    try {
      await this.executeQuery('SELECT 1');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        status: 'unhealthy', 
        error: error.message,
        timestamp: new Date().toISOString() 
      };
    }
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

export { dbManager };
export default dbManager;