import { describe, it, before, beforeEach } from 'mocha';
import { expect } from 'chai';
import { ZKPService } from '../../src/zkp-service.js';

describe('ZKP Service Unit Tests', function() {
    this.timeout(30000); // Allow more time for cryptographic operations
    
    let zkpService;
    
    before(async function() {
        zkpService = new ZKPService();
        await zkpService.initialize();
    });
    
    describe('Commitment Generation', function() {
        it('should generate consistent commitments for same inputs', function() {
            const data = ['12345', '67890'];
            const nonce = '0x1234567890abcdef';
            
            const commitment1 = zkpService.generateCommitment(data, nonce);
            const commitment2 = zkpService.generateCommitment(data, nonce);
            
            expect(commitment1).to.equal(commitment2);
            expect(commitment1).to.match(/^0x[0-9a-f]{64}$/);
        });
        
        it('should generate different commitments for different nonces', function() {
            const data = ['12345', '67890'];
            const nonce1 = '0x1111111111111111';
            const nonce2 = '0x2222222222222222';
            
            const commitment1 = zkpService.generateCommitment(data, nonce1);
            const commitment2 = zkpService.generateCommitment(data, nonce2);
            
            expect(commitment1).to.not.equal(commitment2);
        });
        
        it('should handle string data inputs', function() {
            const data = 'test@example.com';
            const nonce = '0x1234567890abcdef';
            
            const commitment = zkpService.generateCommitment(data, nonce);
            
            expect(commitment).to.match(/^0x[0-9a-f]{64}$/);
        });
    });
    
    describe('Commitment Root Calculation', function() {
        it('should calculate Merkle root for multiple commitments', function() {
            const commitments = [
                '0x1111111111111111111111111111111111111111111111111111111111111111',
                '0x2222222222222222222222222222222222222222222222222222222222222222',
                '0x3333333333333333333333333333333333333333333333333333333333333333'
            ];
            
            const root = zkpService.calculateCommitmentRoot(commitments);
            
            expect(root).to.match(/^0x[0-9a-f]{64}$/);
        });
        
        it('should produce different roots for different commitment sets', function() {
            const commitments1 = [
                '0x1111111111111111111111111111111111111111111111111111111111111111',
                '0x2222222222222222222222222222222222222222222222222222222222222222'
            ];
            
            const commitments2 = [
                '0x3333333333333333333333333333333333333333333333333333333333333333',
                '0x4444444444444444444444444444444444444444444444444444444444444444'
            ];
            
            const root1 = zkpService.calculateCommitmentRoot(commitments1);
            const root2 = zkpService.calculateCommitmentRoot(commitments2);
            
            expect(root1).to.not.equal(root2);
        });
    });
    
    describe('Nullifier Generation', function() {
        it('should generate unique nullifiers for different sessions', function() {
            const commitmentRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            const sessionId1 = 'session_123';
            const sessionId2 = 'session_456';
            const timestamp = Math.floor(Date.now() / 1000);
            
            const nullifier1 = zkpService.generateNullifier(commitmentRoot, sessionId1, timestamp);
            const nullifier2 = zkpService.generateNullifier(commitmentRoot, sessionId2, timestamp);
            
            expect(nullifier1).to.not.equal(nullifier2);
            expect(nullifier1).to.match(/^0x[0-9a-f]{64}$/);
            expect(nullifier2).to.match(/^0x[0-9a-f]{64}$/);
        });
        
        it('should be deterministic for same inputs', function() {
            const commitmentRoot = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
            const sessionId = 'session_123';
            const timestamp = 1640995200; // Fixed timestamp
            
            const nullifier1 = zkpService.generateNullifier(commitmentRoot, sessionId, timestamp);
            const nullifier2 = zkpService.generateNullifier(commitmentRoot, sessionId, timestamp);
            
            expect(nullifier1).to.equal(nullifier2);
        });
    });
    
    describe('Policy Hash Generation', function() {
        it('should generate consistent hash for same policy', function() {
            const policy = {
                required: ['pan_v1', 'email_v1'],
                threshold: 2,
                optional: []
            };
            
            const hash1 = zkpService.generatePolicyHash(policy);
            const hash2 = zkpService.generatePolicyHash(policy);
            
            expect(hash1).to.equal(hash2);
        });
        
        it('should generate different hashes for different policies', function() {
            const policy1 = {
                required: ['pan_v1', 'email_v1'],
                threshold: 2
            };
            
            const policy2 = {
                required: ['pan_v1', 'passport_v1'],
                threshold: 2
            };
            
            const hash1 = zkpService.generatePolicyHash(policy1);
            const hash2 = zkpService.generatePolicyHash(policy2);
            
            expect(hash1).to.not.equal(hash2);
        });
    });
    
    describe('Policy Validation', function() {
        it('should validate policy with all required modules passing', function() {
            const modules = [
                { module_id: 'pan_v1', verification_flag: 1 },
                { module_id: 'email_v1', verification_flag: 1 }
            ];
            
            const policy = {
                required: ['pan_v1', 'email_v1'],
                threshold: 2
            };
            
            const isValid = zkpService.validatePolicy(modules, policy);
            expect(isValid).to.be.true;
        });
        
        it('should reject policy when required module fails', function() {
            const modules = [
                { module_id: 'pan_v1', verification_flag: 1 },
                { module_id: 'email_v1', verification_flag: 0 }  // Failed
            ];
            
            const policy = {
                required: ['pan_v1', 'email_v1'],
                threshold: 2
            };
            
            const isValid = zkpService.validatePolicy(modules, policy);
            expect(isValid).to.be.false;
        });
        
        it('should validate policy with threshold requirement', function() {
            const modules = [
                { module_id: 'pan_v1', verification_flag: 1 },
                { module_id: 'email_v1', verification_flag: 1 },
                { module_id: 'passport_v1', verification_flag: 0 }
            ];
            
            const policy = {
                required: ['pan_v1'],
                threshold: 2
            };
            
            const isValid = zkpService.validatePolicy(modules, policy);
            expect(isValid).to.be.true;  // pan_v1 + email_v1 = 2 passing, meets threshold
        });
    });
    
    describe('Circuit Input Preparation', function() {
        it('should prepare valid inputs for master circuit', function() {
            const modules = [
                {
                    module_id: 'pan_v1',
                    verification_flag: 1,
                    commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                    signature: '0x2222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222'
                },
                {
                    module_id: 'email_v1',
                    verification_flag: 1,
                    commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
                    signature: '0x4444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444444'
                }
            ];
            
            const policy = {
                required: ['pan_v1', 'email_v1'],
                threshold: 2
            };
            
            const sessionId = 'test_session_123';
            const timestamp = Math.floor(Date.now() / 1000);
            
            const inputs = zkpService.prepareMasterCircuitInputs(modules, policy, sessionId, timestamp);
            
            expect(inputs).to.have.property('module_commitments');
            expect(inputs).to.have.property('module_flags');
            expect(inputs).to.have.property('required_modules');
            expect(inputs).to.have.property('min_threshold');
            expect(inputs).to.have.property('session_nonce');
            expect(inputs).to.have.property('timestamp');
            
            // Check array lengths match circuit expectations
            expect(inputs.module_commitments).to.have.length(8);
            expect(inputs.module_flags).to.have.length(8);
            expect(inputs.required_modules).to.have.length(8);
        });
    });
    
    describe('Utility Functions', function() {
        it('should convert strings to field elements consistently', function() {
            const str1 = 'test_string';
            const str2 = 'test_string';
            const str3 = 'different_string';
            
            const field1 = zkpService.stringToFieldElement(str1);
            const field2 = zkpService.stringToFieldElement(str2);
            const field3 = zkpService.stringToFieldElement(str3);
            
            expect(field1).to.equal(field2);
            expect(field1).to.not.equal(field3);
            expect(typeof field1).to.equal('bigint');
        });
        
        it('should generate random master secrets', function() {
            const secret1 = zkpService.generateMasterSecret();
            const secret2 = zkpService.generateMasterSecret();
            
            expect(secret1).to.not.equal(secret2);
            expect(typeof secret1).to.equal('bigint');
        });
    });
});