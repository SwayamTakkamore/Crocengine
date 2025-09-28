import crypto from 'crypto';
import { createHash } from 'crypto';

export class SecurityService {
    constructor() {
        // Rate limiting storage (in production, use Redis or similar)
        this.rateLimitStore = new Map();
        this.signatureCache = new Map();
        
        // Security configuration
        this.config = {
            maxRequestsPerIP: 100, // per hour
            maxRequestsPerSession: 20, // per hour
            signatureCacheTTL: 300000, // 5 minutes
            allowedModuleKeys: new Set(), // Will be populated from env
            maxModulesPerRequest: 10,
            maxCommitmentAge: 3600, // 1 hour in seconds
        };
        
        this.initializeModuleKeys();
    }
    
    initializeModuleKeys() {
        // In production, load from secure key management system
        const moduleKeysEnv = process.env.MODULE_PUBLIC_KEYS;
        if (moduleKeysEnv) {
            const keys = moduleKeysEnv.split(',');
            keys.forEach(key => this.config.allowedModuleKeys.add(key.trim()));
        }
        
        // For demo, add some test keys
        this.config.allowedModuleKeys.add('test_pan_key_123');
        this.config.allowedModuleKeys.add('test_email_key_456');
        this.config.allowedModuleKeys.add('test_passport_key_789');
    }
    
    checkRateLimit(clientIP, sessionId = null) {
        const now = Date.now();
        const hourAgo = now - 3600000; // 1 hour ago
        
        // Clean old entries
        for (const [key, timestamps] of this.rateLimitStore.entries()) {
            const validTimestamps = timestamps.filter(ts => ts > hourAgo);
            if (validTimestamps.length === 0) {
                this.rateLimitStore.delete(key);
            } else {
                this.rateLimitStore.set(key, validTimestamps);
            }
        }
        
        // Check IP-based rate limit
        const ipKey = `ip:${clientIP}`;
        const ipRequests = this.rateLimitStore.get(ipKey) || [];
        if (ipRequests.length >= this.config.maxRequestsPerIP) {
            return false;
        }
        
        // Check session-based rate limit
        if (sessionId) {
            const sessionKey = `session:${sessionId}`;
            const sessionRequests = this.rateLimitStore.get(sessionKey) || [];
            if (sessionRequests.length >= this.config.maxRequestsPerSession) {
                return false;
            }
            
            // Update session counter
            sessionRequests.push(now);
            this.rateLimitStore.set(sessionKey, sessionRequests);
        }
        
        // Update IP counter
        ipRequests.push(now);
        this.rateLimitStore.set(ipKey, ipRequests);
        
        return true;
    }
    
    validateModules(modules) {
        const errors = [];
        
        if (modules.length > this.config.maxModulesPerRequest) {
            return {
                valid: false,
                errors: [`Too many modules: ${modules.length} (max: ${this.config.maxModulesPerRequest})`]
            };
        }
        
        for (let i = 0; i < modules.length; i++) {
            const module = modules[i];
            
            // 1. Validate module structure
            if (!this.isValidModuleStructure(module)) {
                errors.push(`Module ${i}: Invalid structure`);
                continue;
            }
            
            // 2. Validate signature
            const signatureValid = this.validateModuleSignature(module);
            if (!signatureValid) {
                errors.push(`Module ${i}: Invalid signature`);
            }
            
            // 3. Check timestamp freshness
            const now = Math.floor(Date.now() / 1000);
            if (module.timestamp < now - this.config.maxCommitmentAge) {
                errors.push(`Module ${i}: Commitment too old`);
            }
            
            // 4. Validate commitment format
            if (!this.isValidCommitment(module.commitment)) {
                errors.push(`Module ${i}: Invalid commitment format`);
            }
            
            // 5. Check for replay attacks
            if (this.isReplayAttack(module)) {
                errors.push(`Module ${i}: Potential replay attack detected`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    isValidModuleStructure(module) {
        const requiredFields = [
            'module_id', 'verification_flag', 'commitment', 
            'signature', 'timestamp'
        ];
        
        return requiredFields.every(field => 
            module.hasOwnProperty(field) && module[field] !== null && module[field] !== undefined
        );
    }
    
    validateModuleSignature(module) {
        try {
            // For demo purposes, simplified signature validation
            // In production, implement proper ECDSA signature verification
            
            const { module_id, verification_flag, commitment, timestamp, signature } = module;
            
            // Create message to verify
            const message = this.createSignatureMessage(module_id, verification_flag, commitment, timestamp);
            
            // Check signature format
            if (!signature || typeof signature !== 'string') {
                return false;
            }
            
            if (!signature.startsWith('0x') || signature.length < 130) {
                return false;
            }
            
            // Cache check to prevent re-verification
            const signatureKey = `${module_id}:${signature}`;
            if (this.signatureCache.has(signatureKey)) {
                const cached = this.signatureCache.get(signatureKey);
                return cached.valid && (Date.now() - cached.timestamp) < this.config.signatureCacheTTL;
            }
            
            // In production: verify signature against module's public key
            // const isValid = crypto.verify('sha256', Buffer.from(message), modulePublicKey, Buffer.from(signature, 'hex'));
            
            // For demo, simplified validation
            const isValid = signature.length >= 130 && signature.startsWith('0x');
            
            // Cache result
            this.signatureCache.set(signatureKey, {
                valid: isValid,
                timestamp: Date.now()
            });
            
            return isValid;
            
        } catch (error) {
            console.error('Signature validation error:', error);
            return false;
        }
    }
    
    createSignatureMessage(moduleId, verificationFlag, commitment, timestamp) {
        // Standard message format for signature verification
        return `${moduleId}:${verificationFlag}:${commitment}:${timestamp}`;
    }
    
    isValidCommitment(commitment) {
        if (!commitment || typeof commitment !== 'string') {
            return false;
        }
        
        // Must be 66-character hex string (0x + 64 hex digits)
        return /^0x[0-9a-fA-F]{64}$/.test(commitment);
    }
    
    isReplayAttack(module) {
        // Simple replay detection based on commitment uniqueness
        // In production, use proper nullifier tracking
        
        const replayKey = `commitment:${module.commitment}`;
        const now = Date.now();
        
        if (this.signatureCache.has(replayKey)) {
            const cached = this.signatureCache.get(replayKey);
            // If same commitment seen within last 5 minutes, likely replay
            return (now - cached.timestamp) < 300000;
        }
        
        // Record this commitment
        this.signatureCache.set(replayKey, { timestamp: now });
        return false;
    }
    
    secureDelete(sensitiveData) {
        // Attempt to securely overwrite sensitive data in memory
        // Note: This is best-effort in JavaScript; use native crypto for production
        
        try {
            if (typeof sensitiveData === 'object' && sensitiveData !== null) {
                this.recursiveSecureDelete(sensitiveData);
            }
        } catch (error) {
            console.error('Secure deletion error:', error);
        }
    }
    
    recursiveSecureDelete(obj) {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                if (typeof obj[i] === 'object' && obj[i] !== null) {
                    this.recursiveSecureDelete(obj[i]);
                }
                obj[i] = null;
            }
            obj.length = 0;
        } else if (typeof obj === 'object') {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        this.recursiveSecureDelete(obj[key]);
                    }
                    
                    // Overwrite string values with random data before deletion
                    if (typeof obj[key] === 'string') {
                        const randomData = crypto.randomBytes(obj[key].length).toString('hex');
                        obj[key] = randomData;
                    }
                    
                    delete obj[key];
                }
            }
        }
    }
    
    generateSecureNonce() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    hashSensitiveData(data) {
        // Use SHA-256 for hashing PII before circuit input
        if (typeof data === 'string') {
            return createHash('sha256').update(data).digest('hex');
        }
        
        if (Array.isArray(data)) {
            return data.map(item => this.hashSensitiveData(item));
        }
        
        if (typeof data === 'object' && data !== null) {
            const hashed = {};
            for (const [key, value] of Object.entries(data)) {
                hashed[key] = this.hashSensitiveData(value);
            }
            return hashed;
        }
        
        return data;
    }
    
    validateTimestamp(timestamp, maxAgeSeconds = 3600) {
        const now = Math.floor(Date.now() / 1000);
        const age = now - timestamp;
        
        return {
            valid: age >= 0 && age <= maxAgeSeconds,
            age,
            maxAge: maxAgeSeconds
        };
    }
    
    // Security audit logging
    auditLog(event, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            session: details.sessionId || 'unknown'
        };
        
        console.log('SECURITY_AUDIT:', JSON.stringify(logEntry));
        
        // In production, send to secure logging system
        // this.sendToSecurityLog(logEntry);
    }
    
    detectAnomalousPatterns(modules) {
        // Simple anomaly detection
        const anomalies = [];
        
        // Check for unusual module combinations
        const moduleTypes = modules.map(m => m.module_id.split('_')[0]);
        const uniqueTypes = new Set(moduleTypes);
        
        if (moduleTypes.length !== uniqueTypes.size) {
            anomalies.push('Duplicate module types detected');
        }
        
        // Check for suspicious timing patterns
        const timestamps = modules.map(m => m.timestamp).sort();
        for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] - timestamps[i-1] < 1) { // Less than 1 second apart
                anomalies.push('Suspiciously rapid verification sequence');
                break;
            }
        }
        
        return anomalies;
    }
}