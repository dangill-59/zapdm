// newdms/routes/roleRoutes.js
const express = require('express');
const Joi = require('joi');
const { AuthService, AuditService } = require('../services');
const { 
    authRateLimit, 
    validateRequired, 
    auditLogger, 
    asyncHandler 
} = require('../middleware');
const { HTTP_STATUS, AUDIT_ACTIONS, PERMISSIONS } = require('../config/constants');

const router = express.Router();

// Validation schemas
const roleSchema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    description: Joi.string().max(255).optional().allow(''),
    permissions: Joi.array().items(Joi.string()).optional()
});

const updateRoleSchema = Joi.object({
    name: Joi.string().min(2).max(50).optional(),
    description: Joi.string().max(255).optional().allow(''),
    permissions: Joi.array().items(Joi.string()).optional()
});

/**
 * GET /api/roles
 * List all roles
 */
router.get('/',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_VIEW, PERMISSIONS.ADMIN_ACCESS]),
    asyncHandler(async (req, res) => {
        try {
            const { page = 1, limit = 50, search } = req.query;
            const offset = (page - 1) * limit;

            let whereClause = {};
            if (search) {
                whereClause = {
                    [req.models.Sequelize.Op.or]: [
                        { name: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                        { description: { [req.models.Sequelize.Op.like]: `%${search}%` } }
                    ]
                };
            }

            const { count, rows: roles } = await req.models.Role.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: req.models.User,
                        as: 'users',
                        attributes: ['id'],
                        required: false
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['name', 'ASC']]
            });

            // Add user count to each role
            const rolesWithCounts = roles.map(role => ({
                ...role.toJSON(),
                user_count: role.users ? role.users.length : 0
            }));

            res.json({
                roles: rolesWithCounts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    pages: Math.ceil(count / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching roles:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch roles'
            });
        }
    })
);

/**
 * GET /api/roles/:id
 * Get specific role details
 */
router.get('/:id',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_VIEW, PERMISSIONS.ADMIN_ACCESS]),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const role = await req.models.Role.findByPk(id, {
                include: [
                    {
                        model: req.models.User,
                        as: 'users',
                        attributes: ['id', 'username', 'firstName', 'lastName']
                    }
                ]
            });

            if (!role) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Role not found'
                });
            }

            res.json({ role });

        } catch (error) {
            console.error('Error fetching role:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch role'
            });
        }
    })
);

/**
 * POST /api/roles
 * Create new role
 */
router.post('/',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_CREATE, PERMISSIONS.ADMIN_ACCESS]),
    validateRequired(['name']),
    auditLogger(AUDIT_ACTIONS.CREATE),
    asyncHandler(async (req, res) => {
        try {
            // Validate input
            const { error, value } = roleSchema.validate(req.body);
            if (error) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: error.details[0].message
                });
            }

            const { name, description, permissions } = value;

            // Check if role name already exists
            const existingRole = await req.models.Role.findOne({
                where: { name }
            });

            if (existingRole) {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    error: 'Role name already exists'
                });
            }

            // Create role
            const role = await req.models.Role.create({
                name,
                description,
                permissions: permissions || [],
                createdBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.CREATE,
                userId: req.user.id,
                details: `Role created: ${name}`,
                entityType: 'role',
                entityId: role.id,
                ip: req.ip
            });

            res.status(HTTP_STATUS.CREATED).json({
                message: 'Role created successfully',
                role
            });

        } catch (error) {
            console.error('Error creating role:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to create role'
            });
        }
    })
);

/**
 * PUT /api/roles/:id
 * Update role
 */
router.put('/:id',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_EDIT, PERMISSIONS.ADMIN_ACCESS]),
    auditLogger(AUDIT_ACTIONS.UPDATE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            // Validate input
            const { error, value } = updateRoleSchema.validate(req.body);
            if (error) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: error.details[0].message
                });
            }

            const role = await req.models.Role.findByPk(id);

            if (!role) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Role not found'
                });
            }

            // Check if name is being updated and if it conflicts
            if (value.name && value.name !== role.name) {
                const existingRole = await req.models.Role.findOne({
                    where: { 
                        name: value.name,
                        id: { [req.models.Sequelize.Op.ne]: id }
                    }
                });

                if (existingRole) {
                    return res.status(HTTP_STATUS.CONFLICT).json({
                        error: 'Role name already exists'
                    });
                }
            }

            // Update role
            await role.update({
                ...value,
                updatedBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.UPDATE,
                userId: req.user.id,
                details: `Role updated: ${role.name}`,
                entityType: 'role',
                entityId: role.id,
                ip: req.ip
            });

            // Return updated role
            const updatedRole = await req.models.Role.findByPk(id, {
                include: [
                    {
                        model: req.models.User,
                        as: 'users',
                        attributes: ['id', 'username', 'firstName', 'lastName']
                    }
                ]
            });

            res.json({
                message: 'Role updated successfully',
                role: updatedRole
            });

        } catch (error) {
            console.error('Error updating role:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to update role'
            });
        }
    })
);

/**
 * DELETE /api/roles/:id
 * Soft delete role
 */
router.delete('/:id',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_DELETE, PERMISSIONS.ADMIN_ACCESS]),
    auditLogger(AUDIT_ACTIONS.DELETE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const role = await req.models.Role.findByPk(id, {
                include: [
                    {
                        model: req.models.User,
                        as: 'users',
                        attributes: ['id']
                    }
                ]
            });

            if (!role) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Role not found'
                });
            }

            // Check if role has users assigned
            if (role.users && role.users.length > 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Cannot delete role that has users assigned. Please reassign users first.'
                });
            }

            // Soft delete
            await role.update({
                status: 'deleted',
                deletedAt: new Date(),
                deletedBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.DELETE,
                userId: req.user.id,
                details: `Role deleted: ${role.name}`,
                entityType: 'role',
                entityId: role.id,
                ip: req.ip
            });

            res.json({
                message: 'Role deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting role:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to delete role'
            });
        }
    })
);

/**
 * GET /api/roles/:id/permissions
 * Get available permissions for role assignment
 */
router.get('/:id/permissions',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_VIEW, PERMISSIONS.ADMIN_ACCESS]),
    asyncHandler(async (req, res) => {
        try {
            // Return all available permissions
            const availablePermissions = Object.values(PERMISSIONS).map(permission => ({
                id: permission,
                name: permission.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                category: permission.split('_')[0].replace(/\b\w/g, l => l.toUpperCase())
            }));

            res.json({
                permissions: availablePermissions
            });

        } catch (error) {
            console.error('Error fetching permissions:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch permissions'
            });
        }
    })
);

/**
 * POST /api/roles/:id/users
 * Assign users to role
 */
router.post('/:id/users',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.ROLE_EDIT, PERMISSIONS.ADMIN_ACCESS]),
    validateRequired(['userIds']),
    auditLogger(AUDIT_ACTIONS.UPDATE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { userIds } = req.body;

        try {
            const role = await req.models.Role.findByPk(id);

            if (!role) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Role not found'
                });
            }

            // Validate that all user IDs exist
            const users = await req.models.User.findAll({
                where: {
                    id: { [req.models.Sequelize.Op.in]: userIds },
                    status: 'active'
                }
            });

            if (users.length !== userIds.length) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'One or more users not found or inactive'
                });
            }

            // Update users with new role
            await req.models.User.update(
                { roleId: id },
                { 
                    where: { 
                        id: { [req.models.Sequelize.Op.in]: userIds } 
                    } 
                }
            );

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.UPDATE,
                userId: req.user.id,
                details: `Assigned ${users.length} users to role: ${role.name}`,
                entityType: 'role',
                entityId: role.id,
                ip: req.ip
            });

            res.json({
                message: `Successfully assigned ${users.length} users to role`,
                assignedUsers: users.length
            });

        } catch (error) {
            console.error('Error assigning users to role:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to assign users to role'
            });
        }
    })
);

module.exports = router;