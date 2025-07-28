// src/database/models/Project.js
const BaseModel = require('./BaseModel');
const { STATUS } = require('../../config/constants');

class Project extends BaseModel {
    constructor(db) {
        super(db, 'projects');
    }

    // Get all projects with document count and creator info
    findAllWithDetails() {
        return this.db.prepare(`
            SELECT p.*, u.username as created_by_name,
                   COUNT(DISTINCT d.id) as document_count
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN documents d ON p.id = d.project_id AND d.status = ?
            WHERE p.status = ?
            GROUP BY p.id 
            ORDER BY p.created_at DESC
        `).all(STATUS.ACTIVE, STATUS.ACTIVE);
    }

    // Get project by ID with details
    findByIdWithDetails(id) {
        return this.db.prepare(`
            SELECT p.*, u.username as created_by_name,
                   COUNT(DISTINCT d.id) as document_count
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN documents d ON p.id = d.project_id AND d.status = ?
            WHERE p.id = ? AND p.status != ?
            GROUP BY p.id
        `).get(STATUS.ACTIVE, id, STATUS.DELETED);
    }

    // Get projects accessible by user (via role or direct access)
    findAccessibleByUser(userId, userPermissions = []) {
        if (userPermissions.includes('admin_access')) {
            return this.findAllWithDetails();
        }

        return this.db.prepare(`
            SELECT p.*, u.username as created_by_name,
                   COUNT(DISTINCT d.id) as document_count
            FROM projects p
            LEFT JOIN users u ON p.created_by = u.id
            LEFT JOIN documents d ON p.id = d.project_id AND d.status = ?
            WHERE p.status = ? AND (
                p.id IN (
                    SELECT pr.project_id FROM project_roles pr
                    JOIN users us ON us.role_id = pr.role_id
                    WHERE us.id = ?
                ) OR
                p.id IN (
                    SELECT upa.project_id FROM user_project_access upa
                    WHERE upa.user_id = ?
                )
            )
            GROUP BY p.id 
            ORDER BY p.created_at DESC
        `).all(STATUS.ACTIVE, STATUS.ACTIVE, userId, userId);
    }

    // Create project with roles and fields
    createWithRolesAndFields(projectData, assignedRoles = [], indexFields = [], createdBy) {
        const transaction = this.db.transaction(() => {
            // Create project
            const projectResult = this.create({
                ...projectData,
                created_by: createdBy,
                status: STATUS.ACTIVE
            });

            const projectId = projectResult.id;

            // Assign roles to project
            if (assignedRoles.length > 0) {
                const roleAssignInsert = this.db.prepare(`
                    INSERT INTO project_roles (project_id, role_id, assigned_by)
                    VALUES (?, ?, ?)
                `);

                assignedRoles.forEach(roleId => {
                    roleAssignInsert.run(projectId, roleId, createdBy);
                });
            }

            // Add custom fields
            if (indexFields.length > 0) {
                const fieldInsert = this.db.prepare(`
                    INSERT INTO project_fields (project_id, field_name, field_label, field_type, field_options, required, display_order)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                indexFields.forEach((field, index) => {
                    fieldInsert.run(
                        projectId,
                        field.name,
                        field.label,
                        field.type,
                        JSON.stringify(field.options || []),
                        field.required ? 1 : 0,
                        index
                    );
                });
            }

            return projectId;
        });

        return transaction();
    }

    // Update project with roles and fields
    updateWithRolesAndFields(id, projectData, assignedRoles = [], indexFields = [], updatedBy) {
        const transaction = this.db.transaction(() => {
            // Update project basic info
            this.update(id, projectData);

            // Clear existing role assignments
            this.db.prepare('DELETE FROM project_roles WHERE project_id = ?').run(id);

            // Insert new role assignments
            if (assignedRoles.length > 0) {
                const roleAssignInsert = this.db.prepare(`
                    INSERT INTO project_roles (project_id, role_id, assigned_by)
                    VALUES (?, ?, ?)
                `);

                assignedRoles.forEach(roleId => {
                    roleAssignInsert.run(id, roleId, updatedBy);
                });
            }

            // Handle custom fields safely
            if (indexFields && Array.isArray(indexFields)) {
                // Check if there are existing document field values
                const existingDocValues = this.db.prepare(`
                    SELECT COUNT(*) as count 
                    FROM document_field_values dfv 
                    JOIN project_fields pf ON dfv.field_id = pf.id 
                    WHERE pf.project_id = ?
                `).get(id);

                if (existingDocValues.count > 0) {
                    // Safe update: Don't delete, just update existing fields and add new ones
                    const existingFields = this.db.prepare(`
                        SELECT id, field_name, field_type, field_options, required, display_order 
                        FROM project_fields 
                        WHERE project_id = ?
                        ORDER BY display_order
                    `).all(id);

                    // Update or insert each field
                    indexFields.forEach((field, index) => {
                        const existingField = existingFields.find(ef => ef.field_name === field.name);
                        
                        if (existingField) {
                            // Update existing field
                            this.db.prepare(`
                                UPDATE project_fields 
                                SET field_type = ?, field_options = ?, required = ?, display_order = ?
                                WHERE id = ?
                            `).run(
                                field.type,
                                JSON.stringify(field.options || []),
                                field.required ? 1 : 0,
                                index,
                                existingField.id
                            );
                        } else {
                            // Insert new field
                            this.db.prepare(`
                                INSERT INTO project_fields (project_id, field_name, field_label, field_type, field_options, required, display_order)
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `).run(
                                id,
                                field.name,
                                field.label || field.name,
                                field.type,
                                JSON.stringify(field.options || []),
                                field.required ? 1 : 0,
                                index
                            );
                        }
                    });

                    // Remove fields that are no longer needed (only if no document values reference them)
                    const fieldNamesToKeep = indexFields.map(f => f.name);
                    existingFields.forEach(existingField => {
                        if (!fieldNamesToKeep.includes(existingField.field_name)) {
                            const fieldValueCount = this.db.prepare(`
                                SELECT COUNT(*) as count 
                                FROM document_field_values 
                                WHERE field_id = ?
                            `).get(existingField.id);

                            if (fieldValueCount.count === 0) {
                                this.db.prepare('DELETE FROM project_fields WHERE id = ?').run(existingField.id);
                            }
                        }
                    });
                } else {
                    // No document values: Safe to delete and recreate all fields
                    this.db.prepare('DELETE FROM project_fields WHERE project_id = ?').run(id);

                    const fieldInsert = this.db.prepare(`
                        INSERT INTO project_fields (project_id, field_name, field_label, field_type, field_options, required, display_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);

                    indexFields.forEach((field, index) => {
                        fieldInsert.run(
                            id,
                            field.name,
                            field.label,
                            field.type,
                            JSON.stringify(field.options || []),
                            field.required ? 1 : 0,
                            index
                        );
                    });
                }
            }
        });

        return transaction();
    }

    // Get project fields
    getFields(projectId) {
        const fields = this.db.prepare(`
            SELECT field_name as name, field_label as label, field_type as type, 
                   field_options as options, required, display_order
            FROM project_fields 
            WHERE project_id = ? 
            ORDER BY display_order, id
        `).all(projectId);
        
        return fields.map(field => ({
            ...field,
            options: field.options ? JSON.parse(field.options) : [],
            required: !!field.required
        }));
    }

    // Get assigned roles
    getAssignedRoles(projectId) {
        return this.db.prepare(`
            SELECT r.id, r.name, r.description
            FROM project_roles pr
            JOIN roles r ON pr.role_id = r.id
            WHERE pr.project_id = ?
            ORDER BY r.name
        `).all(projectId);
    }

    // Check if user has access to project
    hasUserAccess(userId, projectId, userPermissions = []) {
        // Admins always have access
        if (userPermissions.includes('admin_access')) {
            return true;
        }

        // Check role-based access
        const roleAccess = this.db.prepare(`
            SELECT pr.id FROM project_roles pr
            JOIN users u ON u.role_id = pr.role_id
            WHERE u.id = ? AND pr.project_id = ?
        `).get(userId, projectId);
        
        if (roleAccess) {
            return true;
        }

        // Check direct user access
        const directAccess = this.db.prepare(`
            SELECT access_level FROM user_project_access 
            WHERE user_id = ? AND project_id = ?
        `).get(userId, projectId);
        
        return !!directAccess;
    }

    // Check if project has documents
    hasDocuments(projectId) {
        const count = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM documents 
            WHERE project_id = ? AND status = ?
        `).get(projectId, STATUS.ACTIVE).count;
        
        return count > 0;
    }
}

module.exports = Project;