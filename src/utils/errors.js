/**
 * Custom Error Classes
 * Classi per la gestione degli errori personalizzati
 */
import { logger } from './logger.js';

/**
 * Base API Error Class
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      ...(this.details && { details: this.details })
    };
  }
}

/**
 * Validation Error
 */
export class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication Error
 */
export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR');
  }
}

/**
 * Authorization Error
 */
export class AuthorizationError extends ApiError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict Error
 */
export class ConflictError extends ApiError {
  constructor(message, details = null) {
    super(message, 409, 'CONFLICT_ERROR', details);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends ApiError {
  constructor(message, originalError = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.originalError = originalError;
  }
}

/**
 * Printer Error
 */
export class PrinterError extends ApiError {
  constructor(message, details = null) {
    super(message, 500, 'PRINTER_ERROR', details);
  }
}

/**
 * File Upload Error
 */
export class FileUploadError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, 'FILE_UPLOAD_ERROR', details);
  }
}

/**
 * Rate Limit Error
 */
export class RateLimitError extends ApiError {
  constructor(retryAfter = 60) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

/**
 * Error Handler Function
 */
export function handleError(error, req, res, next) {
  // Log the error using the shared logger instance
  if (error.isOperational) {
    logger.warn('Operational error occurred', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      user: req.user?.username,
      ip: req.ip
    });
  } else {
    logger.error('Unexpected error occurred', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      user: req.user?.username,
      ip: req.ip
    });
  }

  // Handle specific error types
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Handle MySQL errors
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Duplicate entry',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (error.code === 'ER_NO_SUCH_TABLE') {
    return res.status(500).json({
      error: 'Database table not found',
      code: 'TABLE_NOT_FOUND'
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message,
      code: 'VALIDATION_ERROR',
      details: error.details
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;

  res.status(statusCode).json({
    error: message,
    code: 'UNKNOWN_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

/**
 * Async Error Handler Wrapper
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create Error Response
 */
export function createErrorResponse(message, statusCode = 500, code = 'ERROR') {
  return {
    error: message,
    code,
    statusCode,
    timestamp: new Date().toISOString()
  };
}
