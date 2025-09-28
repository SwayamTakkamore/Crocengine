#!/usr/bin/env node

import snarkjs from 'snarkjs';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const KEYS_DIR = path.join(PROJECT_ROOT, 'keys');
const TEST_DIR = path.join(PROJECT_ROOT, 'test');

// Test data for circuits
const testVectors = {
    pan_verification: {
        valid_inputs: {
            pan_digits: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
            name_hash: '12345678901234567890123456789012',
            session_nonce: '98765432109876543210987654321098',
            government_response: 1,
            expected_commitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            timestamp: Math.floor(Date.now() / 1000)
        },
        expected_outputs: {
            verification_flag: 1
        }
    },
    
    email_verification: {
        valid_inputs: {
            email_hash: '11111111111111111111111111111111',
            domain_hash: '22222222222222222222222222222222',
            provided_otp: [1, 2, 3, 4, 5, 6],
            expected_otp: [1, 2, 3, 4, 5, 6],
            session_nonce: '33333333333333333333333333333333',
            expected_commitment: '0x2345678901bcdef02345678901bcdef02345678901bcdef02345678901bcdef0',
            timestamp: Math.floor(Date.now() / 1000),
            otp_expiry: Math.floor(Date.now() / 1000) + 300
        },
        expected_outputs: {
            verification_flag: 1
        }
    }
};

async function testCircuit(circuitName) {
    console.log(`\n🧪 Testing circuit: ${circuitName}`);
    
    try {
        const wasmPath = path.join(BUILD_DIR, circuitName, `${circuitName}.wasm`);
        const zkeyPath = path.join(KEYS_DIR, circuitName, `${circuitName}_final.zkey`);
        const vkeyPath = path.join(KEYS_DIR, circuitName, `${circuitName}_verification_key.json`);
        
        // Check if files exist
        const fs = await import('fs');
        if (!fs.existsSync(wasmPath)) {
            console.log(`❌ WASM file not found: ${wasmPath}`);
            return false;
        }
        
        if (!fs.existsSync(zkeyPath)) {
            console.log(`❌ Proving key not found: ${zkeyPath}`);
            return false;
        }
        
        if (!fs.existsSync(vkeyPath)) {
            console.log(`❌ Verification key not found: ${vkeyPath}`);
            return false;
        }
        
        const testData = testVectors[circuitName];
        if (!testData) {
            console.log(`❌ No test data available for ${circuitName}`);
            return false;
        }
        
        console.log(`📝 Input validation...`);
        
        // Step 1: Calculate witness
        console.log(`🧮 Calculating witness...`);
        const { witness } = await snarkjs.wtns.calculate(testData.valid_inputs, wasmPath);
        
        // Step 2: Generate proof
        console.log(`🔑 Generating proof...`);
        const startTime = Date.now();
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
        const provingTime = Date.now() - startTime;
        
        console.log(`✅ Proof generated in ${provingTime}ms`);
        
        // Step 3: Verify proof
        console.log(`🔍 Verifying proof...`);
        const vKey = JSON.parse(readFileSync(vkeyPath, 'utf8'));
        
        const verifyStart = Date.now();
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        const verifyTime = Date.now() - verifyStart;
        
        if (isValid) {
            console.log(`✅ Proof verified successfully in ${verifyTime}ms`);
        } else {
            console.log(`❌ Proof verification failed`);
            return false;
        }
        
        // Step 4: Check expected outputs
        console.log(`📊 Checking expected outputs...`);
        const expectedOutputs = testData.expected_outputs;
        
        for (const [key, expectedValue] of Object.entries(expectedOutputs)) {
            // Public signals are in order, so we need to map them correctly
            // This is simplified - in practice, you'd need to know the exact mapping
            const actualValue = publicSignals[0]; // Assuming first signal is verification_flag
            
            if (key === 'verification_flag') {
                if (actualValue === expectedValue.toString()) {
                    console.log(`✅ ${key}: ${actualValue} (expected ${expectedValue})`);
                } else {
                    console.log(`❌ ${key}: ${actualValue} (expected ${expectedValue})`);
                    return false;
                }
            }
        }
        
        // Save test results
        const testResults = {
            circuitName,
            timestamp: new Date().toISOString(),
            inputs: testData.valid_inputs,
            proof,
            publicSignals,
            isValid,
            timings: {
                proving: provingTime,
                verification: verifyTime
            }
        };
        
        const resultsPath = path.join(TEST_DIR, `${circuitName}_test_results.json`);
        writeFileSync(resultsPath, JSON.stringify(testResults, null, 2));
        console.log(`📁 Test results saved to: ${resultsPath}`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ Circuit test failed: ${error.message}`);
        console.log(`Stack trace: ${error.stack}`);
        return false;
    }
}

async function testMasterAggregation() {
    console.log(`\n🎯 Testing master aggregation circuit...`);
    
    try {
        const circuitName = 'master_aggregation';
        const wasmPath = path.join(BUILD_DIR, circuitName, `${circuitName}.wasm`);
        const zkeyPath = path.join(KEYS_DIR, circuitName, `${circuitName}_final.zkey`);
        const vkeyPath = path.join(KEYS_DIR, circuitName, `${circuitName}_verification_key.json`);
        
        // Prepare test inputs for master circuit
        const maxModules = 8;
        const testInputs = {
            // Private inputs
            module_commitments: new Array(maxModules).fill(0).map((_, i) => 
                i < 2 ? (BigInt(i + 1) * BigInt('0x1111111111111111111111111111111111111111111111111111111111111111')).toString() : '0'
            ),
            module_flags: new Array(maxModules).fill(0).map((_, i) => i < 2 ? 1 : 0),
            module_signatures: new Array(maxModules).fill(0).map((_, i) => 
                i < 2 ? (BigInt(i + 1) * BigInt('0x2222222222222222222222222222222222222222222222222222222222222222')).toString() : '0'
            ),
            session_nonce: '12345678901234567890123456789012',
            master_secret: '98765432109876543210987654321098',
            
            // Public inputs
            required_modules: new Array(maxModules).fill(0).map((_, i) => i < 2 ? 1 : 0),
            min_threshold: 2,
            policy_hash: '11111111111111111111111111111111',
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        console.log(`🧮 Calculating witness for master circuit...`);
        const { witness } = await snarkjs.wtns.calculate(testInputs, wasmPath);
        
        console.log(`🔑 Generating master proof...`);
        const startTime = Date.now();
        const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyPath, witness);
        const provingTime = Date.now() - startTime;
        
        console.log(`✅ Master proof generated in ${provingTime}ms`);
        
        console.log(`🔍 Verifying master proof...`);
        const vKey = JSON.parse(readFileSync(vkeyPath, 'utf8'));
        
        const verifyStart = Date.now();
        const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        const verifyTime = Date.now() - verifyStart;
        
        if (isValid) {
            console.log(`✅ Master proof verified successfully in ${verifyTime}ms`);
        } else {
            console.log(`❌ Master proof verification failed`);
            return false;
        }
        
        // Save master test results
        const masterResults = {
            circuitName: 'master_aggregation',
            timestamp: new Date().toISOString(),
            inputs: testInputs,
            proof,
            publicSignals,
            isValid,
            timings: {
                proving: provingTime,
                verification: verifyTime
            }
        };
        
        const resultsPath = path.join(TEST_DIR, 'master_aggregation_test_results.json');
        writeFileSync(resultsPath, JSON.stringify(masterResults, null, 2));
        console.log(`📁 Master test results saved to: ${resultsPath}`);
        
        return true;
        
    } catch (error) {
        console.log(`❌ Master circuit test failed: ${error.message}`);
        console.log(`Stack trace: ${error.stack}`);
        return false;
    }
}

async function main() {
    console.log('🚀 Starting ZK circuit tests...');
    
    const circuits = ['pan_verification', 'email_verification'];
    const results = [];
    
    // Test individual circuits
    for (const circuit of circuits) {
        const success = await testCircuit(circuit);
        results.push({ circuit, success });
    }
    
    // Test master aggregation
    const masterSuccess = await testMasterAggregation();
    results.push({ circuit: 'master_aggregation', success: masterSuccess });
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    let allPassed = true;
    for (const { circuit, success } of results) {
        const status = success ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} ${circuit}`);
        if (!success) allPassed = false;
    }
    
    console.log('\n' + (allPassed ? '🎉 All tests passed!' : '💥 Some tests failed!'));
    
    if (!allPassed) {
        process.exit(1);
    }
}

main().catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
});