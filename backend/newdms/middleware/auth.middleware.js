// newdms/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const { HTTP_STATUS } = require('../config/constants');
const { AuthService } = require('../services');

/**
 * JWT Authentication Middleware
 */
const authenticateJWT = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const decoded = AuthService.verifyToken(token);
        
        // Add user info to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(HTTP_STATUS.UNAUTHORIZED).json({
            error: 'Invalid or expired token'
        });
    }
};

/**
 * Optional Authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const decoded = AuthService.verifyToken(token);
            req.user = decoded;
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Permission-based Authorization Middleware
 */
const requirePermission = (permission) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    error: 'Authentication required'
                });
            }

            const hasPermission = await AuthService.userHasPermission(req.user.id, permission);
            
            if (!hasPermission) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Insufficient permissions'
                });
            }

            next();
        } catch (error) {
            console.error('Authorization error:', error);
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Authorization check failed'
            });
        }
    };
};

/**
 * Role-based Authorization Middleware
 */
const requireRole = (roles) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: 'Authentication required'
            });
        }

        if (!roleArray.includes(req.user.role)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({
                error: 'Insufficient role permissions'
            });
        }

        next();
    };
};

/**
 * Admin Only Middleware
 */
const requireAdmin = requireRole(['Administrator']);

module.exports = {
    authenticateJWT,
    optionalAuth,
    requirePermission,
    requireRole,
    requireAdmin
};