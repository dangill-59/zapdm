class User {
    constructor(db) {
        this.db = db;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM users WHERE ${conditions} LIMIT 1`);
        return stmt.get(...values) || null;
    }

    async findOrCreate({ where, defaults }) {
        let user = await this.findOne({ where });
        if (user) return [user, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        const stmt = this.db.prepare(
            `INSERT INTO users (username, email, password, first_name, last_name, role_id, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.username,
            data.email,
            data.password,
            data.firstName,
            data.lastName,
            data.roleId,
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
        const stmt = this.db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`);
        stmt.run(...values);
    }

    async findAll({ where }) {
        if (!where) {
            return this.db.prepare(`SELECT * FROM users`).all();
        }
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        return this.db.prepare(`SELECT * FROM users WHERE ${conditions}`).all(...values);
    }

    async bulkCreate(users) {
        const stmt = this.db.prepare(
            `INSERT INTO users (username, email, password, first_name, last_name, role_id, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((users) => {
            for (const u of users) {
                stmt.run(
                    u.username,
                    u.email,
                    u.password,
                    u.firstName,
                    u.lastName,
                    u.roleId,
                    u.status,
                    u.createdBy
                );
            }
        });
        insertMany(users);
    }
}

module.exports = User;