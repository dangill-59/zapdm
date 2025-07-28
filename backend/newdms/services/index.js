// newdms/services/index.js
// Export all services from a central location

const FileService = require('./FileService');
const OCRService = require('./OCRService');
const DatabaseService = require('./DatabaseService');
const AuditService = require('./AuditService');

module.exports = {
    FileService,
    OCRService,
    DatabaseService,
    AuditService
};