// newdms/routes/documentRoutes.js
const express = require('express');
const router = express.Router();

const { upload } = require('../config/multer');
const { 
    PERMISSIONS, 
    HTTP_STATUS, 
    STATUS,
    AUDIT_ACTIONS
} = require('../config/constants');

const {
    ImageService,
    PDFService,
    FileService,
    AuthService,
    AuditService,
    OCRService
} = require('../services');

// Enhanced file upload route with PDF page splitting and OCR
router.post('/:documentId/pages', AuthService.authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { perform_ocr } = req.body;
        const file = req.file;
        
        console.log(`🔍 UPLOAD DEBUG - Document ID: ${documentId}`);
        console.log(`🔍 UPLOAD DEBUG - File: ${file?.originalname}, Type: ${file?.mimetype}`);
        console.log(`🔍 UPLOAD DEBUG - OCR Requested: ${perform_ocr === 'true'}`);
        
        // Validate file using service
        const fileValidation = FileService.validateFile(file);
        if (!fileValidation.valid) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: fileValidation.error });
        }
        
        // Verify document exists using model
        const existingDoc = req.models.Document.findById(documentId);
        if (!existingDoc || existingDoc.status !== STATUS.ACTIVE) {
            console.error(`❌ Document ${documentId} not found!`);
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check project access
        if (!req.models.hasProjectAccess(req.user.id, existingDoc.project_id)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied to this project' });
        }
        
        console.log(`✅ Processing file for document: ${existingDoc.title} (ID: ${documentId})`);
        
        // Create directories using service
        const { documentDir, thumbnailDir, pagesDir } = await FileService.createDirectories(documentId);
        
        let pageRecords = [];
        const performOCRProcessing = perform_ocr === 'true';
        
        // Check if file is a PDF and process accordingly
        if (PDFService.validatePDFFile(file)) {
            console.log(`📄 Processing PDF: ${file.originalname} for document ${documentId}`);
            pageRecords = await PDFService.processPDFPages(file, documentId, documentDir, pagesDir, thumbnailDir, performOCRProcessing, req.models);
            console.log(`✅ PDF processed: ${pageRecords.length} pages created for document ${documentId}`);
        } else if (ImageService.validateImageFile(file)) {
            // Handle single image files
            console.log(`🖼️ Processing image: ${file.originalname} for document ${documentId}`);
            const pageRecord = await ImageService.processSingleImage(file, documentId, documentDir, thumbnailDir, performOCRProcessing, req.models);
            pageRecords.push(pageRecord);
            console.log(`✅ Image processed: 1 page created for document ${documentId}`);
        } else {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Unsupported file type' });
        }
        
        // Update document page count and OCR status using model
        const hasOCRText = pageRecords.some(page => page.ocr_text && page.ocr_text.length > 0);
        const totalWords = pageRecords.reduce((sum, page) => sum + (page.word_count || 0), 0);
        
        req.models.Document.incrementPageCount(documentId, pageRecords.length);
        
        if (hasOCRText) {
            req.models.Document.updateOCRStatus(documentId, true, 'eng');
            console.log(`🔍 OCR completed: ${totalWords} total words extracted`);
        }
        
        // Log the upload using service
        AuditService.logDocumentUpload(req.models, req.user.id, documentId, pageRecords.length, file.originalname, performOCRProcessing, req.ip);
        
        res.json({
            success: true,
            message: `Successfully processed ${pageRecords.length} page(s)${performOCRProcessing ? ' with OCR' : ''}`,
            pages: pageRecords,
            total_pages: pageRecords.length,
            file_type: PDFService.validatePDFFile(file) ? 'pdf' : 'image',
            document_id: documentId,
            ocr_processed: performOCRProcessing,
            ocr_words_found: totalWords,
            has_ocr_text: hasOCRText
        });
        
    } catch (error) {
        console.error('❌ File processing error:', error);
        console.error('Stack trace:', error.stack);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            error: 'File processing failed: ' + error.message,
            details: error.stack
        });
    }
});

// Get document pages
router.get('/:documentId/pages', AuthService.authenticateToken, (req, res) => {
    try {
        const { documentId } = req.params;
        
        const pages = req.models.DocumentPage.findByDocument(documentId);
        
        res.json(pages);
    } catch (error) {
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
});

// Reorder document pages
router.put('/:documentId/pages/reorder', AuthService.authenticateToken, AuthService.authorize([PERMISSIONS.DOCUMENT_EDIT]), (req, res) => {
    try {
        const { documentId } = req.params;
        const { page_order } = req.body;
        
        console.log(`🔄 Reordering pages for document ${documentId}`);
        
        // Validation
        if (!page_order || !Array.isArray(page_order) || page_order.length === 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Page order array is required' });
        }
        
        // Check if document exists and user has access
        const document = req.models.Document.findByIdWithDetails(documentId);
        
        if (!document) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check project access
        if (!req.models.hasProjectAccess(req.user.id, document.project_id)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied to this project' });
        }
        
        // Validate page ownership and reorder using model
        const updatedCount = req.models.DocumentPage.reorderPages(documentId, page_order);
        
        // Log the reorder using service
        AuditService.createAuditLog(req.models, req.user.id, AUDIT_ACTIONS.UPDATE, 'documents', documentId, 
            `Reordered ${updatedCount} pages in document: ${document.title}`, req.ip);
        
        console.log(`✅ Successfully reordered ${updatedCount} pages for document ${documentId}`);
        
        res.json({ 
            success: true, 
            message: `Successfully reordered ${updatedCount} pages`,
            updated_pages: updatedCount
        });
        
    } catch (error) {
        console.error('❌ Error reordering pages:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Failed to reorder pages: ' + error.message });
    }
});

// Get single document by ID
router.get('/:id', AuthService.authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        
        const document = req.models.Document.findByIdWithDetails(id);
        
        if (!document) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check access using project access
        const userPermissions = req.models.User.getUserPermissions(req.user.id);
        if (!userPermissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
            if (!req.models.hasProjectAccess(req.user.id, document.project_id)) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found or access denied' });
            }
        }
        
        // Add field values
        document.index_values = req.models.Document.getFieldValues(document.id);
        
        res.json(document);
    } catch (error) {
        console.error('Error fetching document:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
});

// Update document index fields
router.put('/:id', AuthService.authenticateToken, AuthService.authorize([PERMISSIONS.DOCUMENT_EDIT]), (req, res) => {
    try {
        const { id } = req.params;
        const { index_values } = req.body;
        
        // Check if document exists and user has access
        const document = req.models.Document.findByIdWithDetails(id);
        
        if (!document) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check project access
        if (!req.models.hasProjectAccess(req.user.id, document.project_id)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied to this project' });
        }
        
        req.models.Document.updateFields(id, index_values || {});
        
        // Log the update using service
        AuditService.createAuditLog(req.models, req.user.id, AUDIT_ACTIONS.UPDATE, 'documents', id, 
            `Updated document index fields: ${document.title}`, req.ip);
        
        res.json({ 
            success: true, 
            message: 'Document updated successfully' 
        });
        
    } catch (error) {
        console.error('Error updating document:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
});

// Soft delete document
router.delete('/:id', AuthService.authenticateToken, AuthService.authorize([PERMISSIONS.DOCUMENT_DELETE]), (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if document exists and user has access
        const document = req.models.Document.findByIdWithDetails(id);
        
        if (!document) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check project access
        if (!req.models.hasProjectAccess(req.user.id, document.project_id)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied to this project' });
        }
        
        const deletedPages = req.models.Document.softDeleteWithPages(id);
        
        // Log the deletion using service
        AuditService.createAuditLog(req.models, req.user.id, AUDIT_ACTIONS.DELETE, 'documents', id, 
            `Soft deleted document: ${document.title} (${deletedPages} pages)`, req.ip);
        
        res.json({ 
            success: true, 
            message: `Document and ${deletedPages} pages marked as inactive`,
            deleted_pages: deletedPages
        });
        
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: error.message });
    }
});

// Batch OCR processing for document
router.post('/:documentId/ocr', AuthService.authenticateToken, AuthService.authorize([PERMISSIONS.DOCUMENT_OCR]), async (req, res) => {
    try {
        const { documentId } = req.params;
        const { language = 'eng', force_reprocess = false } = req.body;
        
        console.log(`🔍 Starting batch OCR for document ${documentId} with language: ${language}`);
        
        // Check if document exists using model
        const document = req.models.Document.findByIdWithDetails(documentId);
        
        if (!document) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Document not found' });
        }
        
        // Check project access
        if (!req.models.hasProjectAccess(req.user.id, document.project_id)) {
            return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Access denied to this project' });
        }
        
        // Get pages that need OCR processing using model
        const pages = req.models.DocumentPage.findPagesNeedingOCR(documentId, force_reprocess);
        
        if (pages.length === 0) {
            return res.json({
                success: true,
                message: 'No pages need OCR processing',
                processed_pages: 0
            });
        }
        
        console.log(`📄 Found ${pages.length} pages to process for document ${documentId}`);
        
        let processedCount = 0;
        let totalWords = 0;
        let errors = [];
        
        // Process each page
        for (const page of pages) {
            try {
                console.log(`🔍 Processing OCR for page ${page.page_number} (ID: ${page.id})`);
                
                // Check if file exists using service
                const fileExists = await FileService.fileExists(page.file_path);
                if (!fileExists) {
                    errors.push(`Page ${page.page_number}: File not found`);
                    continue;
                }
                
                // Perform OCR using service
                const ocrData = await OCRService.performOCR(page.file_path, language);
                
                // Update page with OCR data using model
                const updateResult = req.models.DocumentPage.updateOCRData(page.id, ocrData.text, ocrData.confidence, language, ocrData.wordCount);
                
                if (updateResult.changes > 0) {
                    // Update FTS index
                    req.models.updateFTSIndex(page.id, documentId, document.project_id, document.title, ocrData.text);
                    
                    processedCount++;
                    totalWords += ocrData.wordCount;
                    console.log(`✅ OCR completed for page ${page.page_number}: ${ocrData.wordCount} words`);
                }
                
            } catch (pageError) {
                console.error(`❌ OCR failed for page ${page.page_number}:`, pageError.message);
                errors.push(`Page ${page.page_number}: ${pageError.message}`);
            }
        }
        
        // Update document OCR status
        if (processedCount > 0) {
            req.models.Document.updateOCRStatus(documentId, true, language);
        }
        
        // Log the batch OCR processing using service
        AuditService.logBatchOCR(req.models, req.user.id, documentId, processedCount, totalWords, req.ip);
        
        console.log(`✅ Batch OCR completed for document ${documentId}: ${processedCount} pages processed`);
        
        res.json({
            success: true,
            message: `OCR processing completed for ${processedCount} pages`,
            document_id: documentId,
            processed_pages: processedCount,
            total_pages: pages.length,
            total_words: totalWords,
            language: language,
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('❌ Batch OCR processing error:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            error: 'Batch OCR processing failed: ' + error.message 
        });
    }
});

module.exports = router;