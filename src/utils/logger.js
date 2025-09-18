/**
 * Advanced Logging System
 * Sistema di logging avanzato per l'applicazione
 */

class Logger {
  constructor() {
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };
    
    this.currentLevel = this.levels[process.env.LOG_LEVEL] ?? this.levels.info;
    this.colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[35m',
      trace: '\x1b[37m',
      reset: '\x1b[0m'
    };
  }

  /**
   * Format log message
   */
  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    
    const logData = {
      timestamp,
      level,
      pid,
      message,
      ...meta
    };

    if (process.env.NODE_ENV === 'development') {
      // Console format for development
      const color = this.colors[level] || this.colors.reset;
      return `${color}[${timestamp}] ${level.toUpperCase()} [PID:${pid}]: ${message}${this.colors.reset}${
        Object.keys(meta).length > 0 ? `\n  ${JSON.stringify(meta, null, 2)}` : ''
      }`;
    } else {
      // JSON format for production
      return JSON.stringify(logData);
    }
  }

  /**
   * Write log message
   */
  write(level, message, meta = {}) {
    if (this.levels[level] > this.currentLevel) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output
    if (level === 'error') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // File output (in production)
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement file logging if needed
      // This could be done with fs.appendFile or a dedicated logging library
    }
  }

  /**
   * Error logging
   */
  error(message, meta = {}) {
    // If meta is an Error object, extract its properties
    if (meta instanceof Error) {
      meta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
        ...meta
      };
    }
    
    this.write('error', message, meta);
  }

  /**
   * Warning logging
   */
  warn(message, meta = {}) {
    this.write('warn', message, meta);
  }

  /**
   * Info logging
   */
  info(message, meta = {}) {
    this.write('info', message, meta);
  }

  /**
   * Debug logging
   */
  debug(message, meta = {}) {
    this.write('debug', message, meta);
  }

  /**
   * Trace logging
   */
  trace(message, meta = {}) {
    this.write('trace', message, meta);
  }

  /**
   * HTTP Request logging
   */
  request(req, res, duration) {
    const logData = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0
    };

    if (req.user) {
      logData.user = {
        username: req.user.username,
        role: req.user.role
      };
    }

    const level = res.statusCode >= 400 ? 'warn' : 'info';
    this.write(level, `${req.method} ${req.url}`, logData);
  }

  /**
   * Database query logging
   */
  query(query, params, duration, error = null) {
    const logData = {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      params: params?.length > 0 ? '[PARAMS]' : 'none',
      duration: `${duration}ms`
    };

    if (error) {
      logData.error = error.message;
      this.write('error', 'Database query failed', logData);
    } else {
      this.write('debug', 'Database query executed', logData);
    }
  }

  /**
   * Authentication logging
   */
  auth(action, username, success = true, details = {}) {
    const logData = {
      action,
      username,
      success,
      ip: details.ip,
      userAgent: details.userAgent,
      ...details
    };

    const level = success ? 'info' : 'warn';
    this.write(level, `Authentication ${action}: ${username}`, logData);
  }

  /**
   * Print operation logging
   */
  print(operation, data, success = true, error = null) {
    const logData = {
      operation,
      labelType: data.label_type,
      labelData: data.label_data?.substring(0, 50) + (data.label_data?.length > 50 ? '...' : ''),
      command: data.cmd?.substring(0, 100) + (data.cmd?.length > 100 ? '...' : ''),
      success
    };

    if (error) {
      logData.error = error.message;
    }

    const level = success ? 'info' : 'error';
    this.write(level, `Print ${operation}`, logData);
  }

  /**
   * Application lifecycle logging
   */
  lifecycle(event, details = {}) {
    this.write('info', `Application ${event}`, details);
  }

  /**
   * Performance logging
   */
  performance(operation, duration, details = {}) {
    const logData = {
      operation,
      duration: `${duration}ms`,
      ...details
    };

    const level = duration > 5000 ? 'warn' : 'debug'; // Warn if operation takes more than 5s
    this.write(level, `Performance: ${operation}`, logData);
  }

  /**
   * Security logging
   */
  security(event, details = {}) {
    const logData = {
      event,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.write('warn', `Security event: ${event}`, logData);
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;