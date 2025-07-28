// newdms/services/FileService.js
const fs = require('fs').promises;
const path = require('path');
const { UPLOAD_DIR, IMAGE_DIR } = require('../config/environment');

class FileService {
    /**
     * Initialize upload directories
     */
    static async initializeUploadDirectories() {
        try {
            // Create upload directory
            await fs.mkdir(UPLOAD_DIR, { recursive: true });
            console.log(`📁 Upload directory created: ${UPLOAD_DIR}`);

            // Create image directory
            await fs.mkdir(IMAGE_DIR, { recursive: true });
            console.log(`📁 Image directory created: ${IMAGE_DIR}`);

            // Create thumbnails subdirectory
            const thumbnailDir = path.join(IMAGE_DIR, 'thumbnails');
            await fs.mkdir(thumbnailDir, { recursive: true });
            console.log(`📁 Thumbnail directory created: ${thumbnailDir}`);

        } catch (error) {
            console.error('❌ Failed to initialize upload directories:', error);
            throw error;
        }
    }

    /**
     * Check if file exists
     */
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Delete file safely
     */
    static async deleteFile(filePath) {
        try {
            if (await this.fileExists(filePath)) {
                await fs.unlink(filePath);
                console.log(`🗑️ File deleted: ${filePath}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to delete file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Get file stats
     */
    static async getFileStats(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory()
            };
        } catch (error) {
            console.error(`❌ Failed to get file stats for ${filePath}:`, error);
            return null;
        }
    }

    /**
     * Ensure directory exists
     */
    static async ensureDirectory(dirPath) {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return true;
        } catch (error) {
            console.error(`❌ Failed to create directory ${dirPath}:`, error);
            return false;
        }
    }

    /**
     * Copy file
     */
    static async copyFile(source, destination) {
        try {
            await fs.copyFile(source, destination);
            console.log(`📋 File copied from ${source} to ${destination}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to copy file from ${source} to ${destination}:`, error);
            throw error;
        }
    }

    /**
     * Move file
     */
    static async moveFile(source, destination) {
        try {
            await fs.rename(source, destination);
            console.log(`🔄 File moved from ${source} to ${destination}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to move file from ${source} to ${destination}:`, error);
            throw error;
        }
    }

    /**
     * Read file as buffer
     */
    static async readFile(filePath) {
        try {
            return await fs.readFile(filePath);
        } catch (error) {
            console.error(`❌ Failed to read file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * Write file from buffer
     */
    static async writeFile(filePath, data) {
        try {
            await fs.writeFile(filePath, data);
            console.log(`💾 File written: ${filePath}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to write file ${filePath}:`, error);
            throw error;
        }
    }

    /**
     * List files in directory
     */
    static async listFiles(dirPath, extension = null) {
        try {
            const files = await fs.readdir(dirPath);
            if (extension) {
                return files.filter(file => path.extname(file).toLowerCase() === extension.toLowerCase());
            }
            return files;
        } catch (error) {
            console.error(`❌ Failed to list files in ${dirPath}:`, error);
            return [];
        }
    }

    /**
     * Get file extension
     */
    static getFileExtension(filename) {
        return path.extname(filename).toLowerCase();
    }

    /**
     * Generate unique filename
     */
    static generateUniqueFilename(originalName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(originalName);
        const name = path.basename(originalName, ext);
        
        return `${name}_${timestamp}_${random}${ext}`;
    }

    /**
     * Validate file type
     */
    static isValidFileType(filename, allowedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.tif']) {
        const ext = this.getFileExtension(filename);
        return allowedTypes.includes(ext);
    }

    /**
     * Get MIME type from extension
     */
    static getMimeType(filename) {
        const ext = this.getFileExtension(filename);
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.tiff': 'image/tiff',
            '.tif': 'image/tiff',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp'
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }
}

module.exports = FileService;