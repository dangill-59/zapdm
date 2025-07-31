class ProjectRole {
    constructor(db) {
        this.db = db;
    }

    async findAll({ where } = {}) {
        let roles;
        if (!where) {
            roles = this.db.prepare(`SELECT * FROM project_roles`).all();
        } else {
            const keys = Object.keys(where);
            const conditions = keys.map(k => `${k} = ?`).join(' AND ');
            const values = keys.map(k => where[k]);
            roles = this.db.prepare(`SELECT * FROM project_roles WHERE ${conditions}`).all(...values);
        }
        return roles;
    }

    async bulkCreate(assignments) {
        const stmt = this.db.prepare(
            `INSERT INTO project_roles (project_id, role_id)
             VALUES (?, ?)`
        );
        const insertMany = this.db.transaction((assignments) => {
            for (const a of assignments) {
                stmt.run(a.project_id, a.role_id);
            }
        });
        insertMany(assignments);
    }
}

module.exports = ProjectRole;