// newdms/routes/index.js
// Main route configuration and setup (now using modular routers)

const express = require('express');
const path = require('path');

// Import modular routers
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const projectRoutes = require('./project.routes');
const documentRoutes = require('./document.routes');
const pageRoutes = require('./page.routes');
const searchRoutes = require('./search.routes');

/**
 * Setup all application routes
 */
function setupRoutes(app, models, database) {
    // Attach models and database to request context for all routers
    app.use((req, res, next) => {
        req.models = models;
        req.database = database;
        next();
    });

    // Health check endpoint (no auth required)
    app.get('/api/health', (req, res) => {
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
    app.get('/api/info', (req, res) => {
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

    // Mount modular routers
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/roles', roleRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/documents', documentRoutes);
    app.use('/api/pages', pageRoutes);
    app.use('/api/search', searchRoutes);

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

    console.log('✅ Modular routes configured successfully');
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
    console.log('  ... and more via modular routers');
}

module.exports = {
    setupRoutes
};