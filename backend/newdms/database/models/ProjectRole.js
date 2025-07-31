class ProjectRole {
    constructor(db) {
        this.db = db;
    }

    async findAll({ where }) {
        if (!where) {
            return this.db.prepare(`SELECT * FROM project_roles`).all();
        }
        const keys = Object.keys(where);
        const conditions = keys.map(k => `${k} = ?`).join(' AND ');
        const values = keys.map(k => where[k]);
        return this.db.prepare(`SELECT * FROM project_roles WHERE ${conditions}`).all(...values);
    }

    async bulkCreate(assignments) {
        const stmt = this.db.prepare(
            `INSERT INTO project_roles (project_id, role_id)
             VALUES (?, ?)`
        );
        const insertMany = this.db.transaction((assignments) => {
            for (const a of assignments) {
                stmt.run(a.projectId, a.roleId);
            }
        });
        insertMany(assignments);
    }
}

module.exports = ProjectRole;