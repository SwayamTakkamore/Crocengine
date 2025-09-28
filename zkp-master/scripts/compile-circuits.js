#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..');
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'circuits');
const BUILD_DIR = path.join(PROJECT_ROOT, 'build');

// Ensure build directory exists
if (!existsSync(BUILD_DIR)) {
    mkdirSync(BUILD_DIR, { recursive: true });
}

const circuits = [
    'pan_verification',
    'email_verification', 
    'master_aggregation'
];

function findCircom() {
    // Try different circom locations
    const possiblePaths = [
        path.join(process.env.HOME, '.cargo', 'bin', 'circom'),
        'circom',
        '/usr/local/bin/circom',
        './circom'
    ];
    
    return possiblePaths[0]; // Use cargo installed circom first
}

function compileCircuit(circuitName) {
    return new Promise((resolve, reject) => {
        console.log(`Compiling circuit: ${circuitName}`);
        
        const inputFile = path.join(CIRCUITS_DIR, `${circuitName}.circom`);
        const outputDir = path.join(BUILD_DIR, circuitName);
        
        // Ensure output directory exists
        if (!existsSync(outputDir)) {
            mkdirSync(outputDir, { recursive: true });
        }
        
        const args = [
            '--r1cs',
            '--wasm', 
            '--sym',
            '--output', outputDir,
            inputFile
        ];
        
        const circomCmd = findCircom();
        const circom = spawn(circomCmd, args);

        let stdout = '';
        let stderr = '';

        circom.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        circom.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(`${circuitName} error: ${data.toString().trim()}`);
        });

        circom.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${circuitName} compiled successfully`);
                resolve({ circuitName, success: true });
            } else {
                console.error(`❌ ${circuitName} compilation failed with code ${code}`);
                reject(new Error(`Circuit compilation failed with code ${code}`));
            }
        });

        circom.on('error', (err) => {
            console.error(`❌ Failed to start circom for ${circuitName}:`, err.message);
            reject(new Error(`Failed to start circom: ${err.message}`));
        });
    });
}

async function main() {
    try {
        console.log('🔧 Compiling ZK circuits...');
        
        for (const circuit of circuits) {
            await compileCircuit(circuit);
        }
        
        console.log('✅ All circuits compiled successfully!');
        console.log(`Output directory: ${BUILD_DIR}`);
        
    } catch (error) {
        console.error('❌ Circuit compilation failed:', error.message);
        process.exit(1);
    }
}

main();