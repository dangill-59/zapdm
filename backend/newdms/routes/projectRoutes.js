// newdms/routes/projectRoutes.js
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
const indexFieldSchema = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    label: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('text', 'number', 'date', 'dropdown', 'checkbox').required(),
    required: Joi.boolean().default(false),
    options: Joi.array().items(Joi.string()).optional()
});

const projectSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().max(500).optional().allow(''),
    type: Joi.string().valid('custom', 'finance', 'hr', 'legal', 'operations', 'marketing').default('custom'),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#667eea'),
    status: Joi.string().valid('active', 'inactive').default('active'),
    assigned_roles: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
    index_fields: Joi.array().items(indexFieldSchema).optional()
});

const updateProjectSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    description: Joi.string().max(500).optional().allow(''),
    type: Joi.string().valid('custom', 'finance', 'hr', 'legal', 'operations', 'marketing').optional(),
    color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    assigned_roles: Joi.array().items(Joi.number().integer().positive()).optional(),
    index_fields: Joi.array().items(indexFieldSchema).optional()
});

/**
 * GET /api/projects
 * List all projects (filtered by user access)
 */
router.get('/',
    AuthService.authenticateToken,
    asyncHandler(async (req, res) => {
        try {
            const { page = 1, limit = 50, search, status } = req.query;
            const offset = (page - 1) * limit;

            let whereClause = {};
            
            // Filter by status if provided
            if (status) {
                whereClause.status = status;
            }
            
            // Add search functionality
            if (search) {
                whereClause[req.models.Sequelize.Op.or] = [
                    { name: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                    { description: { [req.models.Sequelize.Op.like]: `%${search}%` } }
                ];
            }

            // Check if user has admin access
            const hasAdminAccess = req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS);
            
            let projects;
            
            if (hasAdminAccess) {
                // Admins can see all projects
                const { count, rows } = await req.models.Project.findAndCountAll({
                    where: whereClause,
                    include: [
                        {
                            model: req.models.ProjectRole,
                            as: 'projectRoles',
                            include: [
                                {
                                    model: req.models.Role,
                                    as: 'role',
                                    attributes: ['id', 'name']
                                }
                            ]
                        },
                        {
                            model: req.models.Document,
                            as: 'documents',
                            attributes: ['id'],
                            required: false
                        }
                    ],
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    order: [['name', 'ASC']]
                });
                
                projects = { count, rows };
            } else {
                // Regular users can only see projects they have access to
                const { count, rows } = await req.models.Project.findAndCountAll({
                    where: whereClause,
                    include: [
                        {
                            model: req.models.ProjectRole,
                            as: 'projectRoles',
                            where: {
                                roleId: req.user.roleId
                            },
                            include: [
                                {
                                    model: req.models.Role,
                                    as: 'role',
                                    attributes: ['id', 'name']
                                }
                            ]
                        },
                        {
                            model: req.models.Document,
                            as: 'documents',
                            attributes: ['id'],
                            required: false
                        }
                    ],
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    order: [['name', 'ASC']]
                });
                
                projects = { count, rows };
            }

            // Transform projects to include assigned roles and document count
            const projectsWithData = projects.rows.map(project => ({
                ...project.toJSON(),
                assigned_roles: project.projectRoles ? project.projectRoles.map(pr => pr.role) : [],
                document_count: project.documents ? project.documents.length : 0
            }));

            res.json({
                projects: projectsWithData,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: projects.count,
                    pages: Math.ceil(projects.count / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching projects:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch projects'
            });
        }
    })
);

/**
 * GET /api/projects/:id
 * Get specific project details
 */
router.get('/:id',
    AuthService.authenticateToken,
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const project = await req.models.Project.findByPk(id, {
                include: [
                    {
                        model: req.models.ProjectRole,
                        as: 'projectRoles',
                        include: [
                            {
                                model: req.models.Role,
                                as: 'role',
                                attributes: ['id', 'name']
                            }
                        ]
                    },
                    {
                        model: req.models.Document,
                        as: 'documents',
                        attributes: ['id', 'title', 'createdAt'],
                        where: { status: 'active' },
                        required: false
                    },
                    {
                        model: req.models.User,
                        as: 'createdByUser',
                        attributes: ['id', 'username', 'firstName', 'lastName']
                    }
                ]
            });

            if (!project) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Project not found'
                });
            }

            // Check access (admin or assigned role)
            const hasAdminAccess = req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS);
            const hasProjectAccess = project.projectRoles.some(pr => pr.roleId === req.user.roleId);

            if (!hasAdminAccess && !hasProjectAccess) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            // Transform project data
            const projectData = {
                ...project.toJSON(),
                assigned_roles: project.projectRoles.map(pr => pr.role),
                document_count: project.documents.length
            };

            res.json({ project: projectData });

        } catch (error) {
            console.error('Error fetching project:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch project'
            });
        }
    })
);

/**
 * POST /api/projects
 * Create new project
 */
router.post('/',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.PROJECT_CREATE, PERMISSIONS.ADMIN_ACCESS]),
    validateRequired(['name', 'assigned_roles']),
    auditLogger(AUDIT_ACTIONS.CREATE),
    asyncHandler(async (req, res) => {
        try {
            // Validate input
            const { error, value } = projectSchema.validate(req.body);
            if (error) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: error.details[0].message
                });
            }

            const { name, description, type, color, status, assigned_roles, index_fields } = value;

            // Check if project name already exists
            const existingProject = await req.models.Project.findOne({
                where: { name }
            });

            if (existingProject) {
                return res.status(HTTP_STATUS.CONFLICT).json({
                    error: 'Project name already exists'
                });
            }

            // Validate that all assigned roles exist
            const roles = await req.models.Role.findAll({
                where: {
                    id: { [req.models.Sequelize.Op.in]: assigned_roles },
                    status: 'active'
                }
            });

            if (roles.length !== assigned_roles.length) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'One or more assigned roles not found or inactive'
                });
            }

            // Create project within transaction
            const result = await req.models.sequelize.transaction(async (t) => {
                // Create project
                const project = await req.models.Project.create({
                    name,
                    description,
                    type,
                    color,
                    status,
                    indexFields: index_fields || [],
                    createdBy: req.user.id
                }, { transaction: t });

                // Create project role assignments
                const projectRoles = assigned_roles.map(roleId => ({
                    projectId: project.id,
                    roleId: roleId
                }));

                await req.models.ProjectRole.bulkCreate(projectRoles, { transaction: t });

                return project;
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.CREATE,
                userId: req.user.id,
                details: `Project created: ${name} with ${assigned_roles.length} assigned roles`,
                entityType: 'project',
                entityId: result.id,
                ip: req.ip
            });

            // Fetch the complete project data
            const createdProject = await req.models.Project.findByPk(result.id, {
                include: [
                    {
                        model: req.models.ProjectRole,
                        as: 'projectRoles',
                        include: [
                            {
                                model: req.models.Role,
                                as: 'role',
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ]
            });

            res.status(HTTP_STATUS.CREATED).json({
                message: 'Project created successfully',
                project: {
                    ...createdProject.toJSON(),
                    assigned_roles: createdProject.projectRoles.map(pr => pr.role)
                }
            });

        } catch (error) {
            console.error('Error creating project:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to create project'
            });
        }
    })
);

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.PROJECT_EDIT, PERMISSIONS.ADMIN_ACCESS]),
    auditLogger(AUDIT_ACTIONS.UPDATE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            // Validate input
            const { error, value } = updateProjectSchema.validate(req.body);
            if (error) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: error.details[0].message
                });
            }

            const project = await req.models.Project.findByPk(id);

            if (!project) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Project not found'
                });
            }

            // Check if name is being updated and if it conflicts
            if (value.name && value.name !== project.name) {
                const existingProject = await req.models.Project.findOne({
                    where: { 
                        name: value.name,
                        id: { [req.models.Sequelize.Op.ne]: id }
                    }
                });

                if (existingProject) {
                    return res.status(HTTP_STATUS.CONFLICT).json({
                        error: 'Project name already exists'
                    });
                }
            }

            // Update project within transaction
            await req.models.sequelize.transaction(async (t) => {
                // Update project
                await project.update({
                    ...value,
                    updatedBy: req.user.id
                }, { transaction: t });

                // Update role assignments if provided
                if (value.assigned_roles) {
                    // Validate roles
                    const roles = await req.models.Role.findAll({
                        where: {
                            id: { [req.models.Sequelize.Op.in]: value.assigned_roles },
                            status: 'active'
                        }
                    });

                    if (roles.length !== value.assigned_roles.length) {
                        throw new Error('One or more assigned roles not found or inactive');
                    }

                    // Remove existing role assignments
                    await req.models.ProjectRole.destroy({
                        where: { projectId: id },
                        transaction: t
                    });

                    // Create new role assignments
                    const projectRoles = value.assigned_roles.map(roleId => ({
                        projectId: id,
                        roleId: roleId
                    }));

                    await req.models.ProjectRole.bulkCreate(projectRoles, { transaction: t });
                }
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.UPDATE,
                userId: req.user.id,
                details: `Project updated: ${project.name}`,
                entityType: 'project',
                entityId: project.id,
                ip: req.ip
            });

            // Return updated project
            const updatedProject = await req.models.Project.findByPk(id, {
                include: [
                    {
                        model: req.models.ProjectRole,
                        as: 'projectRoles',
                        include: [
                            {
                                model: req.models.Role,
                                as: 'role',
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ]
            });

            res.json({
                message: 'Project updated successfully',
                project: {
                    ...updatedProject.toJSON(),
                    assigned_roles: updatedProject.projectRoles.map(pr => pr.role)
                }
            });

        } catch (error) {
            console.error('Error updating project:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to update project'
            });
        }
    })
);

/**
 * DELETE /api/projects/:id
 * Soft delete project
 */
router.delete('/:id',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.PROJECT_DELETE, PERMISSIONS.ADMIN_ACCESS]),
    auditLogger(AUDIT_ACTIONS.DELETE),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        try {
            const project = await req.models.Project.findByPk(id, {
                include: [
                    {
                        model: req.models.Document,
                        as: 'documents',
                        attributes: ['id'],
                        where: { status: 'active' },
                        required: false
                    }
                ]
            });

            if (!project) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Project not found'
                });
            }

            // Check if project has active documents
            if (project.documents && project.documents.length > 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Cannot delete project that contains active documents. Please delete or move documents first.'
                });
            }

            // Soft delete project and remove role assignments
            await req.models.sequelize.transaction(async (t) => {
                // Soft delete project
                await project.update({
                    status: 'deleted',
                    deletedAt: new Date(),
                    deletedBy: req.user.id
                }, { transaction: t });

                // Remove role assignments
                await req.models.ProjectRole.destroy({
                    where: { projectId: id },
                    transaction: t
                });
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.DELETE,
                userId: req.user.id,
                details: `Project deleted: ${project.name}`,
                entityType: 'project',
                entityId: project.id,
                ip: req.ip
            });

            res.json({
                message: 'Project deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting project:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to delete project'
            });
        }
    })
);

/**
 * GET /api/projects/:id/documents
 * Get documents in a project
 */
router.get('/:id/documents',
    AuthService.authenticateToken,
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { page = 1, limit = 50, search, status = 'active' } = req.query;
        const offset = (page - 1) * limit;

        try {
            // Check project access
            const hasAccess = await checkProjectAccess(req, id);
            if (!hasAccess) {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            let whereClause = { 
                projectId: id,
                status 
            };

            if (search) {
                whereClause[req.models.Sequelize.Op.or] = [
                    { title: { [req.models.Sequelize.Op.like]: `%${search}%` } },
                    { description: { [req.models.Sequelize.Op.like]: `%${search}%` } }
                ];
            }

            const { count, rows: documents } = await req.models.Document.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: req.models.User,
                        as: 'createdByUser',
                        attributes: ['id', 'username', 'firstName', 'lastName']
                    },
                    {
                        model: req.models.DocumentPage,
                        as: 'pages',
                        attributes: ['id'],
                        where: { status: 'active' },
                        required: false
                    }
                ],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['createdAt', 'DESC']]
            });

            // Add page count and created by name
            const documentsWithData = documents.map(doc => ({
                ...doc.toJSON(),
                page_count: doc.pages ? doc.pages.length : 0,
                created_by_name: doc.createdByUser ? 
                    `${doc.createdByUser.firstName || ''} ${doc.createdByUser.lastName || ''}`.trim() || doc.createdByUser.username : 
                    'Unknown'
            }));

            res.json({
                documents: documentsWithData,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    pages: Math.ceil(count / limit)
                }
            });

        } catch (error) {
            console.error('Error fetching project documents:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to fetch project documents'
            });
        }
    })
);

/**
 * Helper function to check project access
 */
async function checkProjectAccess(req, projectId) {
    // Admin users have access to all projects
    if (req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
        return true;
    }

    // Check if user's role is assigned to this project
    const projectRole = await req.models.ProjectRole.findOne({
        where: {
            projectId: projectId,
            roleId: req.user.roleId
        }
    });

    return !!projectRole;
}

module.exports = router;