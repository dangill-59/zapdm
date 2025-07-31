class BaseModel {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${conditions} LIMIT 1`);
        return stmt.get(...values) || null;
    }

    async findAll({ where } = {}) {
        let rows;
        if (!where) {
            rows = this.db.prepare(`SELECT * FROM ${this.tableName}`).all();
        } else {
            const keys = Object.keys(where);
            const conditions = keys.map(k => `${k} = ?`).join(' AND ');
            const values = keys.map(k => where[k]);
            rows = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${conditions}`).all(...values);
        }
        return rows;
    }

    async update(id, updates) {
        const keys = Object.keys(updates);
        if (!keys.length) return;
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => updates[k]);
        values.push(id);
        const stmt = this.db.prepare(`UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`);
        stmt.run(...values);
    }
}

module.exports = BaseModel;