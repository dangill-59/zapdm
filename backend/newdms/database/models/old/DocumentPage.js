// src/database/models/DocumentPage.js
const BaseModel = require('./BaseModel');
const { STATUS } = require('../../config/constants');

class DocumentPage extends BaseModel {
    constructor(db) {
        super(db, 'document_pages');
    }

    // Get pages for a document (only active)
    findByDocument(documentId) {
        return this.db.prepare(`
            SELECT 
                id,
                page_number,
                file_name,
                file_size,
                mime_type,
                thumbnail_path,
                page_order,
                source_file_name,
                created_at,
                ocr_text IS NOT NULL AND ocr_text != '' as has_ocr,
                ocr_confidence,
                ocr_processed_at,
                ocr_language,
                word_count,
                CASE 
                    WHEN source_file_name LIKE '%.pdf' THEN 'pdf'
                    WHEN mime_type LIKE 'image/%' THEN 'image'
                    ELSE 'unknown'
                END as source_type
            FROM document_pages 
            WHERE document_id = ? AND (status IS NULL OR status = ?)
            ORDER BY page_order, page_number
        `).all(documentId, STATUS.ACTIVE);
    }

    // Get page with document info
    findByIdWithDocument(pageId) {
        return this.db.prepare(`
            SELECT 
                dp.*,
                d.title as document_title,
                d.project_id
            FROM document_pages dp
            JOIN documents d ON dp.document_id = d.id
            WHERE dp.id = ? AND (dp.status IS NULL OR dp.status = ?)
        `).get(pageId, STATUS.ACTIVE);
    }

    // Create page record
    createPage(pageData) {
        return this.create({
            ...pageData,
            status: STATUS.ACTIVE
        });
    }

    // Update OCR data for page
    updateOCRData(pageId, ocrText, confidence, language = 'eng', wordCount = 0) {
        return this.db.prepare(`
            UPDATE document_pages SET 
                ocr_text = ?, 
                ocr_confidence = ?, 
                ocr_processed_at = CURRENT_TIMESTAMP,
                ocr_language = ?,
                word_count = ?
            WHERE id = ?
        `).run(ocrText, confidence, language, wordCount, pageId);
    }

    // Get OCR text for page
    getOCRText(pageId) {
        return this.db.prepare(`
            SELECT 
                dp.id,
                dp.page_number,
                dp.file_name,
                dp.ocr_text,
                dp.ocr_confidence,
                dp.ocr_processed_at,
                dp.ocr_language,
                dp.word_count,
                d.title as document_title,
                d.id as document_id
            FROM document_pages dp
            JOIN documents d ON dp.document_id = d.id
            WHERE dp.id = ? AND (dp.status IS NULL OR dp.status = ?)
        `).get(pageId, STATUS.ACTIVE);
    }

    // Get pages that need OCR processing
    findPagesNeedingOCR(documentId, forceReprocess = false) {
        let condition = '(dp.ocr_text IS NULL OR dp.ocr_text = \'\')';
        if (forceReprocess) {
            condition = '1=1'; // Process all pages
        }

        return this.db.prepare(`
            SELECT id, file_path, file_name, page_number
            FROM document_pages dp
            WHERE document_id = ? 
            AND (status IS NULL OR status = ?) 
            AND ${condition}
            ORDER BY page_number
        `).all(documentId, STATUS.ACTIVE);
    }

    // Reorder pages
    reorderPages(documentId, pageOrders) {
        const transaction = this.db.transaction(() => {
            const updateStmt = this.db.prepare(`
                UPDATE document_pages 
                SET page_number = ?, page_order = ?
                WHERE id = ? AND document_id = ?
            `);
            
            let updatedCount = 0;
            
            pageOrders.forEach((pageUpdate) => {
                const result = updateStmt.run(
                    pageUpdate.new_page_number,
                    pageUpdate.new_page_number,
                    pageUpdate.page_id,
                    documentId
                );
                
                if (result.changes > 0) {
                    updatedCount++;
                }
            });
            
            // Update document's updated_at timestamp
            this.db.prepare(`
                UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(documentId);
            
            return updatedCount;
        });

        return transaction();
    }

    // Soft delete page
    softDeletePage(pageId) {
        const transaction = this.db.transaction(() => {
            // Get page info before deletion
            const page = this.findById(pageId);
            if (!page) {
                throw new Error('Page not found');
            }

            // Soft delete the page
            this.db.prepare(`
                UPDATE document_pages SET status = ? WHERE id = ?
            `).run(STATUS.INACTIVE, pageId);
            
            // Remove from FTS index
            this.db.prepare('DELETE FROM document_fts WHERE page_id = ?').run(pageId);
            
            // Update document page count
            const remainingPages = this.db.prepare(`
                SELECT COUNT(*) as count FROM document_pages 
                WHERE document_id = ? AND (status IS NULL OR status = ?)
            `).get(page.document_id, STATUS.ACTIVE);
            
            this.db.prepare(`
                UPDATE documents SET total_pages = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `).run(remainingPages.count, page.document_id);
            
            return {
                document_id: page.document_id,
                remaining_pages: remainingPages.count
            };
        });

        return transaction();
    }

    // Get next page number for document
    getNextPageNumber(documentId) {
        const lastPage = this.db.prepare(`
            SELECT MAX(page_number) as max_page FROM document_pages 
            WHERE document_id = ? AND (status IS NULL OR status = ?)
        `).get(documentId, STATUS.ACTIVE);
        
        return (lastPage.max_page || 0) + 1;
    }

    // Validate page ownership
    validatePageOwnership(pageId, documentId) {
        const page = this.db.prepare(`
            SELECT id FROM document_pages 
            WHERE id = ? AND document_id = ? AND (status IS NULL OR status = ?)
        `).get(pageId, documentId, STATUS.ACTIVE);
        
        return !!page;
    }

    // Count pages with OCR
    countPagesWithOCR(documentId = null) {
        if (documentId) {
            return this.db.prepare(`
                SELECT COUNT(*) as count 
                FROM document_pages 
                WHERE document_id = ? 
                AND (status IS NULL OR status = ?) 
                AND ocr_text IS NOT NULL 
                AND ocr_text != ''
            `).get(documentId, STATUS.ACTIVE).count;
        }

        return this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM document_pages 
            WHERE (status IS NULL OR status = ?) 
            AND ocr_text IS NOT NULL 
            AND ocr_text != ''
        `).get(STATUS.ACTIVE).count;
    }
}

module.exports = DocumentPage;