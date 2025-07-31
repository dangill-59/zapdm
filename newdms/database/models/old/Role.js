// src/database/models/Role.js
const BaseModel = require('./BaseModel');

class Role extends BaseModel {
    constructor(db) {
        super(db, 'roles');
    }

    // Get all roles with user count
    findAllWithUserCount() {
        return this.db.prepare(`
            SELECT r.*, COUNT(u.id) as user_count
            FROM roles r
            LEFT JOIN users u ON r.id = u.role_id AND u.status = 'active'
            GROUP BY r.id
            ORDER BY r.created_at DESC
        `).all();
    }

    // Get role with user count
    findByIdWithUserCount(id) {
        return this.db.prepare(`
            SELECT r.*, COUNT(u.id) as user_count
            FROM roles r
            LEFT JOIN users u ON r.id = u.role_id AND u.status = 'active'
            WHERE r.id = ?
            GROUP BY r.id
        `).get(id);
    }

    // Check if role name exists (excluding specific role ID)
    nameExists(name, excludeId = null) {
        if (excludeId) {
            return this.db.prepare(`
                SELECT id FROM roles WHERE name = ? AND id != ?
            `).get(name, excludeId);
        }
        
        return this.db.prepare(`
            SELECT id FROM roles WHERE name = ?
        `).get(name);
    }

    // Create role with permissions
    createRole(roleData) {
        const { permissions, ...otherData } = roleData;
        
        return this.create({
            ...otherData,
            permissions: JSON.stringify(permissions || [])
        });
    }

    // Update role with permissions
    updateRole(id, roleData) {
        const { permissions, ...otherData } = roleData;
        
        return this.update(id, {
            ...otherData,
            permissions: JSON.stringify(permissions || [])
        });
    }

    // Get roles that can be assigned to projects
    getAssignableRoles() {
        return this.db.prepare(`
            SELECT id, name, description 
            FROM roles 
            ORDER BY name
        `).all();
    }

    // Check if role is in use by users
    isInUse(roleId) {
        const count = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role_id = ? AND status = 'active'
        `).get(roleId).count;
        
        return count > 0;
    }
}

module.exports = Role;