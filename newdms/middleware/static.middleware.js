// newdms/middleware/static.middleware.js
const express = require('express');
const path = require('path');
const { UPLOAD_DIR, IMAGE_DIR } = require('../config/environment');

/**
 * Configure static file serving with proper headers
 */
const configureStaticFiles = (app) => {
    // Serve upload files with cache control
    app.use('/uploads', 
        express.static(UPLOAD_DIR, {
            maxAge: '1d', // Cache for 1 day
            etag: true,
            lastModified: true
        })
    );

    // Serve image files with longer cache
    app.use('/images', 
        express.static(IMAGE_DIR, {
            maxAge: '7d', // Cache for 7 days
            etag: true,
            lastModified: true
        })
    );

    // Serve public files (frontend)
    app.use(express.static('public', {
        maxAge: '1h',
        index: ['index.html']
    }));
};

module.exports = {
    configureStaticFiles
};