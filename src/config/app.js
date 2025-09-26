/**
 * Application Configuration
 * Configurazione generale dell'applicazione
 */

export const config = {
  // Server Configuration
  server: {
    port: process.env.PORT || 800,
    env: process.env.NODE_ENV || 'development',
    host: process.env.HOST || 'localhost'
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stampante',
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000
  },

  // JWT Configuration
  jwt: {
    secret: process.env.TOKEN_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: 'HS256'
  },

  // Bcrypt Configuration
  security: {
    saltRounds: parseInt(process.env.SALT_ROUNDS) || 10,
    maxLoginAttempts: 5,
    lockTime: 30 * 60 * 1000 // 30 minutes
  },

  // Printer Configuration
  printer: {
    host: process.env.TN_HOST || '10.2.12.244',
    port: parseInt(process.env.TN_PORT) || 100,
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 2000
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedFileTypes: ['.svg'],
    uploadDir: process.env.UPLOAD_DIR || './uploads'
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    enableConsole: true,
    enableFile: process.env.NODE_ENV === 'production',
    filePath: './logs/app.log',
    maxFiles: 7,
    maxSize: '10m'
  },

  // API Configuration
  api: {
    defaultPageSize: 20,
    maxPageSize: 100,
    requestTimeout: 30000,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      standardHeaders: true,
      legacyHeaders: false
    }
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Static Files Configuration
  static: {
    maxAge: '1d',
    etag: true,
    lastModified: true
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET || 'session-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  },

  // Application Metadata
  app: {
    name: 'Gestione Stampante',
    version: '1.0.0',
    description: 'Sistema di gestione stampante per etichette',
    author: 'CBL',
    license: 'ISC'
  }
};

/**
 * Validate configuration
 */
export function validateConfig() {
  const required = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'TOKEN_SECRET',
    'TN_HOST'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate printer configuration
  if (!config.printer.host || !config.printer.port) {
    console.warn('Printer configuration is incomplete. Printing functionality may not work.');
  }

  // Validate JWT secret in production
  if (config.server.env === 'production' && config.jwt.secret === 'your-secret-key') {
    throw new Error('JWT secret must be changed in production environment');
  }

  console.log(`Configuration validated for ${config.server.env} environment`);
}

/**
 * Get configuration by path
 */
export function getConfig(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], config);
}

export default config;