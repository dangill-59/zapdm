// newdms/routes/searchRoutes.js
const express = require('express');
const { AuthService } = require('../services');
const { HTTP_STATUS, PERMISSIONS } = require('../config/constants');
const { asyncHandler } = require('../middleware');

const router = express.Router();

/**
 * GET /api/search
 * Full-text search across documents
 */
router.get('/',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.DOCUMENT_VIEW, PERMISSIONS.ADMIN_ACCESS]),
    asyncHandler(async (req, res) => {
        try {
            const { 
                q: query,
                project_id,
                limit = 20,
                offset = 0,
                include_content = 'true'
            } = req.query;

            if (!query || query.trim().length < 2) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Search query must be at least 2 characters long'
                });
            }

            const searchQuery = query.trim();
            const searchLimit = Math.min(parseInt(limit), 100); // Max 100 results
            const searchOffset = parseInt(offset);

            // Build base where clause for user access
            let projectAccessClause = {};
            
            // Check if user has admin access
            const hasAdminAccess = req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS);
            
            if (!hasAdminAccess) {
                // Regular users can only search in projects they have access to
                const accessibleProjects = await req.models.Project.findAll({
                    include: [{
                        model: req.models.ProjectRole,
                        as: 'projectRoles',
                        where: { roleId: req.user.roleId },
                        attributes: []
                    }],
                    attributes: ['id']
                });
                
                const projectIds = accessibleProjects.map(p => p.id);
                
                if (projectIds.length === 0) {
                    return res.json({
                        results: [],
                        total: 0,
                        query: searchQuery,
                        limit: searchLimit,
                        offset: searchOffset
                    });
                }
                
                projectAccessClause = {
                    project_id: { [req.models.Sequelize.Op.in]: projectIds }
                };
            }

            // Add project filter if specified
            if (project_id) {
                // Verify user has access to this specific project
                if (!hasAdminAccess) {
                    const hasProjectAccess = await checkProjectAccess(req, project_id);
                    if (!hasProjectAccess) {
                        return res.status(HTTP_STATUS.FORBIDDEN).json({
                            error: 'Access denied to specified project'
                        });
                    }
                }
                projectAccessClause.project_id = project_id;
            }

            let searchResults = [];
            let totalCount = 0;

            // Try FTS search first (if available)
            try {
                const ftsQuery = `
                    SELECT 
                        fts.document_id,
                        fts.page_id,
                        fts.page_number,
                        fts.content,
                        snippet(document_search, '[', ']') as snippet,
                        rank as relevance,
                        d.title as document_title,
                        d.description as document_description,
                        d.project_id,
                        p.name as project_name
                    FROM document_search fts
                    JOIN documents d ON fts.document_id = d.id
                    JOIN projects p ON d.project_id = p.id
                    WHERE document_search MATCH ?
                    ${project_id ? 'AND d.project_id = ?' : ''}
                    ${!hasAdminAccess ? `AND d.project_id IN (${accessibleProjects.map(p => p.id).join(',')})` : ''}
                    AND d.status = 'active'
                    ORDER BY rank
                    LIMIT ? OFFSET ?
                `;

                const queryParams = [searchQuery];
                if (project_id) queryParams.push(project_id);
                queryParams.push(searchLimit, searchOffset);

                const ftsResults = await req.models.sequelize.query(ftsQuery, {
                    replacements: queryParams,
                    type: req.models.Sequelize.QueryTypes.SELECT
                });

                // Get total count for FTS
                const countQuery = `
                    SELECT COUNT(*) as total
                    FROM document_search fts
                    JOIN documents d ON fts.document_id = d.id
                    WHERE document_search MATCH ?
                    ${project_id ? 'AND d.project_id = ?' : ''}
                    ${!hasAdminAccess ? `AND d.project_id IN (${accessibleProjects.map(p => p.id).join(',')})` : ''}
                    AND d.status = 'active'
                `;

                const countParams = [searchQuery];
                if (project_id) countParams.push(project_id);

                const countResult = await req.models.sequelize.query(countQuery, {
                    replacements: countParams,
                    type: req.models.Sequelize.QueryTypes.SELECT
                });

                totalCount = countResult[0]?.total || 0;
                searchResults = ftsResults;

            } catch (ftsError) {
                console.warn('FTS search failed, falling back to basic search:', ftsError.message);
                
                // Fallback to basic document title/description search
                const whereClause = {
                    ...projectAccessClause,
                    status: 'active',
                    [req.models.Sequelize.Op.or]: [
                        { title: { [req.models.Sequelize.Op.like]: `%${searchQuery}%` } },
                        { description: { [req.models.Sequelize.Op.like]: `%${searchQuery}%` } }
                    ]
                };

                const { count, rows: documents } = await req.models.Document.findAndCountAll({
                    where: whereClause,
                    include: [
                        {
                            model: req.models.Project,
                            as: 'project',
                            attributes: ['id', 'name']
                        },
                        {
                            model: req.models.DocumentPage,
                            as: 'pages',
                            attributes: ['id', 'pageNumber'],
                            where: { status: 'active' },
                            required: false,
                            limit: 1
                        }
                    ],
                    limit: searchLimit,
                    offset: searchOffset,
                    order: [['updatedAt', 'DESC']]
                });

                totalCount = count;
                
                // Transform to match FTS result format
                searchResults = documents.map(doc => ({
                    document_id: doc.id,
                    page_id: doc.pages[0]?.id || null,
                    page_number: doc.pages[0]?.pageNumber || 1,
                    document_title: doc.title,
                    document_description: doc.description,
                    project_id: doc.project.id,
                    project_name: doc.project.name,
                    snippet: doc.description || doc.title,
                    relevance: 1.0,
                    content: include_content === 'true' ? (doc.description || '') : null
                }));
            }

            // Group results by document
            const documentMap = new Map();
            
            searchResults.forEach(result => {
                const docId = result.document_id;
                
                if (!documentMap.has(docId)) {
                    documentMap.set(docId, {
                        document_id: docId,
                        title: result.document_title,
                        description: result.document_description,
                        project_id: result.project_id,
                        project_name: result.project_name,
                        matches: [],
                        total_relevance: 0
                    });
                }
                
                const doc = documentMap.get(docId);
                doc.matches.push({
                    page_id: result.page_id,
                    page_number: result.page_number,
                    snippet: result.snippet,
                    relevance: result.relevance,
                    content: result.content
                });
                doc.total_relevance += result.relevance;
            });

            // Convert map to array and sort by relevance
            const groupedResults = Array.from(documentMap.values())
                .sort((a, b) => b.total_relevance - a.total_relevance);

            res.json({
                results: groupedResults,
                total: totalCount,
                query: searchQuery,
                limit: searchLimit,
                offset: searchOffset,
                search_type: searchResults.length > 0 && searchResults[0].snippet ? 'fts' : 'basic'
            });

        } catch (error) {
            console.error('Search error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Search failed'
            });
        }
    })
);

/**
 * GET /api/search/suggestions
 * Get search suggestions based on existing content
 */
router.get('/suggestions',
    AuthService.authenticateToken,
    AuthService.authorize([PERMISSIONS.DOCUMENT_VIEW, PERMISSIONS.ADMIN_ACCESS]),
    asyncHandler(async (req, res) => {
        try {
            const { q: query, limit = 10 } = req.query;

            if (!query || query.trim().length < 1) {
                return res.json({ suggestions: [] });
            }

            const searchQuery = query.trim();
            const suggestionLimit = Math.min(parseInt(limit), 20);

            // Check user access
            const hasAdminAccess = req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS);
            let projectAccessClause = {};

            if (!hasAdminAccess) {
                const accessibleProjects = await req.models.Project.findAll({
                    include: [{
                        model: req.models.ProjectRole,
                        as: 'projectRoles',
                        where: { roleId: req.user.roleId },
                        attributes: []
                    }],
                    attributes: ['id']
                });

                const projectIds = accessibleProjects.map(p => p.id);
                if (projectIds.length === 0) {
                    return res.json({ suggestions: [] });
                }

                projectAccessClause = {
                    project_id: { [req.models.Sequelize.Op.in]: projectIds }
                };
            }

            // Get document title suggestions
            const documents = await req.models.Document.findAll({
                where: {
                    ...projectAccessClause,
                    status: 'active',
                    title: { [req.models.Sequelize.Op.like]: `%${searchQuery}%` }
                },
                attributes: ['title'],
                limit: suggestionLimit,
                order: [['updatedAt', 'DESC']]
            });

            const suggestions = documents.map(doc => ({
                text: doc.title,
                type: 'document'
            }));

            res.json({ suggestions });

        } catch (error) {
            console.error('Search suggestions error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to get search suggestions'
            });
        }
    })
);

/**
 * GET /api/search/recent
 * Get recent searches for the user
 */
router.get('/recent',
    AuthService.authenticateToken,
    asyncHandler(async (req, res) => {
        try {
            const { limit = 10 } = req.query;

            // This would typically come from a search_history table
            // For now, return empty array as this feature needs additional implementation
            res.json({
                recent_searches: [],
                message: 'Recent searches feature not yet implemented'
            });

        } catch (error) {
            console.error('Recent searches error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to get recent searches'
            });
        }
    })
);

/**
 * POST /api/search/save
 * Save a search query for the user
 */
router.post('/save',
    AuthService.authenticateToken,
    asyncHandler(async (req, res) => {
        try {
            const { query, name } = req.body;

            if (!query || !name) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json({
                    error: 'Query and name are required'
                });
            }

            // This would typically save to a saved_searches table
            // For now, return success message as this feature needs additional implementation
            res.json({
                message: 'Search saved successfully',
                saved_search: {
                    id: Date.now(), // Temporary ID
                    name,
                    query,
                    created_at: new Date()
                }
            });

        } catch (error) {
            console.error('Save search error:', error);
            res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to save search'
            });
        }
    })
);

/**
 * Helper function to check project access
 */
async function checkProjectAccess(req, projectId) {
    // Admin users have access to all projects
    if (req.user.permissions && req.user.permissions.includes(PERMISSIONS.ADMIN_ACCESS)) {
        return true;
    }

    // Check if user's role is assigned to this project
    const projectRole = await req.models.ProjectRole.findOne({
        where: {
            projectId: projectId,
            roleId: req.user.roleId
        }
    });

    return !!projectRole;
}

module.exports = router;