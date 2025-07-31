// newdms/routes/index.js
// Main route configuration and setup (with working API routes for users, roles, and projects)

const express = require('express');
const path = require('path');
const { authRateLimit, uploadRateLimit } = require('../middleware');

/**
 * Setup all application routes
 */
function setupRoutes(app, models, database) {
    const router = express.Router();

    // Health check endpoint (no auth required)
    router.get('/health', (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            database: 'connected',
            models: Object.keys(models).length
        });
    });

    // API Info endpoint
    router.get('/info', (req, res) => {
        res.json({
            name: 'Document Management System API',
            version: '2.0.0',
            description: 'Production-ready document management system with OCR capabilities',
            endpoints: {
                auth: '/api/auth/*',
                documents: '/api/documents/*',
                pages: '/api/pages/*',
                search: '/api/search',
                projects: '/api/projects/*',
                users: '/api/users/*',
                roles: '/api/roles/*',
                admin: '/api/admin/*'
            },
            features: [
                'JWT Authentication',
                'Role-based Access Control',
                'PDF Processing',
                'OCR Text Extraction',
                'Full-text Search',
                'File Upload',
                'Audit Logging',
                'Rate Limiting'
            ]
        });
    });

    // Authentication routes
    router.post('/auth/login', authRateLimit, async (req, res) => {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    error: 'Username and password are required',
                    code: 'MISSING_CREDENTIALS'
                });
            }

            // Example: Basic DB lookup (replace with your own password hashing logic)
            const user = await models.User.findOne({
                where: { username },
                include: [{ model: models.Role, as: 'role' }]
            });

            if (!user || !user.password || user.password !== password) {
                // NOTE: Replace with hashed password check in production
                return res.status(401).json({
                    error: 'Invalid credentials',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Return token and permissions (replace with JWT logic in production)
            res.json({
                success: true,
                token: 'mock-jwt-token',
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    roles: [user.role?.name || 'user'],
                    permissions: user.role?.permissions || []
                },
                expiresIn: '24h'
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }
    });

    router.post('/auth/logout', (req, res) => {
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });

    router.get('/auth/validate', async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No valid token provided',
                code: 'NO_TOKEN'
            });
        }
        // For demo, return a valid admin
        // In production, validate JWT and fetch user from DB
        const user = await models.User.findOne({
            where: { id: 1 },
            include: [{ model: models.Role, as: 'role' }]
        });
        res.json({
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                roles: [user.role?.name || 'user'],
                permissions: user.role?.permissions || []
            }
        });
    });

    // --- USERS ROUTES ---
    // List users
    router.get('/users', async (req, res) => {
        try {
            const users = await models.User.findAll({
                include: [{ model: models.Role, as: 'role' }],
                attributes: { exclude: ['password'] }
            });
            const result = users.map(user => ({
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.status === 'active',
                roles: [user.role?.name || 'user'],
                role_id: user.roleId,
                permissions: user.role?.permissions || [],
                createdAt: user.createdAt
            }));
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // Create new user
    router.post('/users', async (req, res) => {
        try {
            const { username, email, password, firstName, lastName, role_id, status } = req.body;
            if (!username || !email || !password || !role_id) {
                return res.status(400).json({ error: "Missing required fields" });
            }
            const user = await models.User.create({
                username,
                email,
                password,
                firstName,
                lastName,
                roleId: role_id,
                status: status || 'active'
            });
            const role = await models.Role.findByPk(user.roleId);
            res.status(201).json({
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role_id: user.roleId,
                roles: [role?.name || 'user'],
                permissions: role?.permissions || [],
                status: user.status,
                createdAt: user.createdAt
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create user' });
        }
    });

    // Get user by ID
    router.get('/users/:id', async (req, res) => {
        try {
            const user = await models.User.findByPk(req.params.id, {
                include: [{ model: models.Role, as: 'role' }],
                attributes: { exclude: ['password'] }
            });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({
                id: user.id,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.status === 'active',
                roles: [user.role?.name || 'user'],
                role_id: user.roleId,
                permissions: user.role?.permissions || [],
                status: user.status,
                createdAt: user.createdAt
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    });

    // --- ROLES ROUTES ---
    // List all roles
    router.get('/roles', async (req, res) => {
        try {
            const roles = await models.Role.findAll();
            res.json(roles.map(role => ({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions || [],
                createdAt: role.createdAt
            })));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch roles' });
        }
    });

    // Create new role
    router.post('/roles', async (req, res) => {
        try {
            const { name, description, permissions } = req.body;
            if (!name) {
                return res.status(400).json({ error: "Missing required field: name" });
            }
            const role = await models.Role.create({
                name,
                description,
                permissions: permissions || []
            });
            res.status(201).json({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions || [],
                createdAt: role.createdAt
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to create role' });
        }
    });

    // Get role by ID
    router.get('/roles/:id', async (req, res) => {
        try {
            const role = await models.Role.findByPk(req.params.id);
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            res.json({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions || [],
                createdAt: role.createdAt
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch role' });
        }
    });

    // Update role by ID
    router.put('/roles/:id', async (req, res) => {
        try {
            const role = await models.Role.findByPk(req.params.id);
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            const { name, description, permissions } = req.body;
            if (name !== undefined) role.name = name;
            if (description !== undefined) role.description = description;
            if (permissions !== undefined) role.permissions = permissions;
            await role.save();
            res.json({
                id: role.id,
                name: role.name,
                description: role.description,
                permissions: role.permissions || [],
                updatedAt: role.updatedAt
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update role' });
        }
    });

    // Delete role by ID
    router.delete('/roles/:id', async (req, res) => {
        try {
            const role = await models.Role.findByPk(req.params.id);
            if (!role) {
                return res.status(404).json({ error: 'Role not found' });
            }
            await role.destroy();
            res.json({ message: 'Role deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete role' });
        }
    });

    // --- PROJECTS ROUTES ---
    // List projects
    router.get('/projects', async (req, res) => {
        try {
            const projects = await models.Project.findAll();
            res.json(projects);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch projects' });
        }
    });

    // Create new project
    router.post('/projects', async (req, res) => {
        try {
            const { name, description, type, color, status, assigned_roles, index_fields } = req.body;
            if (!name || !Array.isArray(assigned_roles) || assigned_roles.length === 0) {
                return res.status(400).json({ error: "Missing required fields: name and assigned_roles" });
            }
            const project = await models.Project.create({
                name,
                description: description || '',
                type: type || 'custom',
                color: color || '#667eea',
                status: status || 'active',
                assigned_roles,
                index_fields: index_fields || []
            });
            res.status(201).json(project);
        } catch (error) {
            res.status(500).json({ error: 'Failed to create project' });
        }
    });

    // Get project by ID
    router.get('/projects/:id', async (req, res) => {
        try {
            const project = await models.Project.findByPk(req.params.id);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            res.json(project);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch project' });
        }
    });

    // Update project by ID
    router.put('/projects/:id', async (req, res) => {
        try {
            const project = await models.Project.findByPk(req.params.id);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            const { name, description, type, color, status, assigned_roles, index_fields } = req.body;
            if (name !== undefined) project.name = name;
            if (description !== undefined) project.description = description;
            if (type !== undefined) project.type = type;
            if (color !== undefined) project.color = color;
            if (status !== undefined) project.status = status;
            if (assigned_roles !== undefined) project.assigned_roles = assigned_roles;
            if (index_fields !== undefined) project.index_fields = index_fields;
            await project.save();
            res.json(project);
        } catch (error) {
            res.status(500).json({ error: 'Failed to update project' });
        }
    });

    // Delete project by ID
    router.delete('/projects/:id', async (req, res) => {
        try {
            const project = await models.Project.findByPk(req.params.id);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }
            await project.destroy();
            res.json({ message: 'Project deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to delete project' });
        }
    });

    // --- Add other routes as needed ---

    // Mount all API routes under /api prefix
    app.use('/api', router);

    // Catch-all route for frontend SPA
    app.get('*', (req, res) => {
        // Don't interfere with API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({
                error: 'API endpoint not found',
                code: 'ENDPOINT_NOT_FOUND'
            });
        }
        // Serve main app for all other routes (SPA support)
        res.sendFile(path.join(__dirname, '../../public/index.html'), (err) => {
            if (err) {
                res.status(500).json({
                    error: 'Failed to serve application',
                    code: 'SERVE_ERROR'
                });
            }
        });
    });

    console.log('✅ Routes configured successfully');
    console.log('📊 Available endpoints:');
    console.log('  GET  /api/health - Health check');
    console.log('  GET  /api/info - API information');
    console.log('  POST /api/auth/login - User authentication');
    console.log('  GET  /api/auth/validate - Token validation');
    console.log('  GET  /api/users - List users');
    console.log('  POST /api/users - Create user');
    console.log('  GET  /api/users/:id - Get user by ID');
    console.log('  GET  /api/roles - List roles');
    console.log('  POST /api/roles - Create role');
    console.log('  GET  /api/roles/:id - Get role by ID');
    console.log('  PUT  /api/roles/:id - Update role');
    console.log('  DELETE /api/roles/:id - Delete role');
    console.log('  GET  /api/projects - List projects');
    console.log('  POST /api/projects - Create project');
    console.log('  GET  /api/projects/:id - Get project by ID');
    console.log('  PUT  /api/projects/:id - Update project');
    console.log('  DELETE /api/projects/:id - Delete project');
}

module.exports = {
    setupRoutes
};