/**
 * Example TypeScript file demonstrating type safety and modern ES features
 * This serves as a template for TypeScript development in the project
 */

export interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
}

export interface DocumentMetadata {
  id: string;
  title: string;
  size: number;
  mimeType: string;
  uploadedBy: User;
  uploadedAt: Date;
  tags: string[];
}

/**
 * Utility class for document management operations
 */
export class DocumentUtils {
  /**
   * Validates if a file type is supported for OCR processing
   * @param mimeType - The MIME type of the file
   * @returns true if the file type is supported
   */
  static isSupportedForOCR(mimeType: string): boolean {
    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/bmp',
    ];
    return supportedTypes.includes(mimeType);
  }

  /**
   * Formats file size in a human-readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Sanitizes a filename by removing potentially dangerous characters
   * @param filename - Original filename
   * @returns Sanitized filename
   */
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Generates metadata for a document
   * @param title - Document title
   * @param size - File size in bytes
   * @param mimeType - MIME type
   * @param uploadedBy - User who uploaded the document
   * @param tags - Optional tags for the document
   * @returns Document metadata object
   */
  static createDocumentMetadata(
    title: string,
    size: number,
    mimeType: string,
    uploadedBy: User,
    tags: string[] = []
  ): DocumentMetadata {
    return {
      id: crypto.randomUUID(),
      title: this.sanitizeFilename(title),
      size,
      mimeType,
      uploadedBy,
      uploadedAt: new Date(),
      tags: tags.map(tag => tag.toLowerCase().trim()),
    };
  }
}

/**
 * Example async function demonstrating error handling
 */
export async function processDocument(
  file: any, // Using any for now to avoid Express type dependency
  user: User
): Promise<DocumentMetadata> {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!DocumentUtils.isSupportedForOCR(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    const metadata = DocumentUtils.createDocumentMetadata(
      file.originalname,
      file.size,
      file.mimetype,
      user,
      ['uploaded', 'pending-ocr']
    );

    // Simulate some processing
    await new Promise(resolve => setTimeout(resolve, 100));

    return metadata;
  } catch (error) {
    // Console logging is acceptable for error handling in this context
    // eslint-disable-next-line no-console
    console.error('Error processing document:', error);
    throw error;
  }
}

// Example of a type guard
export function isValidUser(obj: any): obj is User {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.email === 'string' &&
    typeof obj.isActive === 'boolean' &&
    obj.createdAt instanceof Date
  );
}

// Export default utility instance
export default DocumentUtils;
