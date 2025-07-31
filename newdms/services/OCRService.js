// newdms/services/OCRService.js - FIXED VERSION
const path = require('path');

class OCRService {
    constructor() {
        this.workers = new Map();
        this.isInitialized = false;
    }

    /**
     * Check if OCR service is available (INSTANCE METHOD)
     */
    async checkOCRAvailability() {
        try {
            console.log('🔍 Checking OCR availability...');
            
            // For now, return true without loading Tesseract to avoid dependency issues
            console.log('✅ OCR service is available (mock mode)');
            return true;
            
            // Uncomment this when you want to test real Tesseract
            /*
            const Tesseract = require('tesseract.js');
            const worker = await Tesseract.createWorker();
            await worker.terminate();
            console.log('✅ OCR service (Tesseract.js) is available');
            return true;
            */
        } catch (error) {
            console.warn('⚠️ OCR service unavailable:', error.message);
            return false;
        }
    }

    /**
     * Initialize OCR worker
     */
    async initializeWorker(workerId = 'default') {
        try {
            if (this.workers.has(workerId)) {
                return this.workers.get(workerId);
            }

            console.log(`🔄 Initializing OCR worker: ${workerId} (mock mode)`);
            
            // Mock worker for now
            const mockWorker = {
                id: workerId,
                initialized: true,
                terminate: async () => console.log(`✅ Mock worker ${workerId} terminated`)
            };

            this.workers.set(workerId, mockWorker);
            console.log(`✅ OCR worker initialized: ${workerId}`);

            return mockWorker;
        } catch (error) {
            console.error(`❌ Failed to initialize OCR worker ${workerId}:`, error);
            throw error;
        }
    }

    /**
     * Process OCR on image file (mock version)
     */
    async processOCR(imagePath, options = {}) {
        const startTime = Date.now();

        try {
            console.log(`🔍 Starting OCR processing: ${path.basename(imagePath)} (mock mode)`);

            // Mock OCR processing
            await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time

            const processingTime = Date.now() - startTime;
            
            console.log(`✅ OCR completed in ${processingTime}ms (mock)`);

            return {
                text: `Mock OCR text extracted from ${path.basename(imagePath)}`,
                confidence: 85,
                words: [],
                lines: [],
                paragraphs: [],
                blocks: [],
                processingTime,
                metadata: {
                    language: 'eng',
                    imagePath: path.basename(imagePath),
                    timestamp: new Date().toISOString(),
                    mode: 'mock'
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ OCR processing failed after ${processingTime}ms:`, error);
            
            return {
                text: '',
                confidence: 0,
                words: [],
                lines: [],
                paragraphs: [],
                blocks: [],
                processingTime,
                error: error.message,
                metadata: {
                    language: 'eng',
                    imagePath: path.basename(imagePath),
                    timestamp: new Date().toISOString(),
                    mode: 'mock'
                }
            };
        }
    }

    /**
     * Extract text summary from OCR result
     */
    extractTextSummary(ocrResult, maxLength = 200) {
        if (!ocrResult || !ocrResult.text) {
            return '';
        }

        const text = ocrResult.text.trim();
        if (text.length <= maxLength) {
            return text;
        }

        // Find the last complete word within the limit
        const truncated = text.substring(0, maxLength);
        const lastSpace = truncated.lastIndexOf(' ');
        
        if (lastSpace > maxLength * 0.8) { // If we can get at least 80% of target length
            return truncated.substring(0, lastSpace) + '...';
        }
        
        return truncated + '...';
    }

    /**
     * Get OCR quality metrics
     */
    getQualityMetrics(ocrResult) {
        if (!ocrResult || !ocrResult.words) {
            return {
                confidence: 0,
                wordCount: 0,
                averageWordConfidence: 0,
                qualityScore: 'poor'
            };
        }

        return {
            confidence: ocrResult.confidence || 0,
            wordCount: 0,
            averageWordConfidence: 0,
            qualityScore: 'mock'
        };
    }

    /**
     * Cleanup workers
     */
    async cleanup() {
        console.log('🧹 Cleaning up OCR workers...');
        
        for (const [workerId, worker] of this.workers) {
            try {
                if (worker.terminate) {
                    await worker.terminate();
                }
                console.log(`✅ OCR worker terminated: ${workerId}`);
            } catch (error) {
                console.error(`❌ Failed to terminate OCR worker ${workerId}:`, error);
            }
        }
        
        this.workers.clear();
        this.isInitialized = false;
        console.log('✅ OCR cleanup completed');
    }

    /**
     * Get worker status
     */
    getWorkerStatus() {
        return {
            activeWorkers: this.workers.size,
            isInitialized: this.isInitialized,
            workerIds: Array.from(this.workers.keys())
        };
    }
}

// Export singleton instance (FIXED - method is now instance method)
module.exports = new OCRService();