/**
 * Sample Jest test demonstrating testing best practices
 * This serves as a template for writing tests in the project
 */

const request = require('supertest');

// Mock a simple Express app for testing
const express = require('express');
const app = express();

app.use(express.json());

// Simple endpoint for testing
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.post('/upload', (req, res) => {
  const { filename, size } = req.body;

  if (!filename || !size) {
    return res.status(400).json({ error: 'filename and size are required' });
  }

  if (size > 10 * 1024 * 1024) {
    // 10MB limit
    return res.status(413).json({ error: 'File too large' });
  }

  res.status(201).json({
    id: Math.random().toString(36).substr(2, 9),
    filename,
    size,
    uploaded: true,
    timestamp: new Date().toISOString(),
  });
});

// Utility functions for testing
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

// Test suites
describe('Health Check Endpoint', () => {
  test('should return health status', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('uptime');
    expect(typeof response.body.uptime).toBe('number');
  });
});

describe('Upload Endpoint', () => {
  test('should successfully upload a file', async () => {
    const fileData = {
      filename: 'test-document.pdf',
      size: 1024,
    };

    const response = await request(app)
      .post('/upload')
      .send(fileData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('filename', fileData.filename);
    expect(response.body).toHaveProperty('size', fileData.size);
    expect(response.body).toHaveProperty('uploaded', true);
    expect(response.body).toHaveProperty('timestamp');
  });

  test('should reject upload without filename', async () => {
    const response = await request(app)
      .post('/upload')
      .send({ size: 1024 })
      .expect(400);

    expect(response.body).toHaveProperty(
      'error',
      'filename and size are required'
    );
  });

  test('should reject upload without size', async () => {
    const response = await request(app)
      .post('/upload')
      .send({ filename: 'test.pdf' })
      .expect(400);

    expect(response.body).toHaveProperty(
      'error',
      'filename and size are required'
    );
  });

  test('should reject files that are too large', async () => {
    const fileData = {
      filename: 'large-file.pdf',
      size: 15 * 1024 * 1024, // 15MB
    };

    const response = await request(app)
      .post('/upload')
      .send(fileData)
      .expect(413);

    expect(response.body).toHaveProperty('error', 'File too large');
  });
});

describe('Utility Functions', () => {
  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    test('should handle decimal places', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2097152)).toBe('2 MB');
    });
  });

  describe('sanitizeFilename', () => {
    test('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<>name.pdf')).toBe('file_name.pdf');
      expect(sanitizeFilename('my|file*.txt')).toBe('my_file_.txt');
    });

    test('should handle consecutive special characters', () => {
      expect(sanitizeFilename('file!!!name.pdf')).toBe('file_name.pdf');
    });

    test('should remove leading and trailing underscores', () => {
      expect(sanitizeFilename('_file_')).toBe('file');
      expect(sanitizeFilename('___test___.txt')).toBe('test_.txt');
    });

    test('should preserve valid characters', () => {
      expect(sanitizeFilename('valid-file.name123.pdf')).toBe(
        'valid-file.name123.pdf'
      );
    });
  });
});

// Integration test example
describe('Integration Tests', () => {
  test('should handle a complete upload workflow', async () => {
    // Test the health endpoint first
    await request(app).get('/health').expect(200);

    // Then test file upload
    const fileData = {
      filename: 'integration-test.pdf',
      size: 2048,
    };

    const uploadResponse = await request(app)
      .post('/upload')
      .send(fileData)
      .expect(201);

    // Verify the response has all required fields
    expect(uploadResponse.body.id).toBeDefined();
    expect(uploadResponse.body.filename).toBe(fileData.filename);
    expect(uploadResponse.body.size).toBe(fileData.size);
    expect(uploadResponse.body.uploaded).toBe(true);

    // Verify timestamp is recent (within last minute)
    const uploadTime = new Date(uploadResponse.body.timestamp);
    const now = new Date();
    const timeDiff = now.getTime() - uploadTime.getTime();
    expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
  });
});

// Test teardown
afterAll(async () => {
  // Clean up any resources if needed
  // For example, close database connections, clean temp files, etc.
});
