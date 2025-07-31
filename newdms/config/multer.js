// newdms/config/multer.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { UPLOAD_DIR, MAX_FILE_SIZE } = require('./environment');
const { ALLOWED_FILE_TYPES } = require('./constants');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + uuidv4();
        const ext = path.extname(file.originalname);
        cb(null, 'upload-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = Object.keys(ALLOWED_FILE_TYPES);
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error('File type ' + file.mimetype + ' is not supported');
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: fileFilter
});

module.exports = { upload };