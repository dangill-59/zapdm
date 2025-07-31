class Role {
    constructor(db) {
        this.db = db;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM roles WHERE ${conditions} LIMIT 1`);
        const role = stmt.get(...values) || null;
        if (role && typeof role.permissions === 'string') {
            try { role.permissions = JSON.parse(role.permissions); } catch { role.permissions = []; }
        }
        return role;
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
            `INSERT INTO roles (name, description, permissions, status, createdBy)
             VALUES (?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.name,
            data.description,
            JSON.stringify(data.permissions),
            data.status,
            data.createdBy
        );
        return { id: info.lastInsertRowid, ...data, permissions: data.permissions };
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

    async findAll({ where } = {}) {
        let roles;
        if (!where) {
            roles = this.db.prepare(`SELECT * FROM roles`).all();
        } else {
            const keys = Object.keys(where);
            const conditions = keys.map(k => `${k} = ?`).join(' AND ');
            const values = keys.map(k => where[k]);
            roles = this.db.prepare(`SELECT * FROM roles WHERE ${conditions}`).all(...values);
        }
        for (let role of roles) {
            if (typeof role.permissions === 'string') {
                try { role.permissions = JSON.parse(role.permissions); } catch { role.permissions = []; }
            }
        }
        return roles;
    }

    async bulkCreate(roles) {
        const stmt = this.db.prepare(
            `INSERT INTO roles (name, description, permissions, status, createdBy)
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