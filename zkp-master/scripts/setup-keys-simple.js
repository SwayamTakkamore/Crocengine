#!/usr/bin/env node

import * as snarkjs from 'snarkjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');
const KEYS_DIR = path.join(PROJECT_ROOT, 'keys');

// Ensure keys directory exists
if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
}

const circuits = [
    'pan_verification_simple',
    'email_verification_simple',
    'master_aggregation_simple'
];

async function setupCircuit(circuitName) {
    console.log(`🔑 Setting up keys for circuit: ${circuitName}`);
    
    const circuitDir = path.join(BUILD_DIR, circuitName);
    const r1csFile = path.join(circuitDir, `${circuitName}.r1cs`);
    
    if (!existsSync(r1csFile)) {
        throw new Error(`R1CS file not found: ${r1csFile}. Run compile-circuits.js first.`);
    }
    
    const keyDir = path.join(KEYS_DIR, circuitName);
    if (!existsSync(keyDir)) {
        mkdirSync(keyDir, { recursive: true });
    }
    
    // Files for this circuit
    const ptauFile = path.join(keyDir, 'powersoftau28_hez_final_08.ptau');
    const zkeyFile = path.join(keyDir, `${circuitName}_0000.zkey`);
    const finalZkeyFile = path.join(keyDir, `${circuitName}_final.zkey`);
    const vkeyFile = path.join(keyDir, `${circuitName}_vkey.json`);
    
    try {
        // Download powers of tau if not exists
        if (!existsSync(ptauFile)) {
            console.log(`📡 Downloading powers of tau...`);
            console.log('⚠️  In production, download from: https://hermez.s3-eu-west-1.amazonaws.com/powersoftau28_hez_final_08.ptau');
            
            // For demo, create a small ptau file for testing
            console.log('🧪 Creating test ptau for development...');
            await snarkjs.powersOfTau.newAccumulator(r1csFile, 0, ptauFile);
        }
        
        // Groth16 setup
        console.log(`⚡ Running Groth16 setup...`);
        await snarkjs.groth16.setup(r1csFile, ptauFile, zkeyFile);
        
        // Phase 2 contribution (in production, this should be a ceremony)
        console.log(`🎲 Adding random contribution...`);
        await snarkjs.zKey.contribute(zkeyFile, finalZkeyFile, "dev-contribution", Math.random().toString());
        
        // Export verification key
        console.log(`🔐 Exporting verification key...`);
        const vKey = await snarkjs.zKey.exportVerificationKey(finalZkeyFile);
        writeFileSync(vkeyFile, JSON.stringify(vKey, null, 2));
        
        console.log(`✅ Keys generated for ${circuitName}`);
        console.log(`   Final key: ${finalZkeyFile}`);
        console.log(`   Verification key: ${vkeyFile}`);
        
        return {
            circuitName,
            zkeyFile: finalZkeyFile,
            vkeyFile,
            success: true
        };
        
    } catch (error) {
        console.error(`❌ Key setup failed for ${circuitName}:`, error.message);
        throw error;
    }
}

async function main() {
    try {
        console.log('🔧 Setting up ZK proving keys...');
        console.log('⚠️  This may take several minutes...');
        
        const results = [];
        
        for (const circuit of circuits) {
            const result = await setupCircuit(circuit);
            results.push(result);
        }
        
        console.log('\n✅ All proving keys generated successfully!');
        console.log('\n📋 Summary:');
        
        for (const result of results) {
            console.log(`  ✓ ${result.circuitName}`);
            console.log(`    Key: ${path.basename(result.zkeyFile)}`);
            console.log(`    Verifier: ${path.basename(result.vkeyFile)}`);
        }
        
        console.log('\n🎯 Next steps:');
        console.log('  1. npm run serve - Start the ZKP API server');
        console.log('  2. npm test - Run the test suite');
        console.log('  3. Check examples/ for integration demos');
        
    } catch (error) {
        console.error('\n❌ Key setup failed:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);