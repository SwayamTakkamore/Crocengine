#!/usr/bin/env node

/**
 * End-to-End ZKP Master Module Example
 * 
 * This example demonstrates the complete workflow of the ZKP Master Module:
 * 1. Simulate verification module outputs
 * 2. Generate master proof
 * 3. Verify the proof locally
 * 4. Display results and performance metrics
 */

import crypto from 'crypto';
import { poseidon } from 'poseidon-lite';

// Simulate verification module outputs
function simulateModuleOutputs() {
    const timestamp = Math.floor(Date.now() / 1000);
    const sessionNonce = crypto.randomBytes(32).toString('hex');
    
    // Simulate PAN verification
    const panCommitment = generateCommitment(['ABCDE1234F', 'JOHN DOE', sessionNonce]);
    const panModule = {
        module_id: 'pan_v1',
        verification_flag: 1,
        commitment: panCommitment,
        signature: generateMockSignature('pan_v1', 1, panCommitment, timestamp),
        timestamp: timestamp,
        metadata: {
            score: 0.95,
            risk_flags: []
        }
    };
    
    // Simulate Email verification  
    const emailCommitment = generateCommitment(['john.doe@example.com', 'gmail.com', sessionNonce]);
    const emailModule = {
        module_id: 'email_v1', 
        verification_flag: 1,
        commitment: emailCommitment,
        signature: generateMockSignature('email_v1', 1, emailCommitment, timestamp + 30),
        timestamp: timestamp + 30,
        metadata: {
            score: 0.92,
            risk_flags: ['new_domain']
        }
    };
    
    // Simulate Passport verification (optional for threshold)
    const passportCommitment = generateCommitment(['P123456789', 'US', sessionNonce]);
    const passportModule = {
        module_id: 'passport_v1',
        verification_flag: 1,
        commitment: passportCommitment, 
        signature: generateMockSignature('passport_v1', 1, passportCommitment, timestamp + 60),
        timestamp: timestamp + 60,
        metadata: {
            score: 0.88,
            risk_flags: ['manual_review']
        }
    };
    
    return {
        modules: [panModule, emailModule, passportModule],
        sessionNonce
    };
}

// Generate Poseidon commitment
function generateCommitment(data) {
    const inputs = data.map(d => {
        if (typeof d === 'string') {
            // Convert string to field elements
            const hash = crypto.createHash('sha256').update(d).digest('hex');
            return BigInt('0x' + hash.slice(0, 62)); // Truncate to fit field
        }
        return BigInt(d);
    });
    
    const commitment = poseidon(inputs);
    return '0x' + commitment.toString(16).padStart(64, '0');
}

// Generate mock signature for demonstration
function generateMockSignature(moduleId, verificationFlag, commitment, timestamp) {
    const message = `${moduleId}:${verificationFlag}:${commitment}:${timestamp}`;
    const hash = crypto.createHash('sha256').update(message).digest('hex');
    return '0x' + hash + crypto.randomBytes(32).toString('hex');
}

// Define verification policies
function getVerificationPolicies() {
    return {
        basic: {
            required: ['pan_v1', 'email_v1'],
            threshold: 2,
            description: 'Basic KYC requiring PAN and Email verification'
        },
        enhanced: {
            required: ['pan_v1', 'email_v1'],
            optional: ['passport_v1'],
            threshold: 3,
            description: 'Enhanced KYC requiring all three modules'
        },
        flexible: {
            required: ['pan_v1'],
            threshold: 2,
            weights: {
                'pan_v1': 1.0,
                'email_v1': 0.8,
                'passport_v1': 0.9
            },
            description: 'Flexible policy with weighted threshold'
        }
    };
}

// Main demonstration function
async function runE2EDemo() {
    console.log('🚀 ZKP Master Module - End-to-End Demo');
    console.log('=====================================\n');
    
    try {
        // Step 1: Generate module outputs
        console.log('📝 Step 1: Generating module verification outputs...');
        const { modules, sessionNonce } = simulateModuleOutputs();
        
        console.log(`Generated ${modules.length} module outputs:`);
        modules.forEach((module, i) => {
            console.log(`  ${i + 1}. ${module.module_id}: ${module.verification_flag ? '✅ PASS' : '❌ FAIL'} (score: ${module.metadata.score})`);
        });
        console.log();
        
        // Step 2: Test different policies
        console.log('📋 Step 2: Testing verification policies...');
        const policies = getVerificationPolicies();
        
        for (const [policyName, policy] of Object.entries(policies)) {
            console.log(`\n🔍 Testing policy: ${policyName}`);
            console.log(`   Description: ${policy.description}`);
            
            const sessionId = `demo_session_${policyName}_${Date.now()}`;
            
            // Prepare request
            const masterProveRequest = {
                session_id: sessionId,
                modules: modules.slice(0, policyName === 'enhanced' ? 3 : 2), // Adjust modules per policy
                policy: {
                    required: policy.required,
                    threshold: policy.threshold,
                    optional: policy.optional || []
                },
                options: {
                    anchor_on_chain: false,
                    expiry_minutes: 60
                }
            };
            
            // Simulate API call to master prove endpoint
            console.log('   📤 Sending master proof request...');
            
            // For demo, we'll simulate the response structure
            const mockResponse = await simulateMasterProofGeneration(masterProveRequest);
            
            if (mockResponse.success) {
                console.log('   ✅ Master proof generated successfully!');
                console.log(`   📊 Commitment: ${mockResponse.commitment.slice(0, 10)}...`);
                console.log(`   🔒 Nullifier: ${mockResponse.nullifier.slice(0, 10)}...`);
                console.log(`   ⏱️  Generation time: ${mockResponse.timings.total}ms`);
                console.log(`   📋 Policy satisfied: ${mockResponse.verification.policysSatisfied ? '✅' : '❌'}`);
                console.log(`   📍 Modules satisfied: ${mockResponse.verification.modulesSatisfied.join(', ')}`);
                
                // Step 3: Verify proof locally
                console.log('   🔍 Verifying proof locally...');
                const verificationResult = simulateProofVerification(mockResponse.masterProof, mockResponse.publicSignals);
                console.log(`   🎯 Verification result: ${verificationResult ? '✅ VALID' : '❌ INVALID'}`);
                
            } else {
                console.log('   ❌ Master proof generation failed:', mockResponse.error);
            }
        }
        
        // Step 4: Privacy analysis
        console.log('\n🔒 Step 3: Privacy Analysis...');
        analyzePricacyGuarantees(modules);
        
        // Step 5: Performance benchmarks
        console.log('\n⚡ Step 4: Performance Benchmarks...');
        await runPerformanceBenchmarks();
        
        // Step 6: Integration examples
        console.log('\n🔗 Step 5: Integration Examples...');
        showIntegrationExamples();
        
        console.log('\n🎉 Demo completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Set up the actual ZKP Master service: npm run serve');
        console.log('2. Test with real circuits: npm run circuit:test');
        console.log('3. Review API documentation: docs/api-spec.md');
        console.log('4. Check security guidelines: docs/threat-model.md');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        process.exit(1);
    }
}

// Simulate master proof generation
async function simulateMasterProofGeneration(request) {
    const startTime = Date.now();
    
    // Simulate validation
    await new Promise(resolve => setTimeout(resolve, 50)); // Validation time
    
    // Check policy satisfaction
    const passedModules = request.modules.filter(m => m.verification_flag === 1);
    const policysSatisfied = request.policy.required.every(reqId => 
        passedModules.some(m => m.module_id === reqId)
    ) && passedModules.length >= request.policy.threshold;
    
    if (!policysSatisfied) {
        return {
            success: false,
            error: 'Policy requirements not satisfied'
        };
    }
    
    // Simulate proof generation
    await new Promise(resolve => setTimeout(resolve, 200)); // Proof generation time
    
    // Generate mock outputs
    const commitmentRoot = generateCommitment(request.modules.map(m => m.commitment));
    const nullifier = generateCommitment([commitmentRoot, request.session_id, Date.now()]);
    
    const endTime = Date.now();
    
    return {
        success: true,
        masterProof: {
            pi_a: ['0x123...', '0x456...', '0x789...'],
            pi_b: [['0xabc...', '0xdef...'], ['0x111...', '0x222...'], ['0x333...', '0x444...']],
            pi_c: ['0x555...', '0x666...', '0x777...'],
            protocol: 'groth16',
            curve: 'bn128'
        },
        publicSignals: [commitmentRoot, '0x' + BigInt(request.policy.threshold).toString(16)],
        commitment: commitmentRoot,
        nullifier: nullifier,
        session_id: request.session_id,
        timestamp: Math.floor(Date.now() / 1000),
        verification: {
            policysSatisfied,
            modulesSatisfied: passedModules.map(m => m.module_id)
        },
        timings: {
            total: endTime - startTime,
            validation: 50,
            proofGeneration: 200
        }
    };
}

// Simulate proof verification
function simulateProofVerification(proof, publicSignals) {
    // In a real implementation, this would use snarkjs.groth16.verify()
    // For demo, we'll simulate verification logic
    
    const hasValidStructure = proof && 
                            proof.pi_a && proof.pi_a.length === 3 &&
                            proof.pi_b && proof.pi_b.length === 3 &&
                            proof.pi_c && proof.pi_c.length === 3 &&
                            proof.protocol === 'groth16';
    
    const hasValidSignals = publicSignals && publicSignals.length >= 1;
    
    return hasValidStructure && hasValidSignals;
}

// Analyze privacy guarantees
function analyzePricacyGuarantees(modules) {
    console.log('Privacy Analysis Results:');
    
    // Check commitment uniqueness
    const commitments = modules.map(m => m.commitment);
    const uniqueCommitments = new Set(commitments);
    
    console.log(`📊 Commitment Analysis:`);
    console.log(`   - Generated commitments: ${commitments.length}`);
    console.log(`   - Unique commitments: ${uniqueCommitments.size}`);
    console.log(`   - Collision-free: ${uniqueCommitments.size === commitments.length ? '✅' : '❌'}`);
    
    // Check timestamp distribution
    const timestamps = modules.map(m => m.timestamp);
    const timeSpread = Math.max(...timestamps) - Math.min(...timestamps);
    
    console.log(`⏰ Timing Analysis:`);
    console.log(`   - Time spread: ${timeSpread} seconds`);
    console.log(`   - Sequential pattern: ${timeSpread < 120 ? '⚠️  Detectable' : '✅ Obscured'}`);
    
    // Privacy score
    let privacyScore = 100;
    if (uniqueCommitments.size !== commitments.length) privacyScore -= 30;
    if (timeSpread < 60) privacyScore -= 20;
    
    console.log(`🔒 Overall Privacy Score: ${privacyScore}/100`);
    
    if (privacyScore < 80) {
        console.log('⚠️  Recommendations:');
        console.log('   - Add more randomness to commitments');
        console.log('   - Implement timing obfuscation');
        console.log('   - Use differential privacy mechanisms');
    }
}

// Run performance benchmarks
async function runPerformanceBenchmarks() {
    console.log('Performance Benchmark Results:');
    
    const benchmarks = [
        { name: 'Commitment Generation', iterations: 1000 },
        { name: 'Policy Validation', iterations: 500 },
        { name: 'Proof Generation (Simulated)', iterations: 10 },
        { name: 'Proof Verification (Simulated)', iterations: 100 }
    ];
    
    for (const benchmark of benchmarks) {
        const startTime = Date.now();
        
        for (let i = 0; i < benchmark.iterations; i++) {
            switch (benchmark.name) {
                case 'Commitment Generation':
                    generateCommitment(['test', 'data', i.toString()]);
                    break;
                case 'Policy Validation':
                    // Simulate policy validation logic
                    await new Promise(resolve => setTimeout(resolve, 1));
                    break;
                case 'Proof Generation (Simulated)':
                    await new Promise(resolve => setTimeout(resolve, 200));
                    break;
                case 'Proof Verification (Simulated)':
                    await new Promise(resolve => setTimeout(resolve, 10));
                    break;
            }
        }
        
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / benchmark.iterations;
        
        console.log(`⚡ ${benchmark.name}:`);
        console.log(`   - ${benchmark.iterations} iterations in ${totalTime}ms`);
        console.log(`   - Average: ${avgTime.toFixed(2)}ms per operation`);
        console.log(`   - Throughput: ${(1000 / avgTime).toFixed(0)} ops/second`);
    }
}

// Show integration examples
function showIntegrationExamples() {
    console.log('Integration Examples:');
    
    console.log('\n📱 Frontend Integration:');
    console.log('```javascript');
    console.log('// React/Vue.js example');
    console.log('const zkpService = new ZKPMasterClient("http://localhost:3001");');
    console.log('const proof = await zkpService.generateMasterProof(modules, policy);');
    console.log('console.log("Master proof:", proof.commitment);');
    console.log('```');
    
    console.log('\n🖥️  Backend Integration:');
    console.log('```python');
    console.log('# Python Flask/Django example');
    console.log('import requests');
    console.log('response = requests.post("http://localhost:3001/api/v1/zk/master_prove", {');
    console.log('    "session_id": session_id,');
    console.log('    "modules": modules,');
    console.log('    "policy": policy');
    console.log('})');
    console.log('```');
    
    console.log('\n🏦 Bank Integration:');
    console.log('```java');
    console.log('// Java Spring Boot example');
    console.log('@RestController');
    console.log('public class KYCController {');
    console.log('    public ResponseEntity<?> verifyCustomer(@RequestBody MasterProof proof) {');
    console.log('        boolean isValid = zkpVerifier.verify(proof);');
    console.log('        return ResponseEntity.ok(new VerificationResult(isValid));');
    console.log('    }');
    console.log('}');
    console.log('```');
    
    console.log('\n🔗 Smart Contract Integration:');
    console.log('```solidity');
    console.log('// Solidity example');
    console.log('contract KYCVerifier {');
    console.log('    function verifyIdentity(');
    console.log('        uint[2] memory a, uint[2][2] memory b, uint[2] memory c,');
    console.log('        uint[] memory publicSignals');
    console.log('    ) public view returns (bool) {');
    console.log('        return verifier.verifyProof(a, b, c, publicSignals);');
    console.log('    }');
    console.log('}');
    console.log('```');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    runE2EDemo().catch(console.error);
}

export {
    simulateModuleOutputs,
    generateCommitment,
    getVerificationPolicies,
    runE2EDemo
};