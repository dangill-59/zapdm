// newdms/services/AuditService.js

class AuditService {
    constructor() {
        this.models = null;
        this.isInitialized = false;
    }

    /**
     * Initialize audit service with database models
     */
    async initialize(models) {
        try {
            this.models = models;
            this.isInitialized = true;
            console.log('✅ AuditService initialized');
            return true;
        } catch (error) {
            console.error('❌ AuditService initialization failed:', error);
            throw error;
        }
    }

    /**
     * Log user action
     */
    async logAction(action, details = {}) {
        if (!this.isInitialized) {
            console.warn('⚠️ AuditService not initialized, skipping audit log');
            return null;
        }

        try {
            const auditData = {
                action: action.action || action,
                entityType: action.entityType || details.entityType || 'unknown',
                entityId: action.entityId || details.entityId || null,
                userId: action.userId || details.userId || null,
                ipAddress: action.ipAddress || details.ipAddress || null,
                userAgent: action.userAgent || details.userAgent || null,
                details: JSON.stringify({
                    ...details,
                    timestamp: new Date().toISOString()
                }),
                createdAt: new Date()
            };

            const auditLog = await this.models.AuditLog.create(auditData);
            
            // Only log to console in development
            if (process.env.NODE_ENV === 'development') {
                console.log(`📝 Audit: ${auditData.action} - ${auditData.entityType}:${auditData.entityId} by user:${auditData.userId}`);
            }

            return auditLog;

        } catch (error) {
            console.error('❌ Failed to create audit log:', error);
            // Don't throw error to avoid affecting main operations
            return null;
        }
    }

    /**
     * Log authentication events
     */
    async logAuth(action, userId, ipAddress, userAgent, details = {}) {
        return this.logAction({
            action: `auth.${action}`,
            entityType: 'user',
            entityId: userId,
            userId: userId,
            ipAddress,
            userAgent
        }, {
            ...details,
            category: 'authentication'
        });
    }

    /**
     * Log document operations
     */
    async logDocument(action, documentId, userId, ipAddress, details = {}) {
        return this.logAction({
            action: `document.${action}`,
            entityType: 'document',
            entityId: documentId,
            userId,
            ipAddress
        }, {
            ...details,
            category: 'document'
        });
    }

    /**
     * Log page operations
     */
    async logPage(action, pageId, userId, ipAddress, details = {}) {
        return this.logAction({
            action: `page.${action}`,
            entityType: 'page',
            entityId: pageId,
            userId,
            ipAddress
        }, {
            ...details,
            category: 'page'
        });
    }

    /**
     * Log search operations
     */
    async logSearch(query, userId, ipAddress, results = 0, details = {}) {
        return this.logAction({
            action: 'search.query',
            entityType: 'search',
            entityId: null,
            userId,
            ipAddress
        }, {
            query,
            resultCount: results,
            ...details,
            category: 'search'
        });
    }

    /**
     * Log file operations
     */
    async logFile(action, filename, userId, ipAddress, details = {}) {
        return this.logAction({
            action: `file.${action}`,
            entityType: 'file',
            entityId: filename,
            userId,
            ipAddress
        }, {
            filename,
            ...details,
            category: 'file'
        });
    }

    /**
     * Log admin operations
     */
    async logAdmin(action, targetUserId, adminUserId, ipAddress, details = {}) {
        return this.logAction({
            action: `admin.${action}`,
            entityType: 'user',
            entityId: targetUserId,
            userId: adminUserId,
            ipAddress
        }, {
            targetUserId,
            adminUserId,
            ...details,
            category: 'administration'
        });
    }

    /**
     * Log system events
     */
    async logSystem(action, details = {}) {
        return this.logAction({
            action: `system.${action}`,
            entityType: 'system',
            entityId: null,
            userId: null,
            ipAddress: null
        }, {
            ...details,
            category: 'system'
        });
    }

    /**
     * Get audit logs with filtering
     */
    async getAuditLogs(filters = {}) {
        if (!this.isInitialized) {
            throw new Error('AuditService not initialized');
        }

        try {
            const {
                limit = 100,
                offset = 0,
                userId = null,
                action = null,
                entityType = null,
                entityId = null,
                startDate = null,
                endDate = null,
                ipAddress = null
            } = filters;

            const whereConditions = {};

            if (userId) whereConditions.userId = userId;
            if (action) whereConditions.action = { [this.models.Sequelize.Op.like]: `%${action}%` };
            if (entityType) whereConditions.entityType = entityType;
            if (entityId) whereConditions.entityId = entityId;
            if (ipAddress) whereConditions.ipAddress = ipAddress;

            if (startDate && endDate) {
                whereConditions.createdAt = {
                    [this.models.Sequelize.Op.between]: [new Date(startDate), new Date(endDate)]
                };
            } else if (startDate) {
                whereConditions.createdAt = {
                    [this.models.Sequelize.Op.gte]: new Date(startDate)
                };
            } else if (endDate) {
                whereConditions.createdAt = {
                    [this.models.Sequelize.Op.lte]: new Date(endDate)
                };
            }

            const auditLogs = await this.models.AuditLog.findAndCountAll({
                where: whereConditions,
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                include: [{
                    model: this.models.User,
                    as: 'user',
                    attributes: ['id', 'username', 'email'],
                    required: false
                }]
            });

            return auditLogs;

        } catch (error) {
            console.error('❌ Failed to get audit logs:', error);
            throw error;
        }
    }

    /**
     * Get audit statistics
     */
    async getAuditStatistics(timeframe = '24h') {
        if (!this.isInitialized) {
            throw new Error('AuditService not initialized');
        }

        try {
            let startDate;
            const now = new Date();

            switch (timeframe) {
                case '1h':
                    startDate = new Date(now.getTime() - (60 * 60 * 1000));
                    break;
                case '24h':
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
                    break;
                case '7d':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                    break;
                case '30d':
                    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                    break;
                default:
                    startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            }

            const [totalLogs, authEvents, documentEvents, searchEvents, errorEvents] = await Promise.all([
                this.models.AuditLog.count({
                    where: {
                        createdAt: { [this.models.Sequelize.Op.gte]: startDate }
                    }
                }),
                this.models.AuditLog.count({
                    where: {
                        action: { [this.models.Sequelize.Op.like]: 'auth.%' },
                        createdAt: { [this.models.Sequelize.Op.gte]: startDate }
                    }
                }),
                this.models.AuditLog.count({
                    where: {
                        action: { [this.models.Sequelize.Op.like]: 'document.%' },
                        createdAt: { [this.models.Sequelize.Op.gte]: startDate }
                    }
                }),
                this.models.AuditLog.count({
                    where: {
                        action: { [this.models.Sequelize.Op.like]: 'search.%' },
                        createdAt: { [this.models.Sequelize.Op.gte]: startDate }
                    }
                }),
                this.models.AuditLog.count({
                    where: {
                        action: { [this.models.Sequelize.Op.like]: '%error%' },
                        createdAt: { [this.models.Sequelize.Op.gte]: startDate }
                    }
                })
            ]);

            return {
                timeframe,
                startDate: startDate.toISOString(),
                endDate: now.toISOString(),
                totalLogs,
                authEvents,
                documentEvents,
                searchEvents,
                errorEvents,
                generatedAt: now.toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to get audit statistics:', error);
            throw error;
        }
    }

    /**
     * Clean old audit logs (for maintenance)
     */
    async cleanOldLogs(retentionDays = 90) {
        if (!this.isInitialized) {
            throw new Error('AuditService not initialized');
        }

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            const deletedCount = await this.models.AuditLog.destroy({
                where: {
                    createdAt: { [this.models.Sequelize.Op.lt]: cutoffDate }
                }
            });

            console.log(`🧹 Cleaned ${deletedCount} audit logs older than ${retentionDays} days`);
            
            // Log the cleanup operation
            await this.logSystem('audit_cleanup', {
                deletedCount,
                retentionDays,
                cutoffDate: cutoffDate.toISOString()
            });

            return deletedCount;

        } catch (error) {
            console.error('❌ Failed to clean old audit logs:', error);
            throw error;
        }
    }

    /**
     * Export audit logs to CSV format
     */
    async exportAuditLogs(filters = {}) {
        if (!this.isInitialized) {
            throw new Error('AuditService not initialized');
        }

        try {
            // Remove pagination for export
            const exportFilters = { ...filters, limit: null, offset: null };
            const { rows: auditLogs } = await this.getAuditLogs(exportFilters);

            const csvData = auditLogs.map(log => ({
                timestamp: log.createdAt.toISOString(),
                action: log.action,
                entityType: log.entityType,
                entityId: log.entityId || '',
                userId: log.userId || '',
                username: log.user ? log.user.username : '',
                ipAddress: log.ipAddress || '',
                userAgent: log.userAgent || '',
                details: log.details || ''
            }));

            return csvData;

        } catch (error) {
            console.error('❌ Failed to export audit logs:', error);
            throw error;
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            hasModels: !!this.models,
            modelCount: this.models ? Object.keys(this.models).length : 0
        };
    }
}

// Export singleton instance
module.exports = new AuditService();