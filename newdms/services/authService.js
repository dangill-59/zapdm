// src/services/authService.js
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/environment');
const { HTTP_STATUS, PERMISSIONS } = require('../config/constants');

class AuthService {
    /**
     * Generate JWT token for user
     * @param {Object} user - User object
     * @returns {string} JWT token
     */
    static generateToken(user) {
        const userPermissions = JSON.parse(user.permissions || '[]');
        
        return jwt.sign({
            id: user.id,
            username: user.username,
            role_id: user.role_id,
            permissions: userPermissions
        }, JWT_SECRET, { expiresIn: '24h' });
    }

    /**
     * Verify JWT token
     * @param {string} token - JWT token to verify
     * @returns {Object} Decoded token or null
     */
    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract token from authorization header
     * @param {string} authHeader - Authorization header
     * @returns {string|null} Token or null
     */
    static extractTokenFromHeader(authHeader) {
        return authHeader && authHeader.split(' ')[1];
    }

    /**
     * Authenticate middleware function
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    static authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = AuthService.extractTokenFromHeader(authHeader);

        if (!token) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Access token required' });
        }

        const decoded = AuthService.verifyToken(token);
        if (!decoded) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Invalid token' });
        }

        req.user = decoded;
        next();
    }

    /**
     * Authorization middleware factory
     * @param {Array<string>} permissions - Required permissions
     * @returns {Function} Middleware function
     */
    static authorize(permissions) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Authentication required' });
            }

            const userPermissions = req.user.permissions || [];
            const hasPermission = permissions.some(permission => userPermissions.includes(permission));

            if (!hasPermission && !userPermissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Insufficient permissions' });
            }

            next();
        };
    }

    /**
     * Check if user has specific permission
     * @param {Array<string>} userPermissions - User's permissions
     * @param {string} requiredPermission - Required permission
     * @returns {boolean}
     */
    static hasPermission(userPermissions, requiredPermission) {
        return userPermissions.includes(requiredPermission) || 
               userPermissions.includes(PERMISSIONS.ADMIN_ACCESS);
    }

    /**
     * Check if a given user object has a specific permission
     * @param {Object} user - user object (should have .permissions array)
     * @param {string} requiredPermission
     * @returns {boolean}
     */
    static userHasPermission(user, requiredPermission) {
        if (!user || !user.permissions) return false;
        return AuthService.hasPermission(user.permissions, requiredPermission);
    }
}

module.exports = AuthService;