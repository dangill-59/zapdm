// src/database/models/BaseModel.js
const { STATUS } = require('../../config/constants');

class BaseModel {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    // Generic CRUD operations
    findById(id) {
        return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id);
    }

    findAll(conditions = {}) {
        let query = `SELECT * FROM ${this.tableName}`;
        const params = [];
        
        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map(key => `${key} = ?`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
            params.push(...Object.values(conditions));
        }
        
        return this.db.prepare(query).all(...params);
    }

    create(data) {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        
        const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
        const result = this.db.prepare(query).run(...values);
        
        return { id: result.lastInsertRowid, changes: result.changes };
    }

    update(id, data) {
        const setClause = Object.keys(data)
            .map(key => `${key} = ?`)
            .join(', ');
        const values = [...Object.values(data), id];
        
        const query = `UPDATE ${this.tableName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
        const result = this.db.prepare(query).run(...values);
        
        return { changes: result.changes };
    }

    delete(id) {
        const result = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
        return { changes: result.changes };
    }

    softDelete(id) {
        const result = this.db.prepare(`
            UPDATE ${this.tableName} 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(STATUS.DELETED, id);
        
        return { changes: result.changes };
    }

    count(conditions = {}) {
        let query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const params = [];
        
        if (Object.keys(conditions).length > 0) {
            const whereClause = Object.keys(conditions)
                .map(key => `${key} = ?`)
                .join(' AND ');
            query += ` WHERE ${whereClause}`;
            params.push(...Object.values(conditions));
        }
        
        return this.db.prepare(query).get(...params).count;
    }

    exists(conditions) {
        return this.count(conditions) > 0;
    }
}

module.exports = BaseModel;