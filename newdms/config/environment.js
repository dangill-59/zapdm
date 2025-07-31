// newdms/config/environment.js
// Environment configuration and validation

require('dotenv').config();
const path = require('path');
const { ENV_DEFAULTS } = require('./constants');

/**
 * Get environment variable with default fallback
 */
function getEnvVar(name, defaultValue, type = 'string') {
    const value = process.env[name] || defaultValue;
    
    switch (type) {
        case 'number':
            return parseInt(value, 10);
        case 'boolean':
            return value === 'true' || value === true;
        case 'array':
            return typeof value === 'string' ? value.split(',').map(s => s.trim()) : value;
        default:
            return value;
    }
}

/**
 * Validate required environment variables
 */
function validateEnvironment() {
    const errors = [];
    
    // Check for required production variables
    if (NODE_ENV === 'production') {
        if (JWT_SECRET === ENV_DEFAULTS.JWT_SECRET) {
            errors.push('JWT_SECRET must be changed in production');
        }
        
        if (JWT_SECRET.length < 32) {
            errors.push('JWT_SECRET must be at least 32 characters long');
        }
        
        if (!DB_PATH || DB_PATH === ENV_DEFAULTS.DB_PATH) {
            console.warn('Warning: Using default database path in production');
        }
    }
    
    // Validate port range
    if (PORT < 1 || PORT > 65535) {
        errors.push('PORT must be between 1 and 65535');
    }
    
    // Validate bcrypt rounds
    if (BCRYPT_ROUNDS < 8 || BCRYPT_ROUNDS > 15) {
        errors.push('BCRYPT_ROUNDS must be between 8 and 15');
    }
    
    // Validate file size
    if (MAX_FILE_SIZE < 1024 * 1024) {  // 1MB minimum
        errors.push('MAX_FILE_SIZE must be at least 1MB');
    }
    
    if (errors.length > 0) {
        console.error('Environment validation errors:');
        errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
    }
}

// Core Environment Variables
const NODE_ENV = getEnvVar('NODE_ENV', ENV_DEFAULTS.NODE_ENV);
const PORT = getEnvVar('PORT', ENV_DEFAULTS.PORT, 'number');

// Database Configuration
const DB_PATH = getEnvVar('DB_PATH', ENV_DEFAULTS.DB_PATH);
const DB_LOGGING = getEnvVar('DB_LOGGING', NODE_ENV !== 'production', 'boolean');

// Directory Paths
const UPLOAD_DIR = path.resolve(getEnvVar('UPLOAD_DIR', ENV_DEFAULTS.UPLOAD_DIR));
const IMAGE_DIR = path.resolve(getEnvVar('IMAGE_DIR', ENV_DEFAULTS.IMAGE_DIR));
const THUMBNAIL_DIR = path.resolve(getEnvVar('THUMBNAIL_DIR', ENV_DEFAULTS.THUMBNAIL_DIR));
const DATA_DIR = path.resolve(getEnvVar('DATA_DIR', './data'));
const LOG_DIR = path.resolve(getEnvVar('LOG_DIR', './logs'));

// Security Configuration
const JWT_SECRET = getEnvVar('JWT_SECRET', ENV_DEFAULTS.JWT_SECRET);
const BCRYPT_ROUNDS = getEnvVar('BCRYPT_ROUNDS', ENV_DEFAULTS.BCRYPT_ROUNDS, 'number');
const SESSION_TIMEOUT = getEnvVar('SESSION_TIMEOUT', ENV_DEFAULTS.SESSION_TIMEOUT, 'number');

// File Upload Configuration
const MAX_FILE_SIZE = getEnvVar('MAX_FILE_SIZE', ENV_DEFAULTS.MAX_FILE_SIZE, 'number');
const ALLOWED_ORIGINS = getEnvVar('ALLOWED_ORIGINS', ENV_DEFAULTS.CORS_ORIGIN, 'array');

// CORS Configuration
const ENABLE_CORS = getEnvVar('ENABLE_CORS', ENV_DEFAULTS.ENABLE_CORS, 'boolean');
const CORS_ORIGIN = getEnvVar('CORS_ORIGIN', ENV_DEFAULTS.CORS_ORIGIN);

// Logging Configuration
const LOG_LEVEL = getEnvVar('LOG_LEVEL', ENV_DEFAULTS.LOG_LEVEL);
const ENABLE_REQUEST_LOGGING = getEnvVar('ENABLE_REQUEST_LOGGING', NODE_ENV !== 'test', 'boolean');
const ENABLE_ERROR_LOGGING = getEnvVar('ENABLE_ERROR_LOGGING', true, 'boolean');

// OCR Configuration
const OCR_DEFAULT_LANGUAGE = getEnvVar('OCR_DEFAULT_LANGUAGE', 'eng');
const OCR_TIMEOUT = getEnvVar('OCR_TIMEOUT', 60000, 'number'); // 60 seconds
const ENABLE_OCR = getEnvVar('ENABLE_OCR', true, 'boolean');

// Performance Configuration
const ENABLE_GZIP = getEnvVar('ENABLE_GZIP', true, 'boolean');
const CACHE_MAX_AGE = getEnvVar('CACHE_MAX_AGE', 86400, 'number'); // 24 hours
const REQUEST_TIMEOUT = getEnvVar('REQUEST_TIMEOUT', 30000, 'number'); // 30 seconds

// Feature Flags
const ENABLE_AUDIT_LOGGING = getEnvVar('ENABLE_AUDIT_LOGGING', true, 'boolean');
const ENABLE_RATE_LIMITING = getEnvVar('ENABLE_RATE_LIMITING', true, 'boolean');
const ENABLE_SEARCH_INDEXING = getEnvVar('ENABLE_SEARCH_INDEXING', true, 'boolean');
const ENABLE_THUMBNAILS = getEnvVar('ENABLE_THUMBNAILS', true, 'boolean');

// External Services
const SMTP_HOST = getEnvVar('SMTP_HOST', '');
const SMTP_PORT = getEnvVar('SMTP_PORT', 587, 'number');
const SMTP_USER = getEnvVar('SMTP_USER', '');
const SMTP_PASS = getEnvVar('SMTP_PASS', '');
const SMTP_SECURE = getEnvVar('SMTP_SECURE', false, 'boolean');

// Monitoring and Health
const HEALTH_CHECK_ENABLED = getEnvVar('HEALTH_CHECK_ENABLED', true, 'boolean');
const METRICS_ENABLED = getEnvVar('METRICS_ENABLED', NODE_ENV === 'production', 'boolean');

// Development Configuration
const HOT_RELOAD = getEnvVar('HOT_RELOAD', NODE_ENV === 'development', 'boolean');
const DEBUG_MODE = getEnvVar('DEBUG_MODE', NODE_ENV === 'development', 'boolean');
const VERBOSE_LOGGING = getEnvVar('VERBOSE_LOGGING', NODE_ENV === 'development', 'boolean');

// Admin Configuration
const ADMIN_EMAIL = getEnvVar('ADMIN_EMAIL', 'admin@localhost');
const ENABLE_ADMIN_PANEL = getEnvVar('ENABLE_ADMIN_PANEL', true, 'boolean');
const ADMIN_IP_WHITELIST = getEnvVar('ADMIN_IP_WHITELIST', '', 'array').filter(ip => ip.length > 0);

// Backup Configuration
const BACKUP_ENABLED = getEnvVar('BACKUP_ENABLED', false, 'boolean');
const BACKUP_INTERVAL = getEnvVar('BACKUP_INTERVAL', 24, 'number'); // hours
const BACKUP_RETENTION = getEnvVar('BACKUP_RETENTION', 7, 'number'); // days
const BACKUP_DIR = path.resolve(getEnvVar('BACKUP_DIR', './backups'));

// API Configuration
const API_VERSION = getEnvVar('API_VERSION', 'v1');
const API_PREFIX = getEnvVar('API_PREFIX', '/api');
const API_DOCS_ENABLED = getEnvVar('API_DOCS_ENABLED', NODE_ENV !== 'production', 'boolean');

// Database Connection String (if using external database)
const DATABASE_URL = getEnvVar('DATABASE_URL', '');

// Redis Configuration (for future caching)
const REDIS_URL = getEnvVar('REDIS_URL', '');
const REDIS_ENABLED = getEnvVar('REDIS_ENABLED', false, 'boolean');

// Validate environment on load
validateEnvironment();

// Log configuration in development
if (NODE_ENV === 'development' && VERBOSE_LOGGING) {
    console.log('🔧 Environment Configuration:');
    console.log(`  NODE_ENV: ${NODE_ENV}`);
    console.log(`  PORT: ${PORT}`);
    console.log(`  DB_PATH: ${DB_PATH}`);
    console.log(`  UPLOAD_DIR: ${UPLOAD_DIR}`);
    console.log(`  IMAGE_DIR: ${IMAGE_DIR}`);
    console.log(`  MAX_FILE_SIZE: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
    console.log(`  JWT_SECRET: ${JWT_SECRET.slice(0, 8)}...`);
    console.log(`  BCRYPT_ROUNDS: ${BCRYPT_ROUNDS}`);
    console.log(`  ENABLE_OCR: ${ENABLE_OCR}`);
    console.log(`  ENABLE_CORS: ${ENABLE_CORS}`);
    console.log(`  CORS_ORIGIN: ${CORS_ORIGIN}`);
    console.log(`  LOG_LEVEL: ${LOG_LEVEL}`);
}

// Export all configuration
module.exports = {
    // Core
    NODE_ENV,
    PORT,
    
    // Database
    DB_PATH,
    DB_LOGGING,
    DATABASE_URL,
    
    // Directories
    UPLOAD_DIR,
    IMAGE_DIR,
    THUMBNAIL_DIR,
    DATA_DIR,
    LOG_DIR,
    BACKUP_DIR,
    
    // Security
    JWT_SECRET,
    BCRYPT_ROUNDS,
    SESSION_TIMEOUT,
    
    // File Upload
    MAX_FILE_SIZE,
    ALLOWED_ORIGINS,
    
    // CORS
    ENABLE_CORS,
    CORS_ORIGIN,
    
    // Logging
    LOG_LEVEL,
    ENABLE_REQUEST_LOGGING,
    ENABLE_ERROR_LOGGING,
    VERBOSE_LOGGING,
    
    // OCR
    OCR_DEFAULT_LANGUAGE,
    OCR_TIMEOUT,
    ENABLE_OCR,
    
    // Performance
    ENABLE_GZIP,
    CACHE_MAX_AGE,
    REQUEST_TIMEOUT,
    
    // Features
    ENABLE_AUDIT_LOGGING,
    ENABLE_RATE_LIMITING,
    ENABLE_SEARCH_INDEXING,
    ENABLE_THUMBNAILS,
    
    // External Services
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    
    // Monitoring
    HEALTH_CHECK_ENABLED,
    METRICS_ENABLED,
    
    // Development
    HOT_RELOAD,
    DEBUG_MODE,
    
    // Admin
    ADMIN_EMAIL,
    ENABLE_ADMIN_PANEL,
    ADMIN_IP_WHITELIST,
    
    // Backup
    BACKUP_ENABLED,
    BACKUP_INTERVAL,
    BACKUP_RETENTION,
    
    // API
    API_VERSION,
    API_PREFIX,
    API_DOCS_ENABLED,
    
    // Redis
    REDIS_URL,
    REDIS_ENABLED,
    
    // Utility function
    getEnvVar,
    validateEnvironment
};