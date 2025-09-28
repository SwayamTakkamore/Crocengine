import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ValidationService {
    constructor() {
        this.ajv = new Ajv({ allErrors: true });
        addFormats(this.ajv);
        
        // Load JSON schemas
        this.schemas = this.loadSchemas();
        
        // Compile validators
        this.validators = {
            moduleOutput: this.ajv.compile(this.schemas.moduleOutput),
            masterProveRequest: this.ajv.compile(this.schemas.masterProveRequest),
            masterProveResponse: this.ajv.compile(this.schemas.masterProveResponse)
        };
    }
    
    loadSchemas() {
        const schemasDir = path.join(__dirname, '..', 'schemas');
        
        try {
            const moduleOutput = JSON.parse(
                readFileSync(path.join(schemasDir, 'module-output.json'), 'utf8')
            );
            
            const masterProveRequest = JSON.parse(
                readFileSync(path.join(schemasDir, 'master-prove-request.json'), 'utf8')
            );
            
            const masterProveResponse = JSON.parse(
                readFileSync(path.join(schemasDir, 'master-prove-response.json'), 'utf8')
            );
            
            return {
                moduleOutput,
                masterProveRequest,
                masterProveResponse
            };
            
        } catch (error) {
            throw new Error(`Failed to load validation schemas: ${error.message}`);
        }
    }
    
    validateMasterProveRequest(request) {
        const isValid = this.validators.masterProveRequest(request);
        
        if (!isValid) {
            return {
                valid: false,
                errors: this.validators.masterProveRequest.errors.map(err => ({
                    path: err.instancePath,
                    message: err.message,
                    value: err.data
                }))
            };
        }
        
        // Additional business logic validation
        const businessValidation = this.validateBusinessRules(request);
        if (!businessValidation.valid) {
            return businessValidation;
        }
        
        return { valid: true };
    }
    
    validateModuleOutput(moduleOutput) {
        const isValid = this.validators.moduleOutput(moduleOutput);
        
        if (!isValid) {
            return {
                valid: false,
                errors: this.validators.moduleOutput.errors.map(err => ({
                    path: err.instancePath,
                    message: err.message,
                    value: err.data
                }))
            };
        }
        
        return { valid: true };
    }
    
    validateMasterProveResponse(response) {
        const isValid = this.validators.masterProveResponse(response);
        
        if (!isValid) {
            return {
                valid: false,
                errors: this.validators.masterProveResponse.errors.map(err => ({
                    path: err.instancePath,
                    message: err.message,
                    value: err.data
                }))
            };
        }
        
        return { valid: true };
    }
    
    validateBusinessRules(request) {
        const errors = [];
        const { modules, policy, session_id } = request;
        
        // 1. Session ID format validation
        if (!this.isValidSessionId(session_id)) {
            errors.push({
                path: '/session_id',
                message: 'Invalid session ID format',
                value: session_id
            });
        }
        
        // 2. Module validation
        for (let i = 0; i < modules.length; i++) {
            const module = modules[i];
            const moduleValidation = this.validateModuleOutput(module);
            
            if (!moduleValidation.valid) {
                errors.push({
                    path: `/modules/${i}`,
                    message: 'Invalid module output format',
                    details: moduleValidation.errors
                });
            }
            
            // Timestamp freshness check (within last hour)
            const hourAgo = Math.floor(Date.now() / 1000) - 3600;
            if (module.timestamp < hourAgo) {
                errors.push({
                    path: `/modules/${i}/timestamp`,
                    message: 'Module output too old (>1 hour)',
                    value: module.timestamp
                });
            }
        }
        
        // 3. Policy validation
        if (!this.validatePolicyConsistency(modules, policy)) {
            errors.push({
                path: '/policy',
                message: 'Policy requirements not satisfied by provided modules',
                details: 'Required modules not present in modules array'
            });
        }
        
        // 4. Module uniqueness
        const moduleIds = modules.map(m => m.module_id);
        const uniqueIds = new Set(moduleIds);
        if (moduleIds.length !== uniqueIds.size) {
            errors.push({
                path: '/modules',
                message: 'Duplicate module IDs not allowed',
                value: moduleIds
            });
        }
        
        // 5. Commitment format validation
        for (let i = 0; i < modules.length; i++) {
            if (!this.isValidCommitment(modules[i].commitment)) {
                errors.push({
                    path: `/modules/${i}/commitment`,
                    message: 'Invalid commitment format',
                    value: modules[i].commitment
                });
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    validatePolicyConsistency(modules, policy) {
        const availableModules = new Set(modules.map(m => m.module_id));
        
        // Check all required modules are present
        for (const requiredId of policy.required) {
            if (!availableModules.has(requiredId)) {
                return false;
            }
        }
        
        // Check threshold makes sense
        if (policy.threshold && policy.threshold > modules.length) {
            return false;
        }
        
        return true;
    }
    
    isValidSessionId(sessionId) {
        // Session ID should be 8-64 characters, alphanumeric + underscore/dash
        if (!sessionId || typeof sessionId !== 'string') {
            return false;
        }
        
        if (sessionId.length < 8 || sessionId.length > 64) {
            return false;
        }
        
        return /^[a-zA-Z0-9_-]+$/.test(sessionId);
    }
    
    isValidCommitment(commitment) {
        // Commitment should be 66-character hex string (0x + 64 hex chars)
        if (!commitment || typeof commitment !== 'string') {
            return false;
        }
        
        return /^0x[0-9a-fA-F]{64}$/.test(commitment);
    }
    
    isValidSignature(signature) {
        // Signature should be hex string of appropriate length
        if (!signature || typeof signature !== 'string') {
            return false;
        }
        
        return /^0x[0-9a-fA-F]{128,140}$/.test(signature);
    }
    
    validateProofFormat(proof) {
        if (!proof || typeof proof !== 'object') {
            return { valid: false, error: 'Proof must be an object' };
        }
        
        const { pi_a, pi_b, pi_c, protocol, curve } = proof;
        
        // Check required fields
        if (!pi_a || !pi_b || !pi_c || !protocol || !curve) {
            return { 
                valid: false, 
                error: 'Proof missing required fields (pi_a, pi_b, pi_c, protocol, curve)' 
            };
        }
        
        // Check protocol and curve
        if (!['groth16', 'plonk'].includes(protocol)) {
            return { valid: false, error: 'Invalid protocol, must be groth16 or plonk' };
        }
        
        if (!['bn128', 'bls12_381'].includes(curve)) {
            return { valid: false, error: 'Invalid curve, must be bn128 or bls12_381' };
        }
        
        // Check proof element formats (simplified)
        if (!Array.isArray(pi_a) || pi_a.length !== 3) {
            return { valid: false, error: 'Invalid pi_a format' };
        }
        
        if (!Array.isArray(pi_b) || pi_b.length !== 3) {
            return { valid: false, error: 'Invalid pi_b format' };
        }
        
        if (!Array.isArray(pi_c) || pi_c.length !== 3) {
            return { valid: false, error: 'Invalid pi_c format' };
        }
        
        return { valid: true };
    }
    
    // Security-focused validation methods
    validateInputSize(data) {
        const maxSize = 1024 * 1024; // 1MB limit
        const size = JSON.stringify(data).length;
        
        if (size > maxSize) {
            return {
                valid: false,
                error: `Input too large: ${size} bytes (max: ${maxSize})`
            };
        }
        
        return { valid: true };
    }
    
    sanitizeInput(input) {
        if (typeof input === 'string') {
            // Remove null bytes and control characters
            return input.replace(/[\x00-\x1F\x7F]/g, '');
        }
        
        if (Array.isArray(input)) {
            return input.map(item => this.sanitizeInput(item));
        }
        
        if (typeof input === 'object' && input !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(input)) {
                sanitized[this.sanitizeInput(key)] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        
        return input;
    }
}