const fs = require('fs');
const path = require('path');

class FileService {
  static async initializeUploadDirectories() {
    const dirs = [
      process.env.UPLOAD_DIR || 'uploads',
      process.env.IMAGE_DIR || 'uploads/images'
    ];
    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }
}

module.exports = FileService;