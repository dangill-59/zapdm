// newdms/routes/user.routes.js
const express = require('express');
const bcrypt = require('bcrypt');
const { AuditService } = require('../services');
const { 
    authenticateJWT, 
    requirePermission, 
    requireAdmin,
    validateRequired, 
    validateId,
    validatePagination,
    auditLogger, 
    asyncHandler 
} = require('../middleware');
const { HTTP_STATUS, AUDIT_ACTIONS, PERMISSIONS, STATUS } = require('../config/constants');

const router = express.Router();

/**
 * GET /api/users
 * List all users (admin only)
 */
router.get('/',
    authenticateJWT,
    requirePermission(PERMISSIONS.USER_VIEW),
    validatePagination,
    asyncHandler(async (req, res) => {
        const { page, limit, offset } = req.pagination;
        const { search, roleId, status } = req.query;

        try {
            const whereClause = {};
            
            if (search) {
                whereClause[req.models.Sequelize.Op.or] = [
                    { username: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                    { firstName: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                    { lastName: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                    { email: { [req.models.Sequelize.Op.like]: `%${search}%` } }
                ];
            }
            
            if (roleId) {
                whereClause.roleId = roleId;
            }
            
            if (status) {
                whereClause.status = status;
            }

            const { count, rows: users } = await req.models.User.findAndCountAll({
                where: whereClause,
                include: [
                    { model: req.models.Role, as: 'role' },
                    { model: req.models.User, as: 'createdByUser', attributes: ['username'] }
                ],
                attributes: { exclude: ['password'] },
                limit,
                offset,
                order: [['createdAt', 'DESC']]
            });

            res.json({
                users,
                pagination: {
                    page,
                    limit,
                    total: count,
                    pages: Math.ceil(count / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching users:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch users'
            });
        }
    })
);

/**
 * GET /api/users/:id
 * Get specific user details
 */
router.get('/:id',
    authenticateJWT,
    requirePermission(PERMISSIONS.USER_VIEW),
    validateId('id'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const user = await req.models.User.findByPk(id, {
                include: [
                    { model: req.models.Role, as: 'role' },
                    { model: req.models.User, as: 'createdByUser', attributes: ['username'] }
                ],
                attributes: { exclude: ['password'] }
            });

            if (!user) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'User not found'
                });
            }

            res.json({ user });

        } catch (error) {
            console.error('Error fetching user:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch user'
            });
        }
    })
);

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/',
    authenticateJWT,
    requirePermission(PERMISSIONS.USER_CREATE),
    validateRequired(['username', 'password', 'firstName', 'lastName', 'email', 'roleId']),
    auditLogger(AUDIT_ACTIONS.CREATE),
    asyncHandler(async (req, res) => {
        const { username, password, firstName, lastName, email, roleId } = req.body;

        try {
            // Check if username already exists
            const existingUser = await req.models.User.findOne({
                where: { username }
            });

            if (existingUser) {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    error: 'Username already exists'
                });
            }

            // Check if email already exists
            const existingEmail = await req.models.User.findOne({
                where: { email }
            });

            if (existingEmail) {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    error: 'Email already exists'
                });
            }

            // Verify role exists
            const role = await req.models.Role.findByPk(roleId);
            if (!role) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Invalid role ID'
                });
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const user = await req.models.User.create({
                username,
                password: hashedPassword,
                firstName,
                lastName,
                email,
                roleId,
                status: STATUS.ACTIVE,
                createdBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.CREATE,
                userId: req.user.id,
                details: `User created: ${username}`,
                entityType: 'user',
                entityId: user.id
            });

            // Return user without password
            const userResponse = await req.models.User.findByPk(user.id, {
                include: [{ model: req.models.Role, as: 'role' }],
                attributes: { exclude: ['password'] }
            });

            res.status(HTTP_STATUS.CREATED).json({
                message: 'User created successfully',
                user: userResponse
            });

        } catch (error) {
            console.error('Error creating user:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to create user'
            });
        }
    })
);

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
router.put('/:id',
    authenticateJWT,
    requirePermission(PERMISSIONS.USER_EDIT),
    validateId('id'),
    auditLogger(AUDIT_ACTIONS.UPDATE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { firstName, lastName, email, roleId, status, password } = req.body;

        try {
            const user = await req.models.User.findByPk(id);

            if (!user) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'User not found'
                });
            }

            // Prepare update data
            const updateData = {};
            
            if (firstName !== undefined) updateData.firstName = firstName;
            if (lastName !== undefined) updateData.lastName = lastName;
            if (email !== undefined) updateData.email = email;
            if (roleId !== undefined) updateData.roleId = roleId;
            if (status !== undefined) updateData.status = status;

            // Handle password update
            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            // Update user
            await user.update(updateData);

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.UPDATE,
                userId: req.user.id,
                details: `User updated: ${user.username}`,
                entityType: 'user',
                entityId: user.id
            });

            // Return updated user
            const updatedUser = await req.models.User.findByPk(id, {
                include: [{ model: req.models.Role, as: 'role' }],
                attributes: { exclude: ['password'] }
            });

            res.json({
                message: 'User updated successfully',
                user: updatedUser
            });

        } catch (error) {
            console.error('Error updating user:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to update user'
            });
        }
    })
);

/**
 * DELETE /api/users/:id
 * Soft delete user (admin only)
 */
router.delete('/:id',
    authenticateJWT,
    requirePermission(PERMISSIONS.USER_DELETE),
    validateId('id'),
    auditLogger(AUDIT_ACTIONS.DELETE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const user = await req.models.User.findByPk(id);

            if (!user) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'User not found'
                });
            }

            // Prevent self-deletion
            if (user.id === req.user.id) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Cannot delete your own account'
                });
            }

            // Soft delete
            await user.update({
                status: STATUS.DELETED,
                deletedAt: new Date(),
                deletedBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.DELETE,
                userId: req.user.id,
                details: `User deleted: ${user.username}`,
                entityType: 'user',
                entityId: user.id
            });

            res.json({
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting user:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to delete user'
            });
        }
    })
);

/**
 * GET /api/users/:id/projects
 * Get user's accessible projects
 */
router.get('/:id/projects',
    authenticateJWT,
    validateId('id'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            // Users can only see their own projects unless admin
            if (req.user.id !== parseInt(id) && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied'
                });
            }

            const projects = await req.models.Project.findAll({
                include: [{
                    model: req.models.ProjectUser,
                    as: 'projectUsers',
                    where: { userId: id },
                    attributes: ['role', 'joinedAt']
                }],
                order: [['name', 'ASC']]
            });

            res.json({ projects });

        } catch (error) {
            console.error('Error fetching user projects:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch user projects'
            });
        }
    })
);

module.exports = router;