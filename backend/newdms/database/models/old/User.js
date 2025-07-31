// src/database/models/User.js
const BaseModel = require('./BaseModel');
const bcrypt = require('bcrypt');
const { STATUS } = require('../../config/constants');

class User extends BaseModel {
    constructor(db) {
        super(db, 'users');
    }

    // Find user by username
    findByUsername(username) {
        return this.db.prepare(`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.username = ? AND u.status = ?
        `).get(username, STATUS.ACTIVE);
    }

    // Find user by email
    findByEmail(email) {
        return this.db.prepare(`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.email = ? AND u.status = ?
        `).get(email, STATUS.ACTIVE);
    }

    // Get all active users with role information
    findAllWithRoles() {
        return this.db.prepare(`
            SELECT u.*, r.name as role_name 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.status != ?
            ORDER BY u.created_at DESC
        `).all(STATUS.DELETED);
    }

    // Get user with full role details
    findByIdWithRole(id) {
        return this.db.prepare(`
            SELECT u.*, r.name as role_name, r.permissions 
            FROM users u 
            LEFT JOIN roles r ON u.role_id = r.id 
            WHERE u.id = ? AND u.status != ?
        `).get(id, STATUS.DELETED);
    }

    // Create user with hashed password
    createUser(userData) {
        const { password, ...otherData } = userData;
        const hashedPassword = bcrypt.hashSync(password, 10);
        
        return this.create({
            ...otherData,
            password: hashedPassword,
            status: STATUS.ACTIVE
        });
    }

    // Update user (optionally with new password)
    updateUser(id, userData) {
        const { password, ...otherData } = userData;
        
        if (password && password.trim()) {
            otherData.password = bcrypt.hashSync(password, 10);
        }
        
        return this.update(id, otherData);
    }

    // Check if username exists (excluding specific user ID)
    usernameExists(username, excludeId = null) {
        if (excludeId) {
            return this.db.prepare(`
                SELECT id FROM users 
                WHERE username = ? AND id != ? AND status != ?
            `).get(username, excludeId, STATUS.DELETED);
        }
        
        return this.db.prepare(`
            SELECT id FROM users 
            WHERE username = ? AND status != ?
        `).get(username, STATUS.DELETED);
    }

    // Check if email exists (excluding specific user ID)
    emailExists(email, excludeId = null) {
        if (excludeId) {
            return this.db.prepare(`
                SELECT id FROM users 
                WHERE email = ? AND id != ? AND status != ?
            `).get(email, excludeId, STATUS.DELETED);
        }
        
        return this.db.prepare(`
            SELECT id FROM users 
            WHERE email = ? AND status != ?
        `).get(email, STATUS.DELETED);
    }

    // Verify password
    verifyPassword(plainPassword, hashedPassword) {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }

    // Get user permissions
    getUserPermissions(userId) {
        const user = this.findByIdWithRole(userId);
        if (!user || !user.permissions) {
            return [];
        }
        
        try {
            return JSON.parse(user.permissions);
        } catch (error) {
            console.error('Error parsing user permissions:', error);
            return [];
        }
    }

    // Check if user has specific permission
    hasPermission(userId, permission) {
        const permissions = this.getUserPermissions(userId);
        return permissions.includes(permission) || permissions.includes('admin_access');
    }
}

module.exports = User;