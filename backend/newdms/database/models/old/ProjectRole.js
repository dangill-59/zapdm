const BaseModel = require('./BaseModel');

class ProjectRole extends BaseModel {
    constructor(db) {
        super(db, 'project_roles');
    }

    // Assign roles to a project if not already assigned
    assignRolesToProject(projectId, roleIds = []) {
        // get existing assignments
        const existing = this.db.prepare(
            `SELECT role_id FROM project_roles WHERE project_id = ?`
        ).all(projectId);

        const alreadyAssigned = new Set(existing.map(r => r.role_id));
        const toAssign = roleIds.filter(id => !alreadyAssigned.has(id));

        const stmt = this.db.prepare(
            `INSERT INTO project_roles (project_id, role_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`
        );

        const transaction = this.db.transaction((ids) => {
            for (const roleId of ids) {
                stmt.run(projectId, roleId);
            }
        });

        if (toAssign.length > 0) {
            transaction(toAssign);
        }
    }
}

module.exports = ProjectRole;