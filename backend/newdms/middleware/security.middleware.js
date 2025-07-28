// newdms/middleware/security.middleware.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { HTTP_STATUS } = require('../config/constants');

/**
 * Security Headers Middleware
 */
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false
});

/**
 * Rate Limiting
 */
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
                error: message
            });
        }
    });
};

// Different rate limits for different endpoints
const generalRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    100, // limit each IP to 100 requests per windowMs
    'Too many requests, please try again later'
);

const authRateLimit = createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // limit each IP to 5 login attempts per windowMs
    'Too many login attempts, please try again later'
);

const uploadRateLimit = createRateLimit(
    60 * 60 * 1000, // 1 hour
    20, // limit each IP to 20 uploads per hour
    'Too many upload attempts, please try again later'
);

/**
 * IP Whitelist Middleware
 */
const ipWhitelist = (allowedIPs) => {
    return (req, res, next) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (allowedIPs.includes(clientIP)) {
            next();
        } else {
            res.status(HTTP_STATUS.FORBIDDEN).json({
                error: 'Access denied from this IP address'
            });
        }
    };
};

/**
 * Content Type Validation
 */
const validateContentType = (allowedTypes) => {
    return (req, res, next) => {
        const contentType = req.get('Content-Type');
        
        if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: 'Invalid content type'
            });
        }
        
        next();
    };
};

module.exports = {
    securityHeaders,
    generalRateLimit,
    authRateLimit,
    uploadRateLimit,
    ipWhitelist,
    validateContentType
};