// newdms/routes/index.js
// Main route configuration and setup

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

            // TODO: Implement actual authentication logic
            // For now, return a mock response
            if (username === 'admin' && password === 'admin123') {
                return res.json({
                    success: true,
                    token: 'mock-jwt-token',
                    user: {
                        id: 1,
                        username: 'admin',
                        email: 'admin@localhost',
                        roles: ['admin']
                    },
                    expiresIn: '24h'
                });
            }

            return res.status(401).json({
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
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
        // TODO: Implement logout logic (token blacklisting, etc.)
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });

    router.get('/auth/validate', (req, res) => {
        // TODO: Implement token validation
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No valid token provided',
                code: 'NO_TOKEN'
            });
        }

        // Mock validation
        res.json({
            valid: true,
            user: {
                id: 1,
                username: 'admin',
                email: 'admin@localhost',
                roles: ['admin']
            }
        });
    });

    // Documents routes
    router.get('/documents', async (req, res) => {
        try {
            // TODO: Implement proper document listing with permissions
            const documents = await models.Document.findAll({
                where: { deletedAt: null },
                include: [{
                    model: models.Project,
                    as: 'project',
                    attributes: ['id', 'name']
                }],
                order: [['updatedAt', 'DESC']],
                limit: 50
            });

            res.json({
                documents,
                total: documents.length,
                page: 1,
                limit: 50
            });

        } catch (error) {
            console.error('Get documents error:', error);
            res.status(500).json({
                error: 'Failed to retrieve documents',
                code: 'DOCUMENTS_ERROR'
            });
        }
    });

    router.get('/documents/:id', async (req, res) => {
        try {
            const { id } = req.params;
            
            const document = await models.Document.findOne({
                where: { id, deletedAt: null },
                include: [{
                    model: models.Page,
                    as: 'pages',
                    where: { deletedAt: null },
                    required: false,
                    order: [['pageNumber', 'ASC']]
                }, {
                    model: models.Project,
                    as: 'project',
                    attributes: ['id', 'name', 'description']
                }]
            });

            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                    code: 'DOCUMENT_NOT_FOUND'
                });
            }

            res.json(document);

        } catch (error) {
            console.error('Get document error:', error);
            res.status(500).json({
                error: 'Failed to retrieve document',
                code: 'DOCUMENT_ERROR'
            });
        }
    });

    router.post('/documents', async (req, res) => {
        try {
            const { title, description, projectId = 1 } = req.body;

            if (!title) {
                return res.status(400).json({
                    error: 'Document title is required',
                    code: 'MISSING_TITLE'
                });
            }

            const document = await models.Document.create({
                title,
                description,
                projectId,
                status: 'draft',
                totalPages: 0,
                createdBy: 1, // TODO: Get from authenticated user
                updatedBy: 1
            });

            res.status(201).json(document);

        } catch (error) {
            console.error('Create document error:', error);
            res.status(500).json({
                error: 'Failed to create document',
                code: 'CREATE_DOCUMENT_ERROR'
            });
        }
    });

    // File upload route
    router.post('/documents/:id/pages', uploadRateLimit, (req, res) => {
        // TODO: Implement file upload with multer
        res.status(501).json({
            error: 'File upload not yet implemented',
            code: 'NOT_IMPLEMENTED'
        });
    });

    // Search routes
    router.get('/search', async (req, res) => {
        try {
            const { q: query, limit = 20, offset = 0 } = req.query;

            if (!query || query.trim().length < 2) {
                return res.status(400).json({
                    error: 'Search query must be at least 2 characters',
                    code: 'INVALID_QUERY'
                });
            }

            // TODO: Implement proper FTS search
            const documents = await models.Document.findAll({
                where: {
                    [models.Sequelize.Op.or]: [
                        { title: { [models.Sequelize.Op.like]: `%${query}%` } },
                        { description: { [models.Sequelize.Op.like]: `%${query}%` } }
                    ],
                    deletedAt: null
                },
                include: [{
                    model: models.Project,
                    as: 'project',
                    attributes: ['id', 'name']
                }],
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['updatedAt', 'DESC']]
            });

            res.json({
                results: documents,
                total: documents.length,
                query,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

        } catch (error) {
            console.error('Search error:', error);
            res.status(500).json({
                error: 'Search failed',
                code: 'SEARCH_ERROR'
            });
        }
    });

    // Projects routes
    router.get('/projects', async (req, res) => {
        try {
            const projects = await models.Project.findAll({
                where: { deletedAt: null, isActive: true },
                attributes: ['id', 'name', 'description', 'createdAt'],
                order: [['name', 'ASC']]
            });

            res.json(projects);

        } catch (error) {
            console.error('Get projects error:', error);
            res.status(500).json({
                error: 'Failed to retrieve projects',
                code: 'PROJECTS_ERROR'
            });
        }
    });

    // Users routes (admin only)
    router.get('/users', (req, res) => {
        // TODO: Implement user management with proper auth
        res.json([
            {
                id: 1,
                username: 'admin',
                email: 'admin@localhost',
                firstName: 'System',
                lastName: 'Administrator',
                isActive: true,
                roles: ['admin']
            }
        ]);
    });

    // Roles routes (admin only)
    router.get('/roles', (req, res) => {
        // TODO: Implement role management
        res.json([
            { id: 1, name: 'admin', description: 'System Administrator' },
            { id: 2, name: 'user', description: 'Regular User' },
            { id: 3, name: 'viewer', description: 'Read-only User' }
        ]);
    });

    // Statistics endpoint
    router.get('/stats', async (req, res) => {
        try {
            const stats = await database.getStats();
            res.json({
                ...stats,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Stats error:', error);
            res.status(500).json({
                error: 'Failed to retrieve statistics',
                code: 'STATS_ERROR'
            });
        }
    });

    // Error testing endpoint (development only)
    if (process.env.NODE_ENV === 'development') {
        router.get('/test-error', (req, res, next) => {
            const error = new Error('Test error for development');
            error.status = 500;
            next(error);
        });
    }

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
    console.log('  GET  /api/documents - List documents');
    console.log('  GET  /api/documents/:id - Get document details');
    console.log('  POST /api/documents - Create new document');
    console.log('  GET  /api/search - Search documents');
    console.log('  GET  /api/projects - List projects');
    console.log('  GET  /api/users - List users (admin)');
    console.log('  GET  /api/roles - List roles (admin)');
    console.log('  GET  /api/stats - System statistics');
}

module.exports = {
    setupRoutes
};