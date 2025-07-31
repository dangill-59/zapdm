// src/services/pdfService.js
const pdf2pic = require('pdf2pic');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { PDF_CONVERSION_OPTIONS } = require('../config/constants');
const ImageService = require('./imageService');
const OCRService = require('./ocrService');

class PDFService {
    /**
     * Process PDF file into individual pages
     * @param {Object} file - Multer file object
     * @param {string} documentId - Document ID
     * @param {string} documentDir - Document directory
     * @param {string} pagesDir - Pages directory
     * @param {string} thumbnailDir - Thumbnail directory
     * @param {boolean} performOCRProcessing - Whether to perform OCR
     * @param {Object} models - Database models
     * @returns {Promise<Array>} Array of page records
     */
    static async processPDFPages(file, documentId, documentDir, pagesDir, thumbnailDir, performOCRProcessing = false, models) {
        const pageRecords = [];
        
        try {
            console.log(`📄 Starting PDF processing: ${file.originalname} for document ${documentId} (OCR: ${performOCRProcessing})`);
            
            // Get current page count for this document
            const startingPageNumber = models.DocumentPage.getNextPageNumber(documentId);
            console.log(`📄 Starting page number: ${startingPageNumber}`);
            
            // Configure pdf2pic for high-quality conversion
            const convertOptions = {
                ...PDF_CONVERSION_OPTIONS,
                savePath: pagesDir
            };
            
            // Convert PDF to images
            const convert = pdf2pic.fromPath(file.path, convertOptions);
            const conversionResults = await convert.bulk(-1); // -1 means all pages
            
            console.log(`📄 PDF converted to ${conversionResults.length} pages`);
            
            // Get document info for FTS
            const documentInfo = models.Document.findById(documentId);
            
            // Process each converted page
            for (let i = 0; i < conversionResults.length; i++) {
                const conversionResult = conversionResults[i];
                const pageNumber = startingPageNumber + i;
                const originalPageName = `page.${i + 1}.jpg`;
                const finalPageName = `${uuidv4()}_page_${pageNumber}.jpg`;
                const thumbnailName = `thumb_${finalPageName}`;
                
                console.log(`📄 Processing page ${pageNumber} for document ${documentId}`);
                
                // Move page to final location with UUID filename
                const originalPagePath = path.join(pagesDir, originalPageName);
                const finalPagePath = path.join(pagesDir, finalPageName);
                const thumbnailPath = path.join(thumbnailDir, thumbnailName);
                
                // Rename the converted page file
                await fs.rename(originalPagePath, finalPagePath);
                
                // Create thumbnail
                await ImageService.createThumbnail(finalPagePath, thumbnailPath);
                
                // Get file stats
                const stats = await fs.stat(finalPagePath);
                
                // Perform OCR if requested
                let ocrData = null;
                if (performOCRProcessing) {
                    try {
                        ocrData = await OCRService.performOCR(finalPagePath);
                        console.log(`🔍 OCR completed for page ${pageNumber}: ${ocrData.wordCount} words`);
                    } catch (ocrError) {
                        console.error(`⚠️ OCR failed for page ${pageNumber}:`, ocrError.message);
                    }
                }
                
                // Save page record to database
                const pageData = {
                    document_id: documentId,
                    page_number: pageNumber,
                    file_path: finalPagePath,
                    file_name: `${file.originalname} - Page ${pageNumber}`,
                    file_size: stats.size,
                    mime_type: 'image/jpeg',
                    thumbnail_path: thumbnailPath,
                    page_order: pageNumber,
                    source_file_name: file.originalname,
                    ocr_text: ocrData?.text || null,
                    ocr_confidence: ocrData?.confidence || null,
                    ocr_processed_at: ocrData ? new Date().toISOString() : null,
                    ocr_language: performOCRProcessing ? 'eng' : null,
                    word_count: ocrData?.wordCount || 0
                };
                
                const result = models.DocumentPage.createPage(pageData);
                const pageId = result.id;
                
                console.log(`✅ Created page ${pageNumber} with ID ${pageId} for document ${documentId}`);
                
                // Update FTS index if OCR was performed
                if (ocrData && ocrData.text) {
                    models.updateFTSIndex(pageId, documentId, documentInfo.project_id, documentInfo.title, ocrData.text);
                }
                
                pageRecords.push({
                    id: pageId,
                    page_number: pageNumber,
                    file_name: `${file.originalname} - Page ${pageNumber}`,
                    file_path: finalPagePath,
                    thumbnail_path: thumbnailPath,
                    file_size: stats.size,
                    source_type: 'pdf',
                    document_id: documentId,
                    ocr_text: ocrData?.text || null,
                    ocr_confidence: ocrData?.confidence || null,
                    word_count: ocrData?.wordCount || 0
                });
            }
            
            // Clean up original PDF file
            await fs.unlink(file.path);
            
            console.log(`✅ PDF processing complete: ${pageRecords.length} pages created for document ${documentId}`);
            return pageRecords;
            
        } catch (error) {
            console.error(`❌ PDF processing failed for document ${documentId}:`, error);
            throw new Error(`Failed to process PDF: ${error.message}`);
        }
    }

    /**
     * Validate PDF file
     * @param {Object} file - Multer file object
     * @returns {boolean}
     */
    static validatePDFFile(file) {
        return file.mimetype === 'application/pdf';
    }

    /**
     * Get PDF page count (if needed)
     * @param {string} filePath - PDF file path
     * @returns {Promise<number>}
     */
    static async getPDFPageCount(filePath) {
        try {
            // This would require additional PDF parsing library
            // For now, we'll process and count during conversion
            return 0;
        } catch (error) {
            console.error('Error getting PDF page count:', error);
            return 0;
        }
    }
}

module.exports = PDFService;