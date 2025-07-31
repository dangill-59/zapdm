class Project {
    constructor(db) {
        this.db = db;
    }

    async findOne({ where }) {
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        const stmt = this.db.prepare(`SELECT * FROM projects WHERE ${conditions} LIMIT 1`);
        return stmt.get(...values) || null;
    }

    async findOrCreate({ where, defaults }) {
        let proj = await this.findOne({ where });
        if (proj) return [proj, false];
        const data = { ...defaults, ...where };
        const created = await this.create(data);
        return [created, true];
    }

    async create(data) {
        const stmt = this.db.prepare(
            `INSERT INTO projects (name, description, type, color, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        const info = stmt.run(
            data.name,
            data.description,
            data.type,
            data.color,
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
        const stmt = this.db.prepare(`UPDATE projects SET ${setClause} WHERE id = ?`);
        stmt.run(...values);
    }

    async findAll({ where }) {
        if (!where) {
            return this.db.prepare(`SELECT * FROM projects`).all();
        }
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        return this.db.prepare(`SELECT * FROM projects WHERE ${conditions}`).all(...values);
    }

    async bulkCreate(projects) {
        const stmt = this.db.prepare(
            `INSERT INTO projects (name, description, type, color, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`
        );
        const insertMany = this.db.transaction((projects) => {
            for (const p of projects) {
                stmt.run(
                    p.name,
                    p.description,
                    p.type,
                    p.color,
                    p.status,
                    p.createdBy
                );
            }
        });
        insertMany(projects);
    }
}

module.exports = Project;