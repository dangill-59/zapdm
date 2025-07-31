// src/services/imageService.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { THUMBNAIL_CONFIG } = require('../config/constants');
const OCRService = require('./ocrService');

class ImageService {
    /**
     * Create thumbnail from an image
     * @param {string} imagePath - Source image path
     * @param {string} thumbnailPath - Output thumbnail path
     * @returns {Promise<boolean>}
     */
    static async createThumbnail(imagePath, thumbnailPath) {
        try {
            await sharp(imagePath)
                .resize(THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height, { 
                    fit: THUMBNAIL_CONFIG.fit,
                    withoutEnlargement: THUMBNAIL_CONFIG.withoutEnlargement,
                    background: THUMBNAIL_CONFIG.background
                })
                .jpeg({ 
                    quality: THUMBNAIL_CONFIG.quality,
                    progressive: true
                })
                .toFile(thumbnailPath);
            return true;
        } catch (error) {
            console.error('❌ Thumbnail creation failed:', error);
            return false;
        }
    }

    /**
     * Process a single image file
     * @param {Object} file - Multer file object
     * @param {string} documentId - Document ID
     * @param {string} documentDir - Document directory
     * @param {string} thumbnailDir - Thumbnail directory
     * @param {boolean} performOCRProcessing - Whether to perform OCR
     * @param {Object} models - Database models
     * @returns {Promise<Object>} Page record
     */
    static async processSingleImage(file, documentId, documentDir, thumbnailDir, performOCRProcessing = false, models) {
        console.log(`🖼️ Processing image: ${file.originalname} for document ${documentId} (OCR: ${performOCRProcessing})`);
        
        // Get next page number
        const pageNumber = models.DocumentPage.getNextPageNumber(documentId);
        
        // Generate unique filename
        const fileName = `${uuidv4()}_${file.originalname}`;
        const finalPath = path.join(documentDir, fileName);
        const thumbnailPath = path.join(thumbnailDir, `thumb_${fileName}.jpg`);
        
        // Move file to permanent location
        await fs.rename(file.path, finalPath);
        
        // Create thumbnail
        await this.createThumbnail(finalPath, thumbnailPath);
        
        // Get document info for FTS
        const documentInfo = models.Document.findById(documentId);
        
        // Perform OCR if requested
        let ocrData = null;
        if (performOCRProcessing) {
            try {
                ocrData = await OCRService.performOCR(finalPath);
                console.log(`🔍 OCR completed for ${file.originalname}: ${ocrData.wordCount} words`);
            } catch (ocrError) {
                console.error(`⚠️ OCR failed for ${file.originalname}:`, ocrError.message);
            }
        }
        
        // Save page record with OCR data
        const pageData = {
            document_id: documentId,
            page_number: pageNumber,
            file_path: finalPath,
            file_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
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
        
        console.log(`✅ Created image page ${pageNumber} with ID ${pageId} for document ${documentId}`);
        
        // Update FTS index if OCR was performed
        if (ocrData && ocrData.text) {
            models.updateFTSIndex(pageId, documentId, documentInfo.project_id, documentInfo.title, ocrData.text);
        }
        
        return {
            id: pageId,
            page_number: pageNumber,
            file_name: file.originalname,
            file_path: finalPath,
            thumbnail_path: thumbnailPath,
            file_size: file.size,
            source_type: 'image',
            document_id: documentId,
            ocr_text: ocrData?.text || null,
            ocr_confidence: ocrData?.confidence || null,
            word_count: ocrData?.wordCount || 0
        };
    }

    /**
     * Validate image file
     * @param {Object} file - Multer file object
     * @returns {boolean}
     */
    static validateImageFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/tiff', 'image/tif'];
        return allowedTypes.includes(file.mimetype);
    }
}

module.exports = ImageService;