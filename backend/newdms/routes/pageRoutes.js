// newdms/routes/page.routes.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { OCRService, ImageService, AuditService } = require('../services');
const { 
    authenticateJWT, 
    requirePermission, 
    validateId, 
    auditLogger, 
    asyncHandler 
} = require('../middleware');
const { IMAGE_DIR } = require('../config/environment');
const { HTTP_STATUS, AUDIT_ACTIONS, PERMISSIONS } = require('../config/constants');

const router = express.Router();

/**
 * GET /api/pages/:pageId/content
 * Get page image content
 */
router.get('/:pageId/content',
    authenticateJWT,
    requirePermission(PERMISSIONS.DOCUMENT_VIEW),
    validateId('pageId'),
    asyncHandler(async (req, res) => {
        const { pageId } = req.params;

        try {
            const page = await req.models.Page.findByPk(pageId, {
                include: [{ 
                    model: req.models.Document, 
                    as: 'document',
                    include: [{ model: req.models.Project, as: 'project' }]
                }]
            });

            if (!page) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page not found'
                });
            }

            // Check if user has access to this project
            const hasAccess = await req.models.ProjectUser.findOne({
                where: {
                    projectId: page.document.projectId,
                    userId: req.user.id
                }
            });

            if (!hasAccess && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            const imagePath = path.join(IMAGE_DIR, page.imagePath);
            
            // Check if file exists
            try {
                await fs.access(imagePath);
            } catch (error) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page image not found'
                });
            }

            // Set appropriate headers
            res.set({
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=3600', // 1 hour cache
                'Content-Disposition': `inline; filename="page-${pageId}.jpg"`
            });

            // Send file
            res.sendFile(path.resolve(imagePath));

        } catch (error) {
            console.error('Error serving page content:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to serve page content'
            });
        }
    })
);

/**
 * GET /api/pages/:pageId/thumbnail
 * Get page thumbnail
 */
router.get('/:pageId/thumbnail',
    authenticateJWT,
    requirePermission(PERMISSIONS.DOCUMENT_VIEW),
    validateId('pageId'),
    asyncHandler(async (req, res) => {
        const { pageId } = req.params;

        try {
            const page = await req.models.Page.findByPk(pageId, {
                include: [{ 
                    model: req.models.Document, 
                    as: 'document',
                    include: [{ model: req.models.Project, as: 'project' }]
                }]
            });

            if (!page) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page not found'
                });
            }

            // Check access
            const hasAccess = await req.models.ProjectUser.findOne({
                where: {
                    projectId: page.document.projectId,
                    userId: req.user.id
                }
            });

            if (!hasAccess && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            let thumbnailPath;
            
            if (page.thumbnailPath) {
                thumbnailPath = path.join(IMAGE_DIR, page.thumbnailPath);
            } else {
                // Generate thumbnail if it doesn't exist
                const imagePath = path.join(IMAGE_DIR, page.imagePath);
                thumbnailPath = await ImageService.generateThumbnail(imagePath, pageId);
                
                // Update page with thumbnail path
                await page.update({ 
                    thumbnailPath: path.relative(IMAGE_DIR, thumbnailPath) 
                });
            }

            // Set headers
            res.set({
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=86400', // 24 hour cache
                'Content-Disposition': `inline; filename="thumb-${pageId}.jpg"`
            });

            res.sendFile(path.resolve(thumbnailPath));

        } catch (error) {
            console.error('Error serving page thumbnail:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to serve page thumbnail'
            });
        }
    })
);

/**
 * GET /api/pages/:pageId/ocr
 * Get OCR text for a page
 */
router.get('/:pageId/ocr',
    authenticateJWT,
    requirePermission(PERMISSIONS.DOCUMENT_VIEW),
    validateId('pageId'),
    asyncHandler(async (req, res) => {
        const { pageId } = req.params;

        try {
            const page = await req.models.Page.findByPk(pageId, {
                include: [{ 
                    model: req.models.Document, 
                    as: 'document',
                    include: [{ model: req.models.Project, as: 'project' }]
                }]
            });

            if (!page) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page not found'
                });
            }

            // Check access
            const hasAccess = await req.models.ProjectUser.findOne({
                where: {
                    projectId: page.document.projectId,
                    userId: req.user.id
                }
            });

            if (!hasAccess && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            res.json({
                pageId: page.id,
                ocrText: page.ocrText || '',
                ocrProcessed: !!page.ocrText,
                ocrProcessedAt: page.ocrProcessedAt,
                confidence: page.ocrConfidence || 0
            });

        } catch (error) {
            console.error('Error getting OCR text:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to get OCR text'
            });
        }
    })
);

/**
 * POST /api/pages/:pageId/ocr
 * Process OCR for a specific page
 */
router.post('/:pageId/ocr',
    authenticateJWT,
    requirePermission(PERMISSIONS.DOCUMENT_OCR),
    validateId('pageId'),
    auditLogger(AUDIT_ACTIONS.OCR),
    asyncHandler(async (req, res) => {
        const { pageId } = req.params;

        try {
            const page = await req.models.Page.findByPk(pageId, {
                include: [{ 
                    model: req.models.Document, 
                    as: 'document',
                    include: [{ model: req.models.Project, as: 'project' }]
                }]
            });

            if (!page) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page not found'
                });
            }

            // Check access
            const hasAccess = await req.models.ProjectUser.findOne({
                where: {
                    projectId: page.document.projectId,
                    userId: req.user.id
                }
            });

            if (!hasAccess && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            const imagePath = path.join(IMAGE_DIR, page.imagePath);

            // Process OCR
            const ocrResult = await OCRService.processImage(imagePath);

            // Update page with OCR results
            await page.update({
                ocrText: ocrResult.text,
                ocrConfidence: ocrResult.confidence,
                ocrProcessedAt: new Date()
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.OCR,
                userId: req.user.id,
                details: `OCR processed for page ${pageId}`,
                entityType: 'page',
                entityId: pageId
            });

            res.json({
                pageId: page.id,
                ocrText: ocrResult.text,
                confidence: ocrResult.confidence,
                processedAt: new Date()
            });

        } catch (error) {
            console.error('Error processing OCR:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to process OCR'
            });
        }
    })
);

/**
 * DELETE /api/pages/:pageId
 * Soft delete a page
 */
router.delete('/:pageId',
    authenticateJWT,
    requirePermission(PERMISSIONS.DOCUMENT_DELETE),
    validateId('pageId'),
    auditLogger(AUDIT_ACTIONS.DELETE),
    asyncHandler(async (req, res) => {
        const { pageId } = req.params;

        try {
            const page = await req.models.Page.findByPk(pageId, {
                include: [{ 
                    model: req.models.Document, 
                    as: 'document',
                    include: [{ model: req.models.Project, as: 'project' }]
                }]
            });

            if (!page) {
                return res.status(HTTP_STATUS.NOT_FOUND).json({
                    error: 'Page not found'
                });
            }

            // Check access
            const hasAccess = await req.models.ProjectUser.findOne({
                where: {
                    projectId: page.document.projectId,
                    userId: req.user.id
                }
            });

            if (!hasAccess && req.user.role !== 'Administrator') {
                return res.status(HTTP_STATUS.FORBIDDEN).json({
                    error: 'Access denied to this project'
                });
            }

            // Soft delete
            await page.update({ 
                deleted: true,
                deletedAt: new Date(),
                deletedBy: req.user.id
            });

            // Log the action
            await AuditService.log({
                action: AUDIT_ACTIONS.DELETE,
                userId: req.user.id,
                details: `Page ${pageId} soft deleted`,
                entityType: 'page',
                entityId: pageId
            });

            res.json({ 
                message: 'Page deleted successfully',
                pageId: pageId
            });

        } catch (error) {
            console.error('Error deleting page:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to delete page'
            });
        }
    })
);

module.exports = router;