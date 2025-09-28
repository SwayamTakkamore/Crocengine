import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { ValidationService } from '../../src/validation-service.js';

describe('Validation Service Unit Tests', function() {
    let validationService;
    
    beforeEach(function() {
        validationService = new ValidationService();
    });
    
    describe('Module Output Validation', function() {
        it('should validate correct module output', function() {
            const validModule = {
                module_id: 'pan_v1',
                verification_flag: 1,
                commitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                signature: '0x' + 'a'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            };
            
            const result = validationService.validateModuleOutput(validModule);
            expect(result.valid).to.be.true;
        });
        
        it('should reject module with invalid module_id format', function() {
            const invalidModule = {
                module_id: 'invalid-format',  // Should be 'module_v1' format
                verification_flag: 1,
                commitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                signature: '0x' + 'a'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            };
            
            const result = validationService.validateModuleOutput(invalidModule);
            expect(result.valid).to.be.false;
            expect(result.errors).to.have.length.greaterThan(0);
        });
        
        it('should reject module with invalid verification_flag', function() {
            const invalidModule = {
                module_id: 'pan_v1',
                verification_flag: 2,  // Should be 0 or 1
                commitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                signature: '0x' + 'a'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            };
            
            const result = validationService.validateModuleOutput(invalidModule);
            expect(result.valid).to.be.false;
        });
        
        it('should reject module with invalid commitment format', function() {
            const invalidModule = {
                module_id: 'pan_v1',
                verification_flag: 1,
                commitment: '0x123',  // Too short
                signature: '0x' + 'a'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            };
            
            const result = validationService.validateModuleOutput(invalidModule);
            expect(result.valid).to.be.false;
        });
    });
    
    describe('Master Prove Request Validation', function() {
        const validModules = [
            {
                module_id: 'pan_v1',
                verification_flag: 1,
                commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                signature: '0x' + 'a'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            },
            {
                module_id: 'email_v1',
                verification_flag: 1,
                commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
                signature: '0x' + 'b'.repeat(130),
                timestamp: Math.floor(Date.now() / 1000)
            }
        ];
        
        it('should validate correct master prove request', function() {
            const validRequest = {
                session_id: 'test_session_123',
                modules: validModules,
                policy: {
                    required: ['pan_v1', 'email_v1'],
                    threshold: 2
                }
            };
            
            const result = validationService.validateMasterProveRequest(validRequest);
            expect(result.valid).to.be.true;
        });
        
        it('should reject request with missing session_id', function() {
            const invalidRequest = {
                modules: validModules,
                policy: {
                    required: ['pan_v1', 'email_v1']
                }
            };
            
            const result = validationService.validateMasterProveRequest(invalidRequest);
            expect(result.valid).to.be.false;
            expect(result.errors.some(e => e.path.includes('session_id'))).to.be.true;
        });
        
        it('should reject request with empty modules array', function() {
            const invalidRequest = {
                session_id: 'test_session_123',
                modules: [],  // Empty array
                policy: {
                    required: ['pan_v1']
                }
            };
            
            const result = validationService.validateMasterProveRequest(invalidRequest);
            expect(result.valid).to.be.false;
        });
        
        it('should reject request with policy-module mismatch', function() {
            const invalidRequest = {
                session_id: 'test_session_123',
                modules: validModules,
                policy: {
                    required: ['passport_v1']  // Not present in modules
                }
            };
            
            const result = validationService.validateMasterProveRequest(invalidRequest);
            expect(result.valid).to.be.false;
        });
    });
    
    describe('Business Rules Validation', function() {
        it('should reject old module timestamps', function() {
            const oldTimestamp = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
            
            const requestWithOldModule = {
                session_id: 'test_session_123',
                modules: [{
                    module_id: 'pan_v1',
                    verification_flag: 1,
                    commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                    signature: '0x' + 'a'.repeat(130),
                    timestamp: oldTimestamp
                }],
                policy: {
                    required: ['pan_v1']
                }
            };
            
            const result = validationService.validateMasterProveRequest(requestWithOldModule);
            expect(result.valid).to.be.false;
            expect(result.errors.some(e => e.message.includes('too old'))).to.be.true;
        });
        
        it('should reject duplicate module IDs', function() {
            const duplicateModules = [
                {
                    module_id: 'pan_v1',
                    verification_flag: 1,
                    commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                    signature: '0x' + 'a'.repeat(130),
                    timestamp: Math.floor(Date.now() / 1000)
                },
                {
                    module_id: 'pan_v1',  // Duplicate
                    verification_flag: 1,
                    commitment: '0x2222222222222222222222222222222222222222222222222222222222222222',
                    signature: '0x' + 'b'.repeat(130),
                    timestamp: Math.floor(Date.now() / 1000)
                }
            ];
            
            const request = {
                session_id: 'test_session_123',
                modules: duplicateModules,
                policy: {
                    required: ['pan_v1']
                }
            };
            
            const result = validationService.validateMasterProveRequest(request);
            expect(result.valid).to.be.false;
            expect(result.errors.some(e => e.message.includes('Duplicate'))).to.be.true;
        });
    });
    
    describe('Session ID Validation', function() {
        it('should validate correct session ID formats', function() {
            const validSessionIds = [
                'session_123',
                'test-session-456',
                'SESSION_ABC123',
                'a'.repeat(32),  // 32 chars
                'b'.repeat(64)   // 64 chars (max)
            ];
            
            validSessionIds.forEach(sessionId => {
                expect(validationService.isValidSessionId(sessionId)).to.be.true;
            });
        });
        
        it('should reject invalid session ID formats', function() {
            const invalidSessionIds = [
                '',                    // Empty
                '1234567',            // Too short
                'a'.repeat(65),       // Too long
                'session@123',        // Invalid character
                'session 123',        // Space not allowed
                null,                 // Null
                undefined,            // Undefined
                123                   // Not a string
            ];
            
            invalidSessionIds.forEach(sessionId => {
                expect(validationService.isValidSessionId(sessionId)).to.be.false;
            });
        });
    });
    
    describe('Commitment Validation', function() {
        it('should validate correct commitment formats', function() {
            const validCommitments = [
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
                '0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890',
                '0x0000000000000000000000000000000000000000000000000000000000000000'
            ];
            
            validCommitments.forEach(commitment => {
                expect(validationService.isValidCommitment(commitment)).to.be.true;
            });
        });
        
        it('should reject invalid commitment formats', function() {
            const invalidCommitments = [
                '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',  // No 0x prefix
                '0x123',                                                                  // Too short
                '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefg', // Invalid character
                '0x',                                                                    // Only prefix
                '',                                                                      // Empty
                null,                                                                    // Null
                undefined                                                                // Undefined
            ];
            
            invalidCommitments.forEach(commitment => {
                expect(validationService.isValidCommitment(commitment)).to.be.false;
            });
        });
    });
    
    describe('Proof Format Validation', function() {
        it('should validate correct Groth16 proof format', function() {
            const validProof = {
                pi_a: ['1', '2', '3'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '9'],
                protocol: 'groth16',
                curve: 'bn128'
            };
            
            const result = validationService.validateProofFormat(validProof);
            expect(result.valid).to.be.true;
        });
        
        it('should reject proof with invalid protocol', function() {
            const invalidProof = {
                pi_a: ['1', '2', '3'],
                pi_b: [['1', '2'], ['3', '4'], ['5', '6']],
                pi_c: ['7', '8', '9'],
                protocol: 'invalid_protocol',
                curve: 'bn128'
            };
            
            const result = validationService.validateProofFormat(invalidProof);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('Invalid protocol');
        });
        
        it('should reject proof with missing fields', function() {
            const invalidProof = {
                pi_a: ['1', '2', '3'],
                // Missing pi_b
                pi_c: ['7', '8', '9'],
                protocol: 'groth16',
                curve: 'bn128'
            };
            
            const result = validationService.validateProofFormat(invalidProof);
            expect(result.valid).to.be.false;
            expect(result.error).to.include('missing required fields');
        });
    });
    
    describe('Input Sanitization', function() {
        it('should remove control characters from strings', function() {
            const input = 'test\x00\x01string\x1F';
            const sanitized = validationService.sanitizeInput(input);
            expect(sanitized).to.equal('teststring');
        });
        
        it('should sanitize nested objects', function() {
            const input = {
                safe: 'normal_string',
                unsafe: 'string\x00with\x01control\x1F',
                nested: {
                    field: 'another\x00unsafe\x01string'
                }
            };
            
            const sanitized = validationService.sanitizeInput(input);
            expect(sanitized.safe).to.equal('normal_string');
            expect(sanitized.unsafe).to.equal('stringwithcontrol');
            expect(sanitized.nested.field).to.equal('anotherunsafestring');
        });
        
        it('should handle arrays', function() {
            const input = ['normal', 'with\x00control', 'chars\x01here'];
            const sanitized = validationService.sanitizeInput(input);
            
            expect(sanitized).to.deep.equal(['normal', 'withcontrol', 'charshere']);
        });
    });
});