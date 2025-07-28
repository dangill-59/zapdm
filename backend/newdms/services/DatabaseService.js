// newdms/services/DatabaseService.js
const path = require('path');

class DatabaseService {
    constructor() {
        this.models = null;
        this.database = null;
        this.isConnected = false;
    }

    /**
     * Initialize database connection
     */
    async initialize(database) {
        try {
            this.database = database;
            this.models = database.getModels();
            this.isConnected = true;
            
            console.log('✅ DatabaseService initialized');
            return true;
        } catch (error) {
            console.error('❌ DatabaseService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Create a new document with transaction
     */
    async createDocument(documentData, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const document = await this.models.Document.create({
                ...documentData,
                createdBy: userId,
                updatedBy: userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            console.log(`📄 Document created: ${document.id}`);
            return document;
        } catch (error) {
            console.error('❌ Failed to create document:', error);
            throw error;
        }
    }

    /**
     * Update document
     */
    async updateDocument(documentId, updateData, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const [updatedRowsCount] = await this.models.Document.update({
                ...updateData,
                updatedBy: userId,
                updatedAt: new Date()
            }, {
                where: { id: documentId, deletedAt: null }
            });

            if (updatedRowsCount === 0) {
                throw new Error('Document not found or already deleted');
            }

            const updatedDocument = await this.models.Document.findByPk(documentId);
            console.log(`📝 Document updated: ${documentId}`);
            return updatedDocument;
        } catch (error) {
            console.error(`❌ Failed to update document ${documentId}:`, error);
            throw error;
        }
    }

    /**
     * Soft delete document
     */
    async deleteDocument(documentId, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const [updatedRowsCount] = await this.models.Document.update({
                deletedAt: new Date(),
                deletedBy: userId
            }, {
                where: { id: documentId, deletedAt: null }
            });

            if (updatedRowsCount === 0) {
                throw new Error('Document not found or already deleted');
            }

            // Also soft delete associated pages
            await this.models.Page.update({
                deletedAt: new Date(),
                deletedBy: userId
            }, {
                where: { documentId: documentId, deletedAt: null }
            });

            console.log(`🗑️ Document soft deleted: ${documentId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete document ${documentId}:`, error);
            throw error;
        }
    }

    /**
     * Create a new page
     */
    async createPage(pageData, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const page = await this.models.Page.create({
                ...pageData,
                createdBy: userId,
                updatedBy: userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            console.log(`📄 Page created: ${page.id} for document ${page.documentId}`);
            return page;
        } catch (error) {
            console.error('❌ Failed to create page:', error);
            throw error;
        }
    }

    /**
     * Update page
     */
    async updatePage(pageId, updateData, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const [updatedRowsCount] = await this.models.Page.update({
                ...updateData,
                updatedBy: userId,
                updatedAt: new Date()
            }, {
                where: { id: pageId, deletedAt: null }
            });

            if (updatedRowsCount === 0) {
                throw new Error('Page not found or already deleted');
            }

            const updatedPage = await this.models.Page.findByPk(pageId);
            console.log(`📝 Page updated: ${pageId}`);
            return updatedPage;
        } catch (error) {
            console.error(`❌ Failed to update page ${pageId}:`, error);
            throw error;
        }
    }

    /**
     * Soft delete page
     */
    async deletePage(pageId, userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const [updatedRowsCount] = await this.models.Page.update({
                deletedAt: new Date(),
                deletedBy: userId
            }, {
                where: { id: pageId, deletedAt: null }
            });

            if (updatedRowsCount === 0) {
                throw new Error('Page not found or already deleted');
            }

            console.log(`🗑️ Page soft deleted: ${pageId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete page ${pageId}:`, error);
            throw error;
        }
    }

    /**
     * Get document with pages
     */
    async getDocumentWithPages(documentId, includeDeleted = false) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const whereClause = { id: documentId };
            if (!includeDeleted) {
                whereClause.deletedAt = null;
            }

            const document = await this.models.Document.findOne({
                where: whereClause,
                include: [{
                    model: this.models.Page,
                    as: 'pages',
                    where: includeDeleted ? {} : { deletedAt: null },
                    required: false,
                    order: [['pageNumber', 'ASC']]
                }, {
                    model: this.models.Project,
                    as: 'project',
                    attributes: ['id', 'name', 'description']
                }]
            });

            return document;
        } catch (error) {
            console.error(`❌ Failed to get document ${documentId}:`, error);
            throw error;
        }
    }

    /**
     * Search documents using full-text search
     */
    async searchDocuments(query, userId, options = {}) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const {
                limit = 50,
                offset = 0,
                projectId = null,
                includePages = false
            } = options;

            // Build search conditions
            const whereConditions = {
                deletedAt: null
            };

            if (projectId) {
                whereConditions.projectId = projectId;
            }

            // If we have a search query, use FTS
            let searchResults;
            if (query && query.trim()) {
                // Use raw SQL for FTS search
                const searchQuery = `
                    SELECT DISTINCT d.id, d.*, 
                           snippet(documents_fts, 0, '<mark>', '</mark>', '...', 20) as snippet
                    FROM documents_fts 
                    JOIN documents d ON documents_fts.rowid = d.id
                    WHERE documents_fts MATCH ? 
                    AND d.deletedAt IS NULL
                    ${projectId ? 'AND d.projectId = ?' : ''}
                    ORDER BY rank
                    LIMIT ? OFFSET ?
                `;

                const params = [query];
                if (projectId) params.push(projectId);
                params.push(limit, offset);

                const [results] = await this.database.sequelize.query(searchQuery, {
                    replacements: params,
                    type: this.database.sequelize.QueryTypes.SELECT
                });

                searchResults = results;
            } else {
                // Regular query without FTS
                searchResults = await this.models.Document.findAll({
                    where: whereConditions,
                    limit,
                    offset,
                    order: [['updatedAt', 'DESC']],
                    include: includePages ? [{
                        model: this.models.Page,
                        as: 'pages',
                        where: { deletedAt: null },
                        required: false
                    }] : []
                });
            }

            console.log(`🔍 Search completed: ${searchResults.length} results`);
            return searchResults;

        } catch (error) {
            console.error('❌ Search failed:', error);
            throw error;
        }
    }

    /**
     * Get user's accessible projects
     */
    async getUserProjects(userId) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const user = await this.models.User.findByPk(userId, {
                include: [{
                    model: this.models.Project,
                    as: 'projects',
                    through: { attributes: [] }, // Exclude junction table data
                    where: { deletedAt: null },
                    required: false
                }]
            });

            return user ? user.projects : [];
        } catch (error) {
            console.error(`❌ Failed to get projects for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Create audit log entry
     */
    async createAuditLog(auditData) {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const auditLog = await this.models.AuditLog.create({
                ...auditData,
                createdAt: new Date()
            });

            return auditLog;
        } catch (error) {
            console.error('❌ Failed to create audit log:', error);
            // Don't throw error for audit logs to avoid affecting main operations
            return null;
        }
    }

    /**
     * Get database statistics
     */
    async getStatistics() {
        if (!this.isConnected) {
            throw new Error('Database not connected');
        }

        try {
            const stats = await Promise.all([
                this.models.Document.count({ where: { deletedAt: null } }),
                this.models.Page.count({ where: { deletedAt: null } }),
                this.models.User.count({ where: { deletedAt: null } }),
                this.models.Project.count({ where: { deletedAt: null } })
            ]);

            return {
                documents: stats[0],
                pages: stats[1],
                users: stats[2],
                projects: stats[3],
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Failed to get database statistics:', error);
            throw error;
        }
    }

    /**
     * Health check
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', error: 'Database not connected' };
            }

            // Test with a simple query
            await this.database.sequelize.authenticate();
            
            return { 
                status: 'healthy', 
                connected: true,
                models: Object.keys(this.models).length,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { 
                status: 'error', 
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Close database connections
     */
    async close() {
        try {
            if (this.database && this.database.sequelize) {
                await this.database.sequelize.close();
                this.isConnected = false;
                console.log('✅ Database connections closed');
            }
        } catch (error) {
            console.error('❌ Error closing database:', error);
            throw error;
        }
    }

    /**
     * Get models
     */
    getModels() {
        return this.models;
    }

    /**
     * Get database instance
     */
    getDatabase() {
        return this.database;
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.isConnected;
    }
}

// Export singleton instance
module.exports = new DatabaseService();