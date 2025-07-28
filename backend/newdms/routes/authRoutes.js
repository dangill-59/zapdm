// newdms/routes/auth.routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { AuthService, AuditService } = require('../services');
const { 
    authRateLimit, 
    validateRequired, 
    auditLogger, 
    asyncHandler 
} = require('../middleware');
const { HTTP_STATUS, AUDIT_ACTIONS } = require('../config/constants');

const router = express.Router();

/**
 * POST /api/auth/login
 * User authentication
 */
router.post('/login',
    authRateLimit,
    validateRequired(['username', 'password']),
    auditLogger(AUDIT_ACTIONS.LOGIN),
    asyncHandler(async (req, res) => {
        const { username, password } = req.body;

        try {
            // Find user in database
            const user = await req.models.User.findOne({
                where: { username, status: 'active' },
                include: [{ model: req.models.Role, as: 'role' }]
            });

            if (!user) {
                await AuditService.log({
                    action: AUDIT_ACTIONS.LOGIN,
                    details: `Failed login attempt for username: ${username}`,
                    ip: req.ip,
                    success: false
                });

                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    error: 'Invalid credentials'
                });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                await AuditService.log({
                    action: AUDIT_ACTIONS.LOGIN,
                    userId: user.id,
                    details: `Invalid password for user: ${username}`,
                    ip: req.ip,
                    success: false
                });

                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    error: 'Invalid credentials'
                });
            }

            // Generate JWT token
            const token = AuthService.generateToken({
                id: user.id,
                username: user.username,
                role: user.role.name,
                roleId: user.roleId
            });

            // Update last login
            await user.update({ lastLogin: new Date() });

            // Log successful login
            await AuditService.log({
                action: AUDIT_ACTIONS.LOGIN,
                userId: user.id,
                details: `Successful login for user: ${username}`,
                ip: req.ip,
                success: true
            });

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role.name,
                    permissions: user.role.permissions || []
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Login failed'
            });
        }
    })
);

/**
 * GET /api/auth/validate
 * Token validation
 */
router.get('/validate',
    asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                valid: false,
                error: 'No token provided'
            });
        }

        try {
            const token = authHeader.substring(7);
            const decoded = AuthService.verifyToken(token);
            
            // Verify user still exists and is active
            const user = await req.models.User.findByPk(decoded.id, {
                include: [{ model: req.models.Role, as: 'role' }]
            });

            if (!user || user.status !== 'active') {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    valid: false,
                    error: 'User not found or inactive'
                });
            }

            res.json({
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role.name,
                    permissions: user.role.permissions || []
                }
            });

        } catch (error) {
            console.error('Token validation error:', error);
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                valid: false,
                error: 'Invalid token'
            });
        }
    })
);

/**
 * POST /api/auth/logout
 * User logout (optional - mainly for audit logging)
 */
router.post('/logout',
    auditLogger(AUDIT_ACTIONS.LOGOUT),
    asyncHandler(async (req, res) => {
        // In stateless JWT, we mainly log the logout
        // Client should remove the token
        
        if (req.user) {
            await AuditService.log({
                action: AUDIT_ACTIONS.LOGOUT,
                userId: req.user.id,
                details: `User logged out: ${req.user.username}`,
                ip: req.ip,
                success: true
            });
        }

        res.json({ message: 'Logged out successfully' });
    })
);

/**
 * POST /api/auth/refresh
 * Token refresh (optional)
 */
router.post('/refresh',
    asyncHandler(async (req, res) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: 'No token provided'
            });
        }

        try {
            const token = authHeader.substring(7);
            const decoded = AuthService.verifyToken(token);
            
            // Verify user still exists and is active
            const user = await req.models.User.findByPk(decoded.id, {
                include: [{ model: req.models.Role, as: 'role' }]
            });

            if (!user || user.status !== 'active') {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json({
                    error: 'User not found or inactive'
                });
            }

            // Generate new token
            const newToken = AuthService.generateToken({
                id: user.id,
                username: user.username,
                role: user.role.name,
                roleId: user.roleId
            });

            res.json({ token: newToken });

        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(HTTP_STATUS.UNAUTHORIZED).json({
                error: 'Token refresh failed'
            });
        }
    })
);

module.exports = router;