import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import supertest from 'supertest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ZKP Master API Integration Tests', function() {
    this.timeout(60000); // Extended timeout for proof generation
    
    let server;
    let request;
    const serverPort = 3002; // Different port for testing
    
    before(async function() {
        // Start the server for integration testing
        const serverPath = path.join(__dirname, '../../src/server.js');
        
        server = spawn('node', [serverPath], {
            env: { ...process.env, PORT: serverPort, NODE_ENV: 'test' },
            stdio: 'pipe'
        });
        
        // Wait for server to start
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Server startup timeout'));
            }, 10000);
            
            server.stdout.on('data', (data) => {
                if (data.toString().includes('listening')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
            
            server.stderr.on('data', (data) => {
                console.error('Server error:', data.toString());
            });
        });
        
        request = supertest(`http://localhost:${serverPort}`);
    });
    
    after(function() {
        if (server) {
            server.kill();
        }
    });
    
    describe('Health Check', function() {
        it('should return healthy status', async function() {
            const response = await request
                .get('/health')
                .expect(200);
            
            expect(response.body).to.have.property('status', 'healthy');
            expect(response.body).to.have.property('service', 'zkp-master');
        });
    });
    
    describe('Circuit Information', function() {
        it('should return available circuits', async function() {
            const response = await request
                .get('/api/v1/circuits')
                .expect(200);
            
            expect(response.body).to.have.property('circuits');
            expect(response.body.circuits).to.be.an('array');
            
            const circuitIds = response.body.circuits.map(c => c.id);
            expect(circuitIds).to.include('pan_verification');
            expect(circuitIds).to.include('email_verification');
            expect(circuitIds).to.include('master_aggregation');
        });
    });
    
    describe('Commitment Generation', function() {
        it('should generate commitment for valid inputs', async function() {
            const requestBody = {
                data: ['test', 'data'],
                nonce: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            };
            
            const response = await request
                .post('/api/v1/zk/commitment')
                .send(requestBody)
                .expect(200);
            
            expect(response.body).to.have.property('commitment');
            expect(response.body.commitment).to.match(/^0x[0-9a-f]{64}$/);
        });
        
        it('should reject commitment request with missing data', async function() {
            const requestBody = {
                nonce: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
                // Missing data
            };
            
            await request
                .post('/api/v1/zk/commitment')
                .send(requestBody)
                .expect(400);
        });
    });
    
    describe('Master Proof Generation', function() {
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
        
        it('should generate master proof for valid request', async function() {
            this.timeout(120000); // Allow extra time for proof generation
            
            const requestBody = {
                session_id: 'integration_test_session_123',
                modules: validModules,
                policy: {
                    required: ['pan_v1', 'email_v1'],
                    threshold: 2
                },
                options: {
                    anchor_on_chain: false,
                    expiry_minutes: 60
                }
            };
            
            const response = await request
                .post('/api/v1/zk/master_prove')
                .set('X-Session-ID', 'integration_test_session_123')
                .send(requestBody)
                .expect(200);
            
            // Validate response structure
            expect(response.body).to.have.property('masterProof');
            expect(response.body).to.have.property('publicSignals');
            expect(response.body).to.have.property('commitment');
            expect(response.body).to.have.property('nullifier');
            expect(response.body).to.have.property('session_id', 'integration_test_session_123');
            expect(response.body).to.have.property('verification');
            
            // Validate proof format
            const proof = response.body.masterProof;
            expect(proof).to.have.property('pi_a');
            expect(proof).to.have.property('pi_b');
            expect(proof).to.have.property('pi_c');
            expect(proof).to.have.property('protocol', 'groth16');
            expect(proof).to.have.property('curve', 'bn128');
            
            // Validate commitment format
            expect(response.body.commitment).to.match(/^0x[0-9a-f]{64}$/);
            expect(response.body.nullifier).to.match(/^0x[0-9a-f]{64}$/);
        });
        
        it('should reject invalid module signatures', async function() {
            const invalidModules = [
                {
                    module_id: 'pan_v1',
                    verification_flag: 1,
                    commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                    signature: 'invalid_signature',  // Invalid format
                    timestamp: Math.floor(Date.now() / 1000)
                }
            ];
            
            const requestBody = {
                session_id: 'test_session_456',
                modules: invalidModules,
                policy: {
                    required: ['pan_v1']
                }
            };
            
            await request
                .post('/api/v1/zk/master_prove')
                .set('X-Session-ID', 'test_session_456')
                .send(requestBody)
                .expect(400);
        });
        
        it('should reject request with failed policy validation', async function() {
            const failedModules = [
                {
                    module_id: 'pan_v1',
                    verification_flag: 0,  // Failed verification
                    commitment: '0x1111111111111111111111111111111111111111111111111111111111111111',
                    signature: '0x' + 'a'.repeat(130),
                    timestamp: Math.floor(Date.now() / 1000)
                }
            ];
            
            const requestBody = {
                session_id: 'test_session_789',
                modules: failedModules,
                policy: {
                    required: ['pan_v1']  // Requires pan_v1 to pass, but it failed
                }
            };
            
            // This should still generate a proof, but verification_result should be 0
            const response = await request
                .post('/api/v1/zk/master_prove')
                .set('X-Session-ID', 'test_session_789')
                .send(requestBody)
                .expect(200);
            
            expect(response.body.verification.policysSatisfied).to.be.false;
        });
    });
    
    describe('Proof Verification', function() {
        let generatedProof;
        
        before(async function() {
            // Generate a proof first
            const requestBody = {
                session_id: 'verification_test_session',
                modules: [
                    {
                        module_id: 'pan_v1',
                        verification_flag: 1,
                        commitment: '0x3333333333333333333333333333333333333333333333333333333333333333',
                        signature: '0x' + 'c'.repeat(130),
                        timestamp: Math.floor(Date.now() / 1000)
                    }
                ],
                policy: {
                    required: ['pan_v1']
                }
            };
            
            const response = await request
                .post('/api/v1/zk/master_prove')
                .set('X-Session-ID', 'verification_test_session')
                .send(requestBody)
                .expect(200);
            
            generatedProof = response.body;
        });
        
        it('should verify valid proof', async function() {
            const verifyRequest = {
                proof: generatedProof.masterProof,
                publicSignals: generatedProof.publicSignals
            };
            
            const response = await request
                .post('/api/v1/zk/verify')
                .send(verifyRequest)
                .expect(200);
            
            expect(response.body).to.have.property('valid', true);
        });
        
        it('should reject invalid proof', async function() {
            const invalidProof = {
                ...generatedProof.masterProof,
                pi_a: ['0', '1', '2']  // Invalid values
            };
            
            const verifyRequest = {
                proof: invalidProof,
                publicSignals: generatedProof.publicSignals
            };
            
            const response = await request
                .post('/api/v1/zk/verify')
                .send(verifyRequest)
                .expect(200);
            
            expect(response.body).to.have.property('valid', false);
        });
    });
    
    describe('Rate Limiting', function() {
        it('should handle multiple requests within rate limit', async function() {
            const promises = [];
            
            // Send 5 concurrent requests (should be within limit)
            for (let i = 0; i < 5; i++) {
                promises.push(
                    request
                        .get('/health')
                        .expect(200)
                );
            }
            
            await Promise.all(promises);
        });
        
        // Note: Full rate limit testing would require more sophisticated setup
        // with controlled timing and state management
    });
    
    describe('Error Handling', function() {
        it('should handle malformed JSON gracefully', async function() {
            const response = await request
                .post('/api/v1/zk/master_prove')
                .set('Content-Type', 'application/json')
                .send('{"invalid": json}')
                .expect(400);
                
            expect(response.body).to.have.property('error');
        });
        
        it('should return 404 for non-existent endpoints', async function() {
            await request
                .get('/api/v1/nonexistent')
                .expect(404);
        });
        
        it('should handle missing verification key gracefully', async function() {
            const response = await request
                .get('/api/v1/zk/verification-key/nonexistent_circuit')
                .expect(404);
                
            expect(response.body).to.have.property('error', 'Circuit not found');
        });
    });
    
    describe('Security Headers', function() {
        it('should include CORS headers', async function() {
            const response = await request
                .options('/api/v1/zk/master_prove')
                .expect(200);
            
            expect(response.headers).to.have.property('access-control-allow-origin');
            expect(response.headers).to.have.property('access-control-allow-methods');
        });
    });
});