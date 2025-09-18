/**
 * Authentication and Authorization Middleware
 * Middleware per autenticazione e autorizzazione
 */
import jwt from 'jsonwebtoken';
import { config } from '../config/app.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/errors.js';

/**
 * JWT Token Authentication Middleware
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.security('Missing authentication token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    
    logger.debug('Token authenticated successfully', {
      username: decoded.username,
      role: decoded.role,
      endpoint: req.path
    });
    
    next();
  } catch (error) {
    logger.security('Invalid authentication token', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      error: error.message
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(403).json({
      error: 'Token verification failed',
      code: 'TOKEN_VERIFICATION_FAILED'
    });
  }
};

/**
 * Admin Role Requirement Middleware
 */
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    logger.security('Unauthorized admin access attempt', {
      username: req.user.username,
      role: req.user.role,
      endpoint: req.path,
      ip: req.ip
    });

    return res.status(403).json({
      error: 'Administrator privileges required',
      code: 'ADMIN_REQUIRED'
    });
  }

  logger.debug('Admin access granted', {
    username: req.user.username,
    endpoint: req.path
  });

  next();
};

/**
 * User Role Requirement Middleware (user or admin)
 */
export const requireUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!['user', 'admin'].includes(req.user.role)) {
    logger.security('Invalid user role', {
      username: req.user.username,
      role: req.user.role,
      endpoint: req.path,
      ip: req.ip
    });

    return res.status(403).json({
      error: 'Valid user role required',
      code: 'INVALID_ROLE'
    });
  }

  next();
};

/**
 * Optional Authentication Middleware
 * Autentica se presente, ma non richiede token
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    logger.debug('Optional auth successful', { username: decoded.username });
  } catch (error) {
    logger.debug('Optional auth failed, continuing without auth', { error: error.message });
  }

  next();
};

/**
 * Rate Limiting Middleware (basic implementation)
 */
const requestCounts = new Map();

export const rateLimit = (options = {}) => {
  const {
    windowMs = config.api.rateLimit.windowMs,
    maxRequests = config.api.rateLimit.maxRequests,
    message = 'Too many requests, please try again later'
  } = options;

  return (req, res, next) => {
    const identifier = req.ip + (req.user?.username || 'anonymous');
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.resetTime > windowMs) {
        requestCounts.delete(key);
      }
    }

    const requestData = requestCounts.get(identifier) || {
      count: 0,
      resetTime: now
    };

    if (now - requestData.resetTime > windowMs) {
      requestData.count = 0;
      requestData.resetTime = now;
    }

    requestData.count++;
    requestCounts.set(identifier, requestData);

    if (requestData.count > maxRequests) {
      logger.security('Rate limit exceeded', {
        identifier,
        count: requestData.count,
        limit: maxRequests,
        endpoint: req.path
      });

      return res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((windowMs - (now - requestData.resetTime)) / 1000)
      });
    }

    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - requestData.count),
      'X-RateLimit-Reset': new Date(requestData.resetTime + windowMs)
    });

    next();
  };
};

/**
 * Resource Ownership Middleware
 * Verifica che l'utente sia proprietario della risorsa o admin
 */
export const requireOwnership = (resourceUserField = 'username') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check ownership in request body, params, or query
    const resourceUser = req.body[resourceUserField] || 
                        req.params[resourceUserField] || 
                        req.query[resourceUserField];

    if (!resourceUser) {
      return res.status(400).json({
        error: 'Resource owner information missing',
        code: 'MISSING_OWNER_INFO'
      });
    }

    if (resourceUser !== req.user.username) {
      logger.security('Unauthorized resource access attempt', {
        username: req.user.username,
        requestedResource: resourceUser,
        endpoint: req.path
      });

      return res.status(403).json({
        error: 'Access denied. Resource ownership required',
        code: 'OWNERSHIP_REQUIRED'
      });
    }

    next();
  };
};