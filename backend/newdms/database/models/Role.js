class Role {
    constructor(db) {
        this.db = db;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM roles WHERE ${conditions} LIMIT 1`);
        return stmt.get(...values) || null;
    }

    async findOrCreate({ where, defaults }) {
        let role = await this.findOne({ where });
        if (role) return [role, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        const stmt = this.db.prepare(
            `INSERT INTO roles (name, description, permissions, status, created_by)
             VALUES (?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.name,
            data.description,
            JSON.stringify(data.permissions),
            data.status,
            data.createdBy
        );
        return { id: info.lastInsertRowid, ...data };
    }

    async update(id, updates) {
        const keys = Object.keys(updates);
        if (!keys.length) return;
        const setClause = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => updates[k]);
        values.push(id);
        const stmt = this.db.prepare(`UPDATE roles SET ${setClause} WHERE id = ?`);
        stmt.run(...values);
    }

    async findAll({ where }) {
        if (!where) {
            return this.db.prepare(`SELECT * FROM roles`).all();
        }
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        return this.db.prepare(`SELECT * FROM roles WHERE ${conditions}`).all(...values);
    }

    async bulkCreate(roles) {
        const stmt = this.db.prepare(
            `INSERT INTO roles (name, description, permissions, status, created_by)
             VALUES (?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((roles) => {
            for (const r of roles) {
                stmt.run(
                    r.name,
                    r.description,
                    JSON.stringify(r.permissions),
                    r.status,
                    r.createdBy
                );
            }
        });
        insertMany(roles);
    }
}

module.exports = Role;