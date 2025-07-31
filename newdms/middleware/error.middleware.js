// newdms/middleware/error.middleware.js
const { HTTP_STATUS } = require('../config/constants');

/**
 * Async error wrapper - catches async route errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * 404 Not Found Handler
 */
const notFound = (req, res, next) => {
    const error = new Error(`Route not found - ${req.originalUrl}`);
    error.status = HTTP_STATUS.NOT_FOUND;
    next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (error, req, res, next) => {
    let statusCode = error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let message = error.message || 'Internal Server Error';

    // Log error details
    console.error('Error occurred:', error);
if (error && error.stack) {
    console.error(error.stack);
}
console.error('Request info:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
});

    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = Object.values(error.errors).map(val => val.message).join(', ');
    }

    if (error.name === 'CastError') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Invalid ID format';
    }

    if (error.code === 'SQLITE_CONSTRAINT') {
        statusCode = HTTP_STATUS.CONFLICT;
        message = 'Database constraint violation';
    }

    if (error.code === 'ENOENT') {
        statusCode = HTTP_STATUS.NOT_FOUND;
        message = 'File not found';
    }

    // Multer file upload errors
    if (error.code === 'LIMIT_FILE_SIZE') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'File too large';
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = HTTP_STATUS.BAD_REQUEST;
        message = 'Unexpected file field';
    }

    // Don't leak error details in production
    const errorResponse = {
        error: message,
        status: statusCode
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = error.stack;
    }

    res.status(statusCode).json(errorResponse);
};

module.exports = {
    asyncHandler,
    notFound,
    errorHandler
};