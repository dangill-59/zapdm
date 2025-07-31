// src/database/models/index.js
const User = require('./User');
const Role = require('./Role');
const Project = require('./Project');
const Document = require('./Document');
const DocumentPage = require('./DocumentPage');

class Models {
    constructor(db) {
        this.db = db;
        this.User = new User(db);
        this.Role = new Role(db);
        this.Project = new Project(db);
        this.Document = new Document(db);
        this.DocumentPage = new DocumentPage(db);
    }

    // Utility methods that span multiple models

    // Check project access (combines User and Project logic)
    hasProjectAccess(userId, projectId, requiredLevel = 'read') {
        // Get user permissions
        const userPermissions = this.User.getUserPermissions(userId);
        
        // Use Project model to check access
        return this.Project.hasUserAccess(userId, projectId, userPermissions);
    }

    // Audit log helper
    createAuditLog(userId, action, tableName, recordId, details, ipAddress = null) {
        return this.db.prepare(`
            INSERT INTO audit_log (user_id, action, table_name, record_id, details, ip_address) 
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(userId, action, tableName, recordId, details, ipAddress);
    }

    // Full text search
    searchDocuments(query, projectId = null, userId = null, userPermissions = [], limit = 50, offset = 0) {
        let searchQuery = `
            SELECT 
                fts.page_id,
                fts.document_id,
                fts.project_id,
                fts.document_title,
                snippet(document_fts, 4, '<mark>', '</mark>', '...', 32) as snippet,
                rank as relevance,
                dp.page_number,
                dp.file_name,
                dp.ocr_confidence,
                dp.word_count,
                p.name as project_name
            FROM document_fts fts
            JOIN document_pages dp ON fts.page_id = dp.id
            JOIN documents d ON fts.document_id = d.id
            JOIN projects p ON fts.project_id = p.id
            WHERE document_fts MATCH ?
            AND d.status = 'active'
            AND (dp.status IS NULL OR dp.status = 'active')
            AND p.status = 'active'
        `;
        
        let params = [query];
        
        // If not admin, filter by user access
        if (!userPermissions.includes('admin_access') && userId) {
            searchQuery += `
                AND (
                    p.id IN (
                        SELECT pr.project_id FROM project_roles pr
                        JOIN users u ON u.role_id = pr.role_id
                        WHERE u.id = ?
                    ) OR
                    p.id IN (
                        SELECT upa.project_id FROM user_project_access upa
                        WHERE upa.user_id = ?
                    )
                )
            `;
            params.push(userId, userId);
        }
        
        // Filter by project if specified
        if (projectId) {
            searchQuery += ` AND fts.project_id = ?`;
            params.push(projectId);
        }
        
        searchQuery += ` ORDER BY rank LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const results = this.db.prepare(searchQuery).all(...params);
        
        // Get total count
        let countQuery = searchQuery.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM')
                                   .replace(/ORDER BY.*$/, '');
        const countParams = params.slice(0, -2); // Remove limit and offset
        const totalCount = this.db.prepare(countQuery).get(...countParams);
        
        return {
            results,
            total: totalCount.total,
            has_more: (offset + results.length) < totalCount.total
        };
    }

    // Update FTS index
    updateFTSIndex(pageId, documentId, projectId, documentTitle, ocrText) {
        try {
            // Remove existing entry if it exists
            this.db.prepare(`
                DELETE FROM document_fts WHERE page_id = ?
            `).run(pageId);
            
            // Add new entry
            if (ocrText && ocrText.trim().length > 0) {
                this.db.prepare(`
                    INSERT INTO document_fts (page_id, document_id, project_id, document_title, page_text)
                    VALUES (?, ?, ?, ?, ?)
                `).run(pageId, documentId, projectId, documentTitle, ocrText);
            }
        } catch (error) {
            console.error('Failed to update FTS index:', error);
        }
    }

    // Rebuild FTS index
    rebuildFTSIndex() {
        const transaction = this.db.transaction(() => {
            // Clear existing FTS entries
            this.db.prepare('DELETE FROM document_fts').run();
            
            // Get all pages with OCR text
            const pagesWithOCR = this.db.prepare(`
                SELECT 
                    dp.id as page_id,
                    dp.document_id,
                    dp.ocr_text,
                    d.title as document_title,
                    d.project_id
                FROM document_pages dp
                JOIN documents d ON dp.document_id = d.id
                WHERE (dp.status IS NULL OR dp.status = 'active')
                AND d.status = 'active'
                AND dp.ocr_text IS NOT NULL 
                AND dp.ocr_text != ''
            `).all();
            
            // Insert into FTS
            const ftsInsert = this.db.prepare(`
                INSERT INTO document_fts (page_id, document_id, project_id, document_title, page_text)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            let processedCount = 0;
            pagesWithOCR.forEach(page => {
                ftsInsert.run(
                    page.page_id,
                    page.document_id,
                    page.project_id,
                    page.document_title,
                    page.ocr_text
                );
                processedCount++;
            });
            
            return processedCount;
        });

        return transaction();
    }

    // Database statistics
    getOCRStats() {
        return {
            total_pages: this.db.prepare('SELECT COUNT(*) as count FROM document_pages WHERE status = \'active\'').get().count,
            pages_with_ocr: this.db.prepare('SELECT COUNT(*) as count FROM document_pages WHERE status = \'active\' AND ocr_text IS NOT NULL AND ocr_text != \'\'').get().count,
            total_words: this.db.prepare('SELECT SUM(word_count) as total FROM document_pages WHERE status = \'active\' AND word_count > 0').get().total || 0,
            avg_confidence: this.db.prepare('SELECT AVG(ocr_confidence) as avg FROM document_pages WHERE status = \'active\' AND ocr_confidence IS NOT NULL').get().avg || 0,
            documents_with_ocr: this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE status = \'active\' AND has_ocr_text = 1').get().count,
            total_documents: this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE status = \'active\'').get().count,
            fts_entries: this.db.prepare('SELECT COUNT(*) as count FROM document_fts').get().count
        };
    }
}

module.exports = Models;