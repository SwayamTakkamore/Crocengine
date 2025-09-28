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
];async function setupCircuit(circuitName) {
    console.log(`Setting up keys for circuit: ${circuitName}`);
    
    const circuitDir = path.join(BUILD_DIR, circuitName);
    const r1csFile = path.join(circuitDir, `${circuitName}.r1cs`);
    
    if (!existsSync(r1csFile)) {
        throw new Error(`R1CS file not found: ${r1csFile}. Run compile-circuits.js first.`);
    }
    
    const keyDir = path.join(KEYS_DIR, circuitName);
    if (!existsSync(keyDir)) {
        mkdirSync(keyDir, { recursive: true });
    }
    
    // Phase 1: Powers of tau ceremony
    console.log(`📡 Downloading powers of tau for ${circuitName}...`);
    const ptauFile = path.join(keyDir, 'powersOfTau28_hez_final_15.ptau');
    
    if (!existsSync(ptauFile)) {
        // Download ptau file (for circuits up to 2^15 constraints)
        // In production, use a larger ceremony or generate your own
        await downloadPtau('https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_15.ptau', ptauFile);
    }
    
    // Phase 2: Circuit-specific setup
    console.log(`🔑 Generating proving and verification keys for ${circuitName}...`);
    
    const zkeyFile = path.join(keyDir, `${circuitName}_0000.zkey`);
    const finalZkeyFile = path.join(keyDir, `${circuitName}_final.zkey`);
    const vkeyFile = path.join(keyDir, `${circuitName}_verification_key.json`);
    
    // Groth16 setup
    await snarkjs.groth16.setup(r1csFile, ptauFile, zkeyFile);
    
    // Contribute to phase 2 (in production, do proper ceremony)
    await snarkjs.zKey.contribute(zkeyFile, finalZkeyFile, circuitName, "random entropy");
    
    // Export verification key
    const vKey = await snarkjs.zKey.exportVerificationKey(finalZkeyFile);
    writeFileSync(vkeyFile, JSON.stringify(vKey, null, 2));
    
    console.log(`✅ ${circuitName} keys generated successfully`);
    console.log(`   Proving key: ${finalZkeyFile}`);
    console.log(`   Verification key: ${vkeyFile}`);
}

async function downloadPtau(url, outputFile) {
    console.log(`Downloading ${url}...`);
    
    const https = await import('https');
    const fs = await import('fs');
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputFile);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Downloaded: ${outputFile}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(outputFile, () => {}); // Delete file on error
            reject(err);
        });
    });
}

async function main() {
    try {
        console.log('🔐 Setting up ZK proving and verification keys...');
        console.log('This may take several minutes...');
        
        for (const circuit of circuits) {
            await setupCircuit(circuit);
        }
        
        console.log('✅ All circuit keys generated successfully!');
        console.log(`Keys directory: ${KEYS_DIR}`);
        
    } catch (error) {
        console.error('❌ Key setup failed:', error.message);
        process.exit(1);
    }
}

main();