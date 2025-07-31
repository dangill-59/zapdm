// server.js - Production-Ready Document Management System Server
// Fully refactored with modular architecture, comprehensive middleware, and security

const express = require('express');
const path = require('path');
const { createServer } = require('http');

// Import configurations
const { 
    NODE_ENV,
    PORT, 
    UPLOAD_DIR, 
    IMAGE_DIR,
    MAX_FILE_SIZE 
} = require('./newdms/config/environment');

// Import services
const { 
    FileService, 
    OCRService, 
    DatabaseService,
    AuditService 
} = require('./newdms/services');

// Import database
const database = require('./newdms/database');

// Import routes
const { setupRoutes } = require('./newdms/routes');

// Import middleware
const {
    // Security middleware
    securityHeaders,
    generalRateLimit,
    corsMiddleware,
    
    // Logging middleware
    requestLogger,
    errorLogger,
    
    // Error handling middleware
    notFound,
    errorHandler,
    
    // Static file middleware
    configureStaticFiles
} = require('./newdms/middleware');

/**
 * Document Management System Server
 * Modular architecture with clean separation of concerns
 */
class DMSServer {
    constructor() {
        this.app = express();
        this.server = null;
        this.models = null;
        this.isShuttingDown = false;
    }

    /**
     * Configure application middleware in correct order
     */
    configureMiddleware() {
        // Trust proxy for accurate IP addresses
        this.app.set('trust proxy', 1);

        // Security middleware (first)
        this.app.use(securityHeaders);
        this.app.use(generalRateLimit);

        // CORS configuration
        this.app.use(corsMiddleware);

        // Request logging
        if (NODE_ENV !== 'test') {
            this.app.use(requestLogger);
        }

        // Body parsing middleware
        this.app.use(express.json({ 
            limit: '50mb',
            verify: (req, res, buf) => {
                // Store raw body for signature verification if needed
                req.rawBody = buf;
            }
        }));
        
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '50mb' 
        }));

        // Static file serving
        configureStaticFiles(this.app);

   // Temporary: Skip database, just serve static files from root public folder
//this.app.use(express.static('../public'));

console.log('✅ Static file serving configured from ../public');

        console.log('✅ Middleware configured successfully');
    }

    /**
     * Initialize all services
     */
    async initializeServices() {
        try {
            console.log('🔄 Initializing services...');

            // Initialize file storage directories
            await FileService.initializeUploadDirectories();
            console.log('📁 File storage directories initialized');

            // Initialize database
            await database.initialize();
            this.models = database.getModels();
            console.log('🗄️ Database initialized and models loaded');

            // Check OCR service availability
            await OCRService.checkOCRAvailability();
            console.log('🔍 OCR service verified and ready');

            // Initialize audit service
            await AuditService.initialize(this.models);
            console.log('📝 Audit service initialized');

            console.log('✅ All services initialized successfully');
            
        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup application routes
     */
    setupRoutes() {
        try {
            // Attach models and database to request context
            this.app.use((req, res, next) => {
                req.models = this.models;
                req.database = database;
                next();
            });

            // Setup all API routes
            setupRoutes(this.app, this.models, database);
            console.log('🗺️ Routes configured successfully');

            // Error handling middleware (must be last)
            if (NODE_ENV !== 'test') {
                this.app.use(errorLogger);
            }
            this.app.use(notFound);
            this.app.use(errorHandler);
            console.log('🛡️ Error handling middleware configured');

        } catch (error) {
            console.error('❌ Route setup failed:', error);
            throw error;
        }
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const gracefulShutdown = async (signal) => {
            if (this.isShuttingDown) {
                console.log('🔄 Shutdown already in progress...');
                return;
            }

            this.isShuttingDown = true;
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

            // Stop accepting new connections
            if (this.server) {
                this.server.close(async () => {
                    console.log('🔐 HTTP server closed');

                    try {
                        // Close database connections
                        await database.close();
                        console.log('🗄️ Database connections closed');

                        // Additional cleanup if needed
                        console.log('✅ Graceful shutdown completed');
                        process.exit(0);
                        
                    } catch (error) {
                        console.error('❌ Error during shutdown:', error);
                        process.exit(1);
                    }
                });

                // Force shutdown after 30 seconds
                setTimeout(() => {
                    console.error('⏰ Forced shutdown after timeout');
                    process.exit(1);
                }, 30000);
            }
        };

        // Handle different shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error);
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            gracefulShutdown('unhandledRejection');
        });
    }

    /**
     * Display comprehensive startup information
     */
    displayStartupInfo() {
        const divider = '='.repeat(80);
        const subDivider = '-'.repeat(60);
        
        console.log(`\n${divider}`);
        console.log('🚀 DOCUMENT MANAGEMENT SYSTEM - SERVER STARTED');
        console.log(`${divider}`);
        
        // Environment info
        console.log('\n📊 ENVIRONMENT INFORMATION');
        console.log(`${subDivider}`);
        console.log(`Environment: ${NODE_ENV}`);
        console.log(`Server Port: ${PORT}`);
        console.log(`Upload Directory: ${path.resolve(UPLOAD_DIR)}`);
        console.log(`Image Directory: ${path.resolve(IMAGE_DIR)}`);
        console.log(`Max File Size: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
        console.log(`Process ID: ${process.pid}`);
        console.log(`Node Version: ${process.version}`);
        
        // URLs
        console.log('\n🌐 ACCESS URLS');
        console.log(`${subDivider}`);
        console.log(`Frontend: http://localhost:${PORT}`);
        console.log(`Admin Panel: http://localhost:${PORT}/admin`);
        console.log(`API Base: http://localhost:${PORT}/api`);
        console.log(`Health Check: http://localhost:${PORT}/api/health`);
        
        // Features
        console.log('\n🎯 ENABLED FEATURES');
        console.log(`${subDivider}`);
        console.log('✅ JWT Authentication & Authorization');
        console.log('✅ Role-based Access Control');
        console.log('✅ PDF Page Splitting & Processing');
        console.log('✅ OCR Text Extraction (Tesseract.js)');
        console.log('✅ Full-text Search (SQLite FTS5)');
        console.log('✅ Document Field Editing');
        console.log('✅ Soft Delete with Audit Trail');
        console.log('✅ Page Drag & Drop Reordering');
        console.log('✅ Thumbnail Generation');
        console.log('✅ File Upload with Validation');
        console.log('✅ Request Rate Limiting');
        console.log('✅ Security Headers');
        console.log('✅ Comprehensive Logging');
        console.log('✅ Graceful Shutdown');
        
        // API Endpoints
        console.log('\n🔌 MAIN API ENDPOINTS');
        console.log(`${subDivider}`);
        console.log('Auth:');
        console.log('  POST /api/auth/login - User authentication');
        console.log('  GET  /api/auth/validate - Token validation');
        console.log('  POST /api/auth/logout - User logout');
        
        console.log('Documents:');
        console.log('  POST /api/documents/:id/pages - Upload files with OCR');
        console.log('  GET  /api/documents/:id - Get document details');
        console.log('  PUT  /api/documents/:id - Update document');
        console.log('  DELETE /api/documents/:id - Soft delete document');
        
        console.log('Pages:');
        console.log('  GET  /api/pages/:id/content - Get page image');
        console.log('  GET  /api/pages/:id/thumbnail - Get page thumbnail');
        console.log('  GET  /api/pages/:id/ocr - Get OCR text');
        console.log('  POST /api/pages/:id/ocr - Process OCR');
        console.log('  DELETE /api/pages/:id - Soft delete page');
        
        console.log('Search & Management:');
        console.log('  GET  /api/search?q=query - Full-text search');
        console.log('  GET  /api/projects - List accessible projects');
        console.log('  GET  /api/users - List users (admin only)');
        console.log('  GET  /api/roles - List roles (admin only)');
        
        // Architecture info
        console.log('\n🏗️ ARCHITECTURE');
        console.log(`${subDivider}`);
        console.log('✅ Modular Design - Clean separation of concerns');
        console.log('✅ Configuration Layer - Environment-based config');
        console.log('✅ Database Layer - Models with relationships');
        console.log('✅ Services Layer - Business logic separation');
        console.log('✅ Middleware Layer - Security & validation');
        console.log('✅ Routes Layer - API endpoint organization');
        console.log('✅ Error Handling - Comprehensive error management');
        
        // Default credentials
        console.log('\n🔐 DEFAULT CREDENTIALS');
        console.log(`${subDivider}`);
        console.log('Admin Username: admin');
        console.log('Admin Password: admin123');
        console.log('⚠️  Change default credentials in production!');
        
        console.log(`\n${divider}`);
        console.log('🎉 SERVER READY - Document Management System is operational!');
        console.log(`${divider}\n`);
    }

    /**
     * Start the server
     */
    async start() {
        try {
            console.log('🚀 Starting Document Management System...');
            
            // Configure middleware
            this.configureMiddleware();
            
            // Initialize services
            await this.initializeServices();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup graceful shutdown
            this.setupGracefulShutdown();
            
            // Create HTTP server
            this.server = createServer(this.app);
            
            // Start listening
            this.server.listen(PORT, () => {
                this.displayStartupInfo();
            });

            // Handle server errors
            this.server.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`❌ Port ${PORT} is already in use`);
                } else {
                    console.error('❌ Server error:', error);
                }
                process.exit(1);
            });

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Get Express app instance (useful for testing)
     */
    getApp() {
        return this.app;
    }

    /**
     * Get server instance
     */
    getServer() {
        return this.server;
    }
}

// Create and start server instance
const dmsServer = new DMSServer();

// Start server only if not in test environment
if (NODE_ENV !== 'test') {
    dmsServer.start().catch((error) => {
        console.error('💥 Server startup failed:', error);
        process.exit(1);
    });
}

// Export for testing
module.exports = dmsServer;