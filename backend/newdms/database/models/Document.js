// src/database/models/Document.js
const BaseModel = require('./BaseModel');
const { STATUS } = require('../../config/constants');

class Document extends BaseModel {
    constructor(db) {
        super(db, 'documents');
    }

    // Get documents by project
    findByProject(projectId, searchTerm = null) {
        let query = `
            SELECT d.*, u.username as created_by_name
            FROM documents d
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.project_id = ? AND d.status = ?
        `;
        
        const params = [projectId, STATUS.ACTIVE];
        
        if (searchTerm) {
            query += ` AND (d.title LIKE ? OR d.description LIKE ?)`;
            params.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }
        
        query += ` ORDER BY d.updated_at DESC`;
        
        return this.db.prepare(query).all(...params);
    }

    // Get document with project and creator info
    findByIdWithDetails(id) {
        return this.db.prepare(`
            SELECT d.*, 
                   p.name as project_name,
                   u.username as created_by_name,
                   COUNT(dp.id) as page_count
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            LEFT JOIN users u ON d.created_by = u.id
            LEFT JOIN document_pages dp ON d.id = dp.document_id AND (dp.status IS NULL OR dp.status = ?)
            WHERE d.id = ? AND d.status = ?
            GROUP BY d.id
        `).get(STATUS.ACTIVE, id, STATUS.ACTIVE);
    }

    // Create document with field values
    createWithFields(documentData, indexValues = {}) {
        const transaction = this.db.transaction(() => {
            // Create document
            const docResult = this.create({
                ...documentData,
                status: STATUS.ACTIVE
            });

            const documentId = docResult.id;

            // Save field values if provided
            if (indexValues && Object.keys(indexValues).length > 0) {
                const fieldValueInsert = this.db.prepare(`
                    INSERT INTO document_field_values (document_id, field_id, field_value)
                    VALUES (?, ?, ?)
                `);
                
                const projectFields = this.db.prepare(`
                    SELECT id, field_name FROM project_fields WHERE project_id = ?
                `).all(documentData.project_id);
                
                projectFields.forEach(field => {
                    const fieldValue = indexValues[field.field_name];
                    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                        fieldValueInsert.run(documentId, field.id, fieldValue.toString());
                    }
                });
            }

            return documentId;
        });

        return transaction();
    }

    // Update document field values
    updateFields(documentId, indexValues = {}) {
        const transaction = this.db.transaction(() => {
            // Update the document's updated_at timestamp
            this.db.prepare(`
                UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(documentId);
            
            // Clear existing field values
            this.db.prepare(`
                DELETE FROM document_field_values WHERE document_id = ?
            `).run(documentId);
            
            // Insert new field values if provided
            if (indexValues && Object.keys(indexValues).length > 0) {
                const fieldValueInsert = this.db.prepare(`
                    INSERT INTO document_field_values (document_id, field_id, field_value)
                    VALUES (?, ?, ?)
                `);
                
                // Get project ID for this document
                const document = this.findById(documentId);
                if (!document) {
                    throw new Error('Document not found');
                }

                const projectFields = this.db.prepare(`
                    SELECT id, field_name FROM project_fields WHERE project_id = ?
                `).all(document.project_id);
                
                projectFields.forEach(field => {
                    const fieldValue = indexValues[field.field_name];
                    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                        fieldValueInsert.run(documentId, field.id, fieldValue.toString());
                    }
                });
            }
        });

        return transaction();
    }

    // Get document field values
    getFieldValues(documentId) {
        const fieldValues = this.db.prepare(`
            SELECT pf.field_name, pf.field_type, dfv.field_value
            FROM document_field_values dfv
            JOIN project_fields pf ON dfv.field_id = pf.id
            WHERE dfv.document_id = ?
        `).all(documentId);
        
        return fieldValues.reduce((acc, fv) => {
            acc[fv.field_name] = fv.field_value;
            return acc;
        }, {});
    }

    // Get documents with field values
    findByProjectWithFields(projectId, searchTerm = null) {
        const documents = this.findByProject(projectId, searchTerm);
        
        // Add field values to each document
        documents.forEach(doc => {
            doc.index_values = this.getFieldValues(doc.id);
        });
        
        return documents;
    }

    // Soft delete document and all its pages
    softDeleteWithPages(documentId) {
        const transaction = this.db.transaction(() => {
            // Soft delete the document
            const docResult = this.db.prepare(`
                UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(STATUS.INACTIVE, documentId);
            
            if (docResult.changes === 0) {
                throw new Error('Document not found');
            }
            
            // Soft delete all associated pages
            const pagesResult = this.db.prepare(`
                UPDATE document_pages SET status = ? WHERE document_id = ?
            `).run(STATUS.INACTIVE, documentId);
            
            // Remove from FTS index
            this.db.prepare(`
                DELETE FROM document_fts WHERE document_id = ?
            `).run(documentId);
            
            return pagesResult.changes;
        });

        return transaction();
    }

    // Update OCR status
    updateOCRStatus(documentId, hasOCRText, language = 'eng') {
        return this.db.prepare(`
            UPDATE documents SET 
                has_ocr_text = ?,
                ocr_completed_at = CURRENT_TIMESTAMP,
                ocr_language = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(hasOCRText ? 1 : 0, language, documentId);
    }

    // Increment page count
    incrementPageCount(documentId, increment = 1) {
        return this.db.prepare(`
            UPDATE documents SET 
                total_pages = total_pages + ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(increment, documentId);
    }

    // Fix page count based on actual pages
    fixPageCount(documentId) {
        const actualCount = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM document_pages 
            WHERE document_id = ? AND (status IS NULL OR status = ?)
        `).get(documentId, STATUS.ACTIVE).count;

        return this.db.prepare(`
            UPDATE documents SET 
                total_pages = ?, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(actualCount, documentId);
    }
}

module.exports = Document;