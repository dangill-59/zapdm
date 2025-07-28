// newdms/config/constants.js
// Application-wide constants

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500
};

// Entity Status
const STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    DELETED: 'deleted',
    DRAFT: 'draft',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// Audit Actions
const AUDIT_ACTIONS = {
    CREATE: 'create',
    READ: 'read',
    UPDATE: 'update',
    DELETE: 'delete',
    LOGIN: 'login',
    LOGOUT: 'logout',
    UPLOAD: 'upload',
    DOWNLOAD: 'download',
    OCR: 'ocr_process',
    SEARCH: 'search',
    EXPORT: 'export',
    IMPORT: 'import'
};

// User Permissions
const PERMISSIONS = {
    // User Management
    USER_CREATE: 'user_create',
    USER_EDIT: 'user_edit',
    USER_DELETE: 'user_delete',
    USER_VIEW: 'user_view',

    // Role Management
    ROLE_CREATE: 'role_create',
    ROLE_EDIT: 'role_edit',
    ROLE_DELETE: 'role_delete',
    ROLE_VIEW: 'role_view',

    // Project Management
    PROJECT_CREATE: 'project_create',
    PROJECT_EDIT: 'project_edit',
    PROJECT_DELETE: 'project_delete',
    PROJECT_VIEW: 'project_view',

    // Document Management
    DOCUMENT_CREATE: 'document_create',
    DOCUMENT_EDIT: 'document_edit',
    DOCUMENT_DELETE: 'document_delete',
    DOCUMENT_VIEW: 'document_view',

    // Document Operations
    DOCUMENT_UPLOAD: 'document_upload',
    DOCUMENT_DOWNLOAD: 'document_download',
    DOCUMENT_SCAN: 'document_scan',
    DOCUMENT_PRINT: 'document_print',
    DOCUMENT_EMAIL: 'document_email',
    DOCUMENT_ANNOTATE: 'document_annotate',
    DOCUMENT_OCR: 'document_ocr',

    // Page Operations
    PAGE_CREATE: 'page_create',
    PAGE_EDIT: 'page_edit',
    PAGE_DELETE: 'page_delete',
    PAGE_VIEW: 'page_view',
    PAGE_REORDER: 'page_reorder',

    // Search Operations
    SEARCH_BASIC: 'search_basic',
    SEARCH_ADVANCED: 'search_advanced',
    SEARCH_FULLTEXT: 'search_fulltext',

    // System Administration
    ADMIN_ACCESS: 'admin_access',
    SYSTEM_CONFIG: 'system_config',
    AUDIT_VIEW: 'audit_view',
    BACKUP_CREATE: 'backup_create',
    BACKUP_RESTORE: 'backup_restore',

    // Reporting
    REPORT_VIEW: 'report_view',
    REPORT_CREATE: 'report_create',
    REPORT_EXPORT: 'report_export'
};

// File Types
const FILE_TYPES = {
    PDF: 'application/pdf',
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    TIFF: 'image/tiff',
    GIF: 'image/gif',
    BMP: 'image/bmp'
};

// Allowed File Extensions
const ALLOWED_EXTENSIONS = [
    '.pdf',
    '.jpg', '.jpeg',
    '.png',
    '.tiff', '.tif',
    '.gif',
    '.bmp'
];

// Maximum File Sizes (in bytes)
const MAX_FILE_SIZES = {
    PDF: 50 * 1024 * 1024,      // 50MB for PDFs
    IMAGE: 10 * 1024 * 1024,    // 10MB for images
    DEFAULT: 25 * 1024 * 1024   // 25MB default
};

// OCR Languages
const OCR_LANGUAGES = {
    ENG: 'eng',
    SPA: 'spa',
    FRA: 'fra',
    DEU: 'deu',
    ITA: 'ita',
    POR: 'por',
    RUS: 'rus',
    CHI_SIM: 'chi_sim',
    CHI_TRA: 'chi_tra',
    JPN: 'jpn',
    KOR: 'kor',
    ARA: 'ara'
};

// Project Types
const PROJECT_TYPES = {
    CUSTOM: 'custom',
    FINANCE: 'finance',
    HR: 'hr',
    LEGAL: 'legal',
    OPERATIONS: 'operations',
    MARKETING: 'marketing',
    SALES: 'sales',
    IT: 'it',
    COMPLIANCE: 'compliance'
};

// Index Field Types
const FIELD_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    DATE: 'date',
    DROPDOWN: 'dropdown',
    CHECKBOX: 'checkbox',
    TEXTAREA: 'textarea',
    EMAIL: 'email',
    URL: 'url',
    PHONE: 'phone'
};

// Search Types
const SEARCH_TYPES = {
    BASIC: 'basic',
    ADVANCED: 'advanced',
    FULLTEXT: 'fulltext',
    FUZZY: 'fuzzy'
};

// Rate Limiting
const RATE_LIMITS = {
    AUTH: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 requests per windowMs
        message: 'Too many login attempts, please try again later.'
    },
    UPLOAD: {
        windowMs: 60 * 1000, // 1 minute
        max: 10, // limit each IP to 10 uploads per minute
        message: 'Upload rate limit exceeded, please wait.'
    },
    API: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Too many requests, please try again later.'
    },
    SEARCH: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // limit each IP to 100 searches per minute
        message: 'Search rate limit exceeded, please wait.'
    }
};

// JWT Configuration
const JWT_CONFIG = {
    EXPIRY: '24h',
    REFRESH_EXPIRY: '7d',
    ALGORITHM: 'HS256',
    ISSUER: 'dms-system',
    AUDIENCE: 'dms-users'
};

// Database Configuration
const DATABASE_CONFIG = {
    POOL: {
        MAX: 5,
        MIN: 0,
        ACQUIRE: 30000,
        IDLE: 10000
    },
    RETRY: {
        MATCH: [
            /SQLITE_BUSY/,
            /SQLITE_LOCKED/,
            /database is locked/
        ],
        MAX: 3
    }
};

// Pagination Defaults
const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    DEFAULT_SORT: 'createdAt',
    DEFAULT_ORDER: 'DESC'
};

// Validation Rules
const VALIDATION = {
    USERNAME: {
        MIN_LENGTH: 3,
        MAX_LENGTH: 50,
        PATTERN: /^[a-zA-Z0-9_-]+$/
    },
    PASSWORD: {
        MIN_LENGTH: 8,
        MAX_LENGTH: 128,
        REQUIRE_UPPERCASE: true,
        REQUIRE_LOWERCASE: true,
        REQUIRE_NUMBERS: true,
        REQUIRE_SYMBOLS: false
    },
    EMAIL: {
        MAX_LENGTH: 255,
        PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    PROJECT_NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 100
    },
    DOCUMENT_TITLE: {
        MIN_LENGTH: 1,
        MAX_LENGTH: 255
    },
    ROLE_NAME: {
        MIN_LENGTH: 2,
        MAX_LENGTH: 50
    }
};

// Error Messages
const ERROR_MESSAGES = {
    // Authentication
    INVALID_CREDENTIALS: 'Invalid username or password',
    TOKEN_EXPIRED: 'Authentication token has expired',
    TOKEN_INVALID: 'Invalid authentication token',
    ACCESS_DENIED: 'Access denied - insufficient permissions',
    ACCOUNT_LOCKED: 'Account has been locked due to multiple failed login attempts',

    // Validation
    REQUIRED_FIELD: 'This field is required',
    INVALID_FORMAT: 'Invalid format',
    PASSWORD_TOO_WEAK: 'Password does not meet security requirements',
    EMAIL_EXISTS: 'Email address is already registered',
    USERNAME_EXISTS: 'Username is already taken',

    // File Upload
    FILE_TOO_LARGE: 'File size exceeds maximum allowed limit',
    INVALID_FILE_TYPE: 'File type is not supported',
    UPLOAD_FAILED: 'File upload failed',
    NO_FILE_PROVIDED: 'No file was provided',

    // OCR
    OCR_FAILED: 'OCR processing failed',
    OCR_LANGUAGE_NOT_SUPPORTED: 'OCR language not supported',
    OCR_NO_TEXT_FOUND: 'No text found in document',

    // Database
    RECORD_NOT_FOUND: 'Record not found',
    DUPLICATE_ENTRY: 'Duplicate entry',
    FOREIGN_KEY_CONSTRAINT: 'Related records exist - cannot delete',
    DATABASE_ERROR: 'Database operation failed',

    // General
    INTERNAL_ERROR: 'An internal error occurred',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    INVALID_REQUEST: 'Invalid request format',
    RATE_LIMIT_EXCEEDED: 'Rate limit exceeded - too many requests'
};

// Success Messages
const SUCCESS_MESSAGES = {
    CREATED: 'Successfully created',
    UPDATED: 'Successfully updated',
    DELETED: 'Successfully deleted',
    UPLOADED: 'Successfully uploaded',
    PROCESSED: 'Successfully processed',
    SENT: 'Successfully sent',
    LOGGED_IN: 'Successfully logged in',
    LOGGED_OUT: 'Successfully logged out'
};

// Environment Variables with Defaults
const ENV_DEFAULTS = {
    NODE_ENV: 'development',
    PORT: 3000,
    DB_PATH: './data/database.sqlite',
    UPLOAD_DIR: './uploads',
    IMAGE_DIR: './uploads/images',
    THUMBNAIL_DIR: './uploads/thumbnails',
    JWT_SECRET: 'your-super-secret-jwt-key-change-in-production',
    BCRYPT_ROUNDS: 10,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ENABLE_CORS: true,
    CORS_ORIGIN: '*',
    LOG_LEVEL: 'info',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 hours
};

module.exports = {
    HTTP_STATUS,
    STATUS,
    AUDIT_ACTIONS,
    PERMISSIONS,
    FILE_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZES,
    OCR_LANGUAGES,
    PROJECT_TYPES,
    FIELD_TYPES,
    SEARCH_TYPES,
    RATE_LIMITS,
    JWT_CONFIG,
    DATABASE_CONFIG,
    PAGINATION,
    VALIDATION,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    ENV_DEFAULTS
};