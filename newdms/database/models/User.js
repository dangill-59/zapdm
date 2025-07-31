class User {
    constructor(db, RoleModel = null) {
        this.db = db;
        this.RoleModel = RoleModel;
    }

    async attachRole(user) {
        if (!user || !this.RoleModel) return user;
        const role = await this.RoleModel.findOne({ where: { id: user.roleId } });
        user.role = role || null;
        return user;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM users WHERE ${conditions} LIMIT 1`);
        const user = stmt.get(...values) || null;
        return await this.attachRole(user);
    }

    async findOrCreate({ where, defaults }) {
        let user = await this.findOne({ where });
        if (user) return [user, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [await this.attachRole(created), true];
    }

    async create(data) {
        const stmt = this.db.prepare(
            `INSERT INTO users (username, email, passwordHash, firstName, lastName, isActive, roleId, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.username,
            data.email,
            data.passwordHash,
            data.firstName,
            data.lastName,
            data.isActive,
            data.roleId,
            data.createdAt || new Date().toISOString(),
            data.updatedAt || new Date().toISOString()
        );
        return { id: info.lastInsertRowid, ...data, roleId: data.roleId };
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

    async findAll({ where } = {}) {
        let users;
        if (!where) {
            users = this.db.prepare(`SELECT * FROM users`).all();
        } else {
            const keys = Object.keys(where);
            const conditions = keys.map(k => `${k} = ?`).join(' AND ');
            const values = keys.map(k => where[k]);
            users = this.db.prepare(`SELECT * FROM users WHERE ${conditions}`).all(...values);
        }
        if (this.RoleModel) {
            for (let user of users) {
                await this.attachRole(user);
            }
        }
        return users;
    }

    async bulkCreate(users) {
        const stmt = this.db.prepare(
            `INSERT INTO users (username, email, passwordHash, firstName, lastName, isActive, roleId, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((users) => {
            for (const u of users) {
                stmt.run(
                    u.username,
                    u.email,
                    u.passwordHash,
                    u.firstName,
                    u.lastName,
                    u.isActive,
                    u.roleId,
                    u.createdAt || new Date().toISOString(),
                    u.updatedAt || new Date().toISOString()
                );
            }
        });
        insertMany(users);
    }

    getUserPermissions(userId) {
        const user = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId);
        if (!user) return [];
        const role = this.db.prepare(`SELECT * FROM roles WHERE id = ?`).get(user.roleId);
        if (!role) return [];
        try {
            return typeof role.permissions === 'string' ? JSON.parse(role.permissions) : (role.permissions || []);
        } catch {
            return [];
        }
    }
}

module.exports = User;