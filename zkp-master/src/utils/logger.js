import winston from 'winston';

export class Logger {
    constructor(service = 'ZKP-Master') {
        this.service = service;
        
        // Configure Winston logger
        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json(),
                winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                    return JSON.stringify({
                        timestamp,
                        level,
                        service: service || this.service,
                        message,
                        ...meta
                    });
                })
            ),
            defaultMeta: { service: this.service },
            transports: [
                // Console output
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                }),
                
                // File output for errors
                new winston.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    maxsize: 5242880, // 5MB
                    maxFiles: 5
                }),
                
                // File output for all logs
                new winston.transports.File({
                    filename: 'logs/combined.log',
                    maxsize: 5242880, // 5MB
                    maxFiles: 10
                })
            ]
        });
        
        // Create logs directory if it doesn't exist
        import('fs').then(fs => {
            if (!fs.existsSync('logs')) {
                fs.mkdirSync('logs', { recursive: true });
            }
        });
    }
    
    info(message, meta = {}) {
        this.logger.info(message, this.sanitizeMeta(meta));
    }
    
    warn(message, meta = {}) {
        this.logger.warn(message, this.sanitizeMeta(meta));
    }
    
    error(message, meta = {}) {
        this.logger.error(message, this.sanitizeMeta(meta));
    }
    
    debug(message, meta = {}) {
        this.logger.debug(message, this.sanitizeMeta(meta));
    }
    
    // Remove sensitive information from logs
    sanitizeMeta(meta) {
        if (!meta || typeof meta !== 'object') {
            return meta;
        }
        
        const sensitiveKeys = [
            'pan_number', 'pan_digits', 'name_hash', 'email_hash',
            'provided_otp', 'expected_otp', 'session_nonce', 'master_secret',
            'signature', 'private_input', 'witness', 'proving_key'
        ];
        
        const sanitized = { ...meta };
        
        // Recursively sanitize nested objects
        const sanitizeRecursive = (obj) => {
            if (Array.isArray(obj)) {
                return obj.map(item => sanitizeRecursive(item));
            }
            
            if (typeof obj === 'object' && obj !== null) {
                const result = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (sensitiveKeys.some(sensitive => 
                        key.toLowerCase().includes(sensitive.toLowerCase())
                    )) {
                        result[key] = '[REDACTED]';
                    } else {
                        result[key] = sanitizeRecursive(value);
                    }
                }
                return result;
            }
            
            return obj;
        };
        
        return sanitizeRecursive(sanitized);
    }
    
    // Special method for security-related events
    security(event, meta = {}) {
        this.logger.warn(`SECURITY: ${event}`, {
            ...this.sanitizeMeta(meta),
            security_event: true,
            timestamp: new Date().toISOString()
        });
    }
    
    // Performance monitoring
    performance(operation, duration, meta = {}) {
        this.logger.info(`PERFORMANCE: ${operation}`, {
            ...this.sanitizeMeta(meta),
            duration_ms: duration,
            performance_event: true
        });
    }
    
    // Circuit-specific logging
    circuit(circuitId, operation, meta = {}) {
        this.logger.info(`CIRCUIT: ${circuitId} - ${operation}`, {
            ...this.sanitizeMeta(meta),
            circuit_id: circuitId,
            circuit_operation: operation
        });
    }
}