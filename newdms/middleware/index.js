// newdms/middleware/index.js
// Centralized export of all middleware utilities, following modular structure and your naming conventions

// Security & Rate Limiting
const {
  securityHeaders,
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  ipWhitelist,
  validateContentType
} = require('./security.middleware');

// CORS
const { corsMiddleware, corsOptions } = require('./cors.middleware');

// Static Files
const { configureStaticFiles } = require('./static.middleware');

// Validation
const {
  validate,
  validateRequired,
  validateId,
  validateFileUpload,
  validatePagination
} = require('./validation.middleware');

// Uploads
const {
  singleFileUpload,
  multipleFileUpload,
  storage,
  fileFilter
} = require('./upload.middleware');

// Auth & Permissions
const {
  authenticateJWT,
  optionalAuth,
  requirePermission,
  requireRole,
  requireAdmin
} = require('./auth.middleware');

// Logging & Audit
const {
  requestLogger,
  errorLogger,
  auditLogger
} = require('./logging.middleware');

// Error Handling
const {
  asyncHandler,
  notFound,
  errorHandler
} = require('./error.middleware');

module.exports = {
  // Security
  securityHeaders,
  generalRateLimit,
  authRateLimit,
  uploadRateLimit,
  ipWhitelist,
  validateContentType,

  // CORS
  corsMiddleware,
  corsOptions,

  // Static Files
  configureStaticFiles,

  // Validation
  validate,
  validateRequired,
  validateId,
  validateFileUpload,
  validatePagination,

  // Upload
  singleFileUpload,
  multipleFileUpload,
  storage,
  fileFilter,

  // Auth & Permissions
  authenticateJWT,
  optionalAuth,
  requirePermission,
  requireRole,
  requireAdmin,

  // Logging & Audit
  requestLogger,
  errorLogger,
  auditLogger,

  // Error Handling
  asyncHandler,
  notFound,
  errorHandler
};