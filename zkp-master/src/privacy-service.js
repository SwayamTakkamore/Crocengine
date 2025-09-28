import crypto from 'crypto';
import { poseidon } from 'poseidon-lite';

/**
 * Privacy Service - Implements advanced privacy-preserving features
 * for the ZKP Master Module including nullifiers, unlinkability, and
 * secure data handling.
 */
export class PrivacyService {
    constructor() {
        this.nullifierStore = new Map(); // In production, use persistent storage
        this.sessionStore = new Map();
        this.commitmentStore = new Map();
        
        this.config = {
            nullifierTTL: 86400000, // 24 hours in ms
            sessionTTL: 3600000,    // 1 hour in ms
            maxSessionsPerUser: 10,  // Maximum concurrent sessions per user
            commitmentCacheTTL: 1800000 // 30 minutes
        };
        
        // Initialize cleanup interval
        this.startCleanupTimer();
    }
    
    /**
     * Generate a nullifier for preventing double-spending/reuse
     * Uses a combination of commitment root, session data, and user context
     */
    generateNullifier(commitmentRoot, sessionId, timestamp, userContext = null) {
        const inputs = [
            BigInt(commitmentRoot),
            this.stringToFieldElement(sessionId),
            BigInt(timestamp)
        ];
        
        // Add user context for additional entropy while maintaining privacy
        if (userContext) {
            const contextHash = this.hashUserContext(userContext);
            inputs.push(BigInt(contextHash));
        }
        
        const nullifier = poseidon(inputs);
        const nullifierHex = '0x' + nullifier.toString(16).padStart(64, '0');
        
        // Store nullifier to prevent reuse
        this.storeNullifier(nullifierHex, sessionId, timestamp);
        
        return nullifierHex;
    }
    
    /**
     * Check if a nullifier has been used before (replay protection)
     */
    isNullifierUsed(nullifier) {
        const stored = this.nullifierStore.get(nullifier);
        if (!stored) return false;
        
        // Check if nullifier is still valid (not expired)
        const now = Date.now();
        return (now - stored.timestamp) < this.config.nullifierTTL;
    }
    
    /**
     * Generate unlinkable commitment with session-specific randomness
     */
    generateUnlinkableCommitment(data, sessionNonce, globalSalt = null) {
        // Use fresh entropy for each commitment to prevent linkability
        const sessionEntropy = crypto.randomBytes(32);
        
        let inputs = [];
        
        // Convert data to field elements
        if (Array.isArray(data)) {
            inputs.push(...data.map(d => this.dataToFieldElement(d)));
        } else {
            inputs.push(this.dataToFieldElement(data));
        }
        
        // Add session-specific randomness
        inputs.push(BigInt('0x' + sessionNonce));
        inputs.push(BigInt('0x' + sessionEntropy.toString('hex')));
        
        // Add global salt if provided (for cross-session unlinkability)
        if (globalSalt) {
            inputs.push(BigInt(globalSalt));
        }
        
        const commitment = poseidon(inputs);
        return '0x' + commitment.toString(16).padStart(64, '0');
    }
    
    /**
     * Create privacy-preserving session identifier
     */
    createPrivateSession(userIdentifier = null, sessionMetadata = {}) {
        const sessionId = 'session_' + crypto.randomBytes(16).toString('hex');
        const sessionNonce = crypto.randomBytes(32).toString('hex');
        const createdAt = Date.now();
        
        // Hash user identifier to prevent direct correlation
        let userHash = null;
        if (userIdentifier) {
            userHash = crypto.createHash('sha256')
                .update(userIdentifier + sessionNonce)
                .digest('hex');
        }
        
        const sessionData = {
            sessionId,
            sessionNonce,
            userHash,
            metadata: this.sanitizeMetadata(sessionMetadata),
            createdAt,
            expiresAt: createdAt + this.config.sessionTTL
        };
        
        this.sessionStore.set(sessionId, sessionData);
        return sessionData;
    }
    
    /**
     * Validate and extend session if valid
     */
    validateSession(sessionId) {
        const session = this.sessionStore.get(sessionId);
        if (!session) {
            return { valid: false, reason: 'Session not found' };
        }
        
        const now = Date.now();
        if (now > session.expiresAt) {
            this.sessionStore.delete(sessionId);
            return { valid: false, reason: 'Session expired' };
        }
        
        // Extend session if within renewal window
        const renewalWindow = this.config.sessionTTL * 0.75; // Renew in last 25%
        if (now > (session.createdAt + renewalWindow)) {
            session.expiresAt = now + this.config.sessionTTL;
            this.sessionStore.set(sessionId, session);
        }
        
        return { valid: true, session };
    }
    
    /**
     * Implement k-anonymity for module verification patterns
     */
    anonymizeVerificationPattern(moduleIds, k = 5) {
        // Group similar verification patterns to ensure k-anonymity
        const patternKey = moduleIds.sort().join('|');
        
        if (!this.commitmentStore.has('patterns')) {
            this.commitmentStore.set('patterns', new Map());
        }
        
        const patterns = this.commitmentStore.get('patterns');
        
        if (!patterns.has(patternKey)) {
            patterns.set(patternKey, {
                count: 0,
                anonymizedId: crypto.randomBytes(8).toString('hex'),
                firstSeen: Date.now()
            });
        }
        
        const pattern = patterns.get(patternKey);
        pattern.count++;
        
        // Return anonymized identifier only if k-anonymity is achieved
        if (pattern.count >= k) {
            return {
                anonymous: true,
                patternId: pattern.anonymizedId,
                count: pattern.count
            };
        }
        
        return {
            anonymous: false,
            reason: `Insufficient anonymity set (${pattern.count}/${k})`,
            patternId: null
        };
    }
    
    /**
     * Generate differential privacy noise for numeric scores
     */
    addDifferentialPrivacyNoise(score, epsilon = 0.1) {
        // Laplace mechanism for differential privacy
        const sensitivity = 1.0; // Assuming score is normalized 0-1
        const scale = sensitivity / epsilon;
        
        // Generate Laplace noise
        const u = crypto.randomBytes(8).readDoubleBE(0) / 0xffffffffffffffff - 0.5;
        const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
        
        // Add noise and clamp to valid range
        const noisyScore = Math.max(0, Math.min(1, score + noise));
        
        return {
            originalScore: score,
            noisyScore: noisyScore,
            epsilon: epsilon,
            noiseAdded: noise
        };
    }
    
    /**
     * Implement secure multi-party computation for threshold computation
     */
    secureThresholdComputation(moduleScores, threshold, participants = 3) {
        // Simplified secret sharing for threshold computation
        // In production, use proper MPC protocols
        
        const shares = [];
        const modulo = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617'); // BN254 field modulo
        
        // Create secret shares for each score
        for (const score of moduleScores) {
            const secret = BigInt(Math.floor(score * 1000000)); // Scale for precision
            const secretShares = this.createSecretShares(secret, participants, modulo);
            shares.push(secretShares);
        }
        
        // Compute threshold check in shared form (simplified)
        const thresholdShares = this.createSecretShares(
            BigInt(Math.floor(threshold * 1000000)), 
            participants, 
            modulo
        );
        
        return {
            shares: shares,
            thresholdShares: thresholdShares,
            participants: participants,
            reconstruction: () => this.reconstructThresholdResult(shares, thresholdShares, modulo)
        };
    }
    
    /**
     * Zero-knowledge range proof for scores (simplified)
     */
    generateRangeProof(value, minRange, maxRange) {
        // Simplified range proof - in production use bulletproofs or similar
        const commitment = this.generateCommitmentWithBlinding(value);
        
        // Generate proof that value is in [minRange, maxRange]
        const proofData = {
            commitment: commitment.commitment,
            minRange,
            maxRange,
            timestamp: Date.now()
        };
        
        // Create proof hash (simplified)
        const proofHash = crypto.createHash('sha256')
            .update(JSON.stringify(proofData))
            .digest('hex');
        
        return {
            proof: '0x' + proofHash,
            commitment: commitment.commitment,
            blinding: commitment.blinding,
            range: [minRange, maxRange],
            valid: value >= minRange && value <= maxRange
        };
    }
    
    // Helper methods
    
    storeNullifier(nullifier, sessionId, timestamp) {
        this.nullifierStore.set(nullifier, {
            sessionId,
            timestamp: Date.now(),
            usedAt: timestamp
        });
    }
    
    hashUserContext(userContext) {
        const contextString = JSON.stringify(userContext, Object.keys(userContext).sort());
        return crypto.createHash('sha256').update(contextString).digest('hex');
    }
    
    stringToFieldElement(str) {
        const hash = crypto.createHash('sha256').update(str).digest('hex');
        return '0x' + hash.slice(0, 62); // Truncate to fit BN254 field
    }
    
    dataToFieldElement(data) {
        if (typeof data === 'bigint') return data;
        if (typeof data === 'number') return BigInt(data);
        if (typeof data === 'string') return BigInt(this.stringToFieldElement(data));
        
        // For objects, hash them first
        const serialized = JSON.stringify(data, Object.keys(data).sort());
        return BigInt(this.stringToFieldElement(serialized));
    }
    
    sanitizeMetadata(metadata) {
        // Remove sensitive fields from session metadata
        const sanitized = { ...metadata };
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'private'];
        
        for (const field of sensitiveFields) {
            if (field in sanitized) {
                delete sanitized[field];
            }
        }
        
        return sanitized;
    }
    
    generateCommitmentWithBlinding(value) {
        const blinding = crypto.randomBytes(32);
        const blindingBigInt = BigInt('0x' + blinding.toString('hex'));
        
        const commitment = poseidon([BigInt(value), blindingBigInt]);
        
        return {
            commitment: '0x' + commitment.toString(16).padStart(64, '0'),
            blinding: '0x' + blinding.toString('hex')
        };
    }
    
    createSecretShares(secret, n, modulo) {
        // Simplified Shamir's secret sharing
        const shares = [];
        const coefficients = [secret];
        
        // Generate random coefficients for polynomial
        for (let i = 1; i < n; i++) {
            coefficients.push(BigInt(crypto.randomBytes(32).toString('hex')));
        }
        
        // Generate shares
        for (let x = 1; x <= n; x++) {
            let y = coefficients[0];
            let xPow = BigInt(x);
            
            for (let i = 1; i < n; i++) {
                y = (y + (coefficients[i] * xPow)) % modulo;
                xPow = (xPow * BigInt(x)) % modulo;
            }
            
            shares.push({ x: x, y: y });
        }
        
        return shares;
    }
    
    reconstructThresholdResult(scoreShares, thresholdShares, modulo) {
        // Simplified reconstruction - compare aggregated scores with threshold
        // In practice, this would be done via secure MPC
        
        let totalScore = BigInt(0);
        let threshold = BigInt(0);
        
        // Reconstruct secrets (simplified - using all shares)
        for (let i = 0; i < scoreShares.length; i++) {
            totalScore = (totalScore + scoreShares[i][0].y) % modulo;
        }
        
        threshold = thresholdShares[0].y; // Simplified
        
        return {
            thresholdMet: totalScore >= threshold,
            encryptedResult: crypto.randomBytes(32).toString('hex') // Placeholder
        };
    }
    
    startCleanupTimer() {
        // Clean up expired entries every 5 minutes
        setInterval(() => {
            this.cleanupExpiredEntries();
        }, 300000);
    }
    
    cleanupExpiredEntries() {
        const now = Date.now();
        
        // Clean up nullifiers
        for (const [nullifier, data] of this.nullifierStore.entries()) {
            if (now - data.timestamp > this.config.nullifierTTL) {
                this.nullifierStore.delete(nullifier);
            }
        }
        
        // Clean up sessions
        for (const [sessionId, session] of this.sessionStore.entries()) {
            if (now > session.expiresAt) {
                this.sessionStore.delete(sessionId);
            }
        }
        
        // Clean up commitment cache
        for (const [key, data] of this.commitmentStore.entries()) {
            if (data.timestamp && (now - data.timestamp > this.config.commitmentCacheTTL)) {
                this.commitmentStore.delete(key);
            }
        }
    }
    
    /**
     * Secure deletion of sensitive data from memory
     */
    secureDelete(obj) {
        if (typeof obj === 'object' && obj !== null) {
            if (Array.isArray(obj)) {
                // Overwrite array contents
                for (let i = 0; i < obj.length; i++) {
                    if (typeof obj[i] === 'object') {
                        this.secureDelete(obj[i]);
                    }
                    obj[i] = crypto.randomBytes(32).toString('hex');
                }
                obj.length = 0;
            } else {
                // Overwrite object properties
                for (const key in obj) {
                    if (obj.hasOwnProperty(key)) {
                        if (typeof obj[key] === 'object') {
                            this.secureDelete(obj[key]);
                        } else if (typeof obj[key] === 'string') {
                            obj[key] = crypto.randomBytes(obj[key].length).toString('hex');
                        }
                        delete obj[key];
                    }
                }
            }
        }
    }
    
    /**
     * Get privacy statistics for monitoring
     */
    getPrivacyStats() {
        return {
            activeNullifiers: this.nullifierStore.size,
            activeSessions: this.sessionStore.size,
            cachedCommitments: this.commitmentStore.size,
            timestamp: Date.now()
        };
    }
}