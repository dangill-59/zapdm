// newdms/middleware/logging.middleware.js
const fs = require('fs');
const path = require('path');

/**
 * Request Logger Middleware
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        user: req.user ? req.user.username : 'anonymous'
    };

    console.log(`${logData.timestamp} ${logData.method} ${logData.url} - ${logData.ip}`);

    // Override res.end to capture response details
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        console.log(`${logData.timestamp} ${logData.method} ${logData.url} - ${res.statusCode} - ${duration}ms`);
        
        // Log to file in production
        if (process.env.NODE_ENV === 'production') {
            const logEntry = {
                ...logData,
                statusCode: res.statusCode,
                duration,
                responseTime: new Date().toISOString()
            };
            
            logToFile('access.log', logEntry);
        }
        
        originalEnd.call(this, chunk, encoding);
    };

    next();
};

/**
 * Error Logger Middleware
 */
const errorLogger = (error, req, res, next) => {
    const errorLog = {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        user: req.user ? req.user.username : 'anonymous'
    };

    // Log to file
    logToFile('error.log', errorLog);
    
    next(error);
};

/**
 * Audit Logger for sensitive operations
 */
const auditLogger = (action) => {
    return (req, res, next) => {
        const auditLog = {
            timestamp: new Date().toISOString(),
            action,
            user: req.user ? req.user.username : 'anonymous',
            userId: req.user ? req.user.id : null,
            ip: req.ip,
            details: {
                method: req.method,
                url: req.originalUrl,
                params: req.params,
                body: sanitizeBody(req.body)
            }
        };

        console.log(`AUDIT: ${action} by ${auditLog.user} from ${auditLog.ip}`);
        logToFile('audit.log', auditLog);

        next();
    };
};

/**
 * Helper function to log to file
 */
function logToFile(filename, data) {
    try {
        const logsDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        const logPath = path.join(logsDir, filename);
        const logEntry = JSON.stringify(data) + '\n';
        
        fs.appendFileSync(logPath, logEntry);
    } catch (error) {
        console.error('Failed to write to log file:', error);
    }
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    
    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    sensitiveFields.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    
    return sanitized;
}

module.exports = {
    requestLogger,
    errorLogger,
    auditLogger
};