// newdms/middleware/upload.middleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_DIR, MAX_FILE_SIZE } = require('../config/environment');
const { ALLOWED_FILE_TYPES, HTTP_STATUS } = require('../config/constants');

// Enhanced file upload configuration
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(UPLOAD_DIR, 'temp');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const extname = ALLOWED_FILE_TYPES.EXTENSIONS.test(
        path.extname(file.originalname).toLowerCase()
    );
    const mimetype = ALLOWED_FILE_TYPES.MIME_TYPES.includes(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        const error = new Error('Invalid file type. Supported: PDF, JPG, PNG, TIFF');
        error.status = HTTP_STATUS.BAD_REQUEST;
        cb(error);
    }
};

// Different upload configurations
const singleFileUpload = multer({ 
    storage,
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 1
    },
    fileFilter
}).single('file');

const multipleFileUpload = multer({ 
    storage,
    limits: { 
        fileSize: MAX_FILE_SIZE,
        files: 10 // Max 10 files
    },
    fileFilter
}).array('files', 10);

// Upload middleware with error handling
const handleUpload = (uploadFunction) => {
    return (req, res, next) => {
        uploadFunction(req, res, (error) => {
            if (error) {
                if (error instanceof multer.MulterError) {
                    if (error.code === 'LIMIT_FILE_SIZE') {
                        return res.status(HTTP_STATUS.BAD_REQUEST).json({
                            error: 'File too large',
                            maxSize: `${MAX_FILE_SIZE / (1024 * 1024)}MB`
                        });
                    }
                    if (error.code === 'LIMIT_FILE_COUNT') {
                        return res.status(HTTP_STATUS.BAD_REQUEST).json({
                            error: 'Too many files'
                        });
                    }
                }
                
                return res.status(error.status || HTTP_STATUS.BAD_REQUEST).json({
                    error: error.message
                });
            }
            next();
        });
    };
};

module.exports = {
    singleFileUpload: handleUpload(singleFileUpload),
    multipleFileUpload: handleUpload(multipleFileUpload),
    storage,
    fileFilter
};