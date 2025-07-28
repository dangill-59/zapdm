// newdms/middleware/validation.middleware.js
const { HTTP_STATUS } = require('../config/constants');

/**
 * Generic validation middleware
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        
        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message)
                .join(', ');
                
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: 'Validation failed',
                details: errorMessage
            });
        }
        
        next();
    };
};

/**
 * Validate required fields
 */
const validateRequired = (fields) => {
    return (req, res, next) => {
        const missing = [];
        
        fields.forEach(field => {
            if (!req.body[field]) {
                missing.push(field);
            }
        });
        
        if (missing.length > 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: 'Missing required fields',
                missing: missing
            });
        }
        
        next();
    };
};

/**
 * Validate ID parameter
 */
const validateId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id || isNaN(parseInt(id))) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                error: `Invalid ${paramName} parameter`
            });
        }
        
        req.params[paramName] = parseInt(id);
        next();
    };
};

/**
 * Validate file upload
 */
const validateFileUpload = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'No files uploaded'
        });
    }
    
    next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (page < 1) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Page must be greater than 0'
        });
    }
    
    if (limit < 1 || limit > 100) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: 'Limit must be between 1 and 100'
        });
    }
    
    req.pagination = { page, limit, offset: (page - 1) * limit };
    next();
};

module.exports = {
    validate,
    validateRequired,
    validateId,
    validateFileUpload,
    validatePagination
};