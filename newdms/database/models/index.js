const User = require('./User');
const Role = require('./Role');
const Project = require('./Project');
const Document = require('./Document');
const DocumentPage = require('./DocumentPage');

class Models {
    constructor(db) {
        this.db = db;
        this.Role = new Role(db);
        this.User = new User(db, this.Role);
        this.Project = new Project(db);
        this.Document = new Document(db);
        this.DocumentPage = new DocumentPage(db);
        // Add more models as needed
    }

    // Utility methods (optional)
    createAuditLog(userId, action, tableName, recordId, details, ipAddress = null) {
        return this.db.prepare(`
            INSERT INTO audit_logs (userId, action, tableName, recordId, details, ipAddress) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, action, tableName, recordId, details, ipAddress);
    }
}

module.exports = Models;