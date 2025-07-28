// newdms/middleware/index.js
// Centralized middleware collection

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const path = require('path');

const { RATE_LIMITS, HTTP_STATUS, AUDIT_ACTIONS } = require('../config/constants');
const { NODE_ENV, CORS_ORIGIN } = require('../config/environment');

// Security Middleware
const securityHeaders = helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
});

// CORS Middleware
const corsMiddleware = cors({
    origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Rate Limiting Middleware
const generalRateLimit = rateLimit(RATE_LIMITS.API);

const authRateLimit = rateLimit({
    ...RATE_LIMITS.AUTH,
    skipSuccessfulRequests: true
});

const uploadRateLimit = rateLimit(RATE_LIMITS.UPLOAD);

const searchRateLimit = rateLimit(RATE_LIMITS.SEARCH);

// Request Logging Middleware
const requestLogger = morgan(NODE_ENV === 'production' ? 'combined' : 'dev');

// Error Logging Middleware
const errorLogger = (err, req, res, next) => {
    console.error(`Error ${err.status || 500}: ${err.message}`);
    console.error(err.stack);
    next(err);
};

// Validation Middleware
const validateRequired = (fields) => {
    return (req, res, next) => {
        const missingFields = fields.filter(field => {
            const value = req.body[field];
            return value === undefined || value === null || value === '';
        });

        if (missingFields.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        next();
    };
};

// ID Validation Middleware
const validateId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id || isNaN(parseInt(id)) || parseInt(id) <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: `Invalid ${paramName} parameter`
            });
        }

        req.params[paramName] = parseInt(id);
        next();
    };
};

// Pagination Middleware
const validatePagination = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 items per page
    const offset = (page - 1) * limit;

    req.pagination = {
        page: Math.max(page, 1),
        limit,
        offset: Math.max(offset, 0)
    };

    next();
};

// Audit Logging Middleware
const auditLogger = (action) => {
    return (req, res, next) => {
        req.auditAction = action;
        
        // Store original res.json to intercept response
        const originalJson = res.json;
        res.json = function(data) {
            // Log the action (implement this based on your audit service)
            if (req.user && req.auditAction) {
                // This would typically be handled by your AuditService
                console.log(`Audit: ${req.user.username} performed ${req.auditAction} on ${req.originalUrl}`);
            }
            
            // Call original json method
            return originalJson.call(this, data);
        };

        next();
    };
};

// Async Handler Wrapper
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error('Error Handler:', error);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, status: HTTP_STATUS.NOT_FOUND };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = { message, status: HTTP_STATUS.UNAUTHORIZED };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = { message, status: HTTP_STATUS.UNAUTHORIZED };
    }

    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        const message = 'File too large';
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        const message = 'Unexpected file field';
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    // Database errors
    if (err.name === 'SequelizeUniqueConstraintError') {
        const message = 'Duplicate entry';
        error = { message, status: HTTP_STATUS.CONFLICT };
    }

    if (err.name === 'SequelizeForeignKeyConstraintError') {
        const message = 'Invalid reference - related record not found';
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    if (err.name === 'SequelizeValidationError') {
        const message = err.errors.map(e => e.message).join(', ');
        error = { message, status: HTTP_STATUS.BAD_REQUEST };
    }

    res.status(error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message || 'Server Error',
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
};

// 404 Handler
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = HTTP_STATUS.NOT_FOUND;
    next(error);
};

// Static File Middleware Configuration
const configureStaticFiles = (app) => {
    // Serve uploaded files with proper headers
    app.use('/uploads', express.static(path.join(__dirname, '../../uploads'), {
        maxAge: '1d',
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            // Set appropriate content type based on file extension
            const ext = path.extname(filePath).toLowerCase();
            
            if (['.jpg', '.jpeg'].includes(ext)) {
                res.setHeader('Content-Type', 'image/jpeg');
            } else if (ext === '.png') {
                res.setHeader('Content-Type', 'image/png');
            } else if (ext === '.pdf') {
                res.setHeader('Content-Type', 'application/pdf');
            } else if (['.tif', '.tiff'].includes(ext)) {
                res.setHeader('Content-Type', 'image/tiff');
            }

            // Security headers for file serving
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');
        }
    }));

    // Serve static frontend files
    app.use(express.static(path.join(__dirname, '../../public'), {
        maxAge: NODE_ENV === 'production' ? '1d' : '0',
        etag: true,
        lastModified: true,
        index: ['index.html']
    }));
};

// JSON Parsing Middleware with Error Handling
const jsonParser = (req, res, next) => {
    express.json({ 
        limit: '50mb',
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })(req, res, (err) => {
        if (err) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: 'Invalid JSON format'
            });
        }
        next();
    });
};

// URL Encoded Parser
const urlencodedParser = express.urlencoded({ 
    extended: true, 
    limit: '50mb' 
});

// Request Context Middleware (for adding models and database to req)
const requestContext = (models, database) => {
    return (req, res, next) => {
        req.models = models;
        req.database = database;
        next();
    };
};

// Content Type Validation
const validateContentType = (allowedTypes = ['application/json']) => {
    return (req, res, next) => {
        if (req.method === 'GET' || req.method === 'DELETE') {
            return next();
        }

        const contentType = req.get('Content-Type');
        
        if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: `Content-Type must be one of: ${allowedTypes.join(', ')}`
            });
        }

        next();
    };
};

// Request Size Limiter
const limitRequestSize = (maxSize = '10mb') => {
    return express.raw({ limit: maxSize, type: '*/*' });
};

// IP Whitelist Middleware (for admin functions)
const ipWhitelist = (allowedIPs = []) => {
    return (req, res, next) => {
        if (allowedIPs.length === 0) {
            return next(); // No restriction if no IPs specified
        }

        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (!allowedIPs.includes(clientIP)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                error: 'Access denied from this IP address'
            });
        }

        next();
    };
};

// Request ID Generator
const requestId = (req, res, next) => {
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.requestId);
    next();
};

// Response Time Middleware
const responseTime = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        // Log slow requests
        if (duration > 1000) {
            console.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`);
        }
    });

    next();
};

module.exports = {
    // Security
    securityHeaders,
    corsMiddleware,
    
    // Rate Limiting
    generalRateLimit,
    authRateLimit,
    uploadRateLimit,
    searchRateLimit,
    
    // Logging
    requestLogger,
    errorLogger,
    
    // Validation
    validateRequired,
    validateId,
    validatePagination,
    validateContentType,
    
    // Audit
    auditLogger,
    
    // Utilities
    asyncHandler,
    
    // Error Handling
    errorHandler,
    notFound,
    
    // Static Files
    configureStaticFiles,
    
    // Parsing
    jsonParser,
    urlencodedParser,
    
    // Context
    requestContext,
    
    // Additional
    limitRequestSize,
    ipWhitelist,
    requestId,
    responseTime
};