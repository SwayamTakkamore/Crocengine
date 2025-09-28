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
    'pan_verification_simple',
    'email_verification_simple', 
    'master_aggregation_simple'
];

function compileCircuit(circuitName, inputFile, outputDir) {
    return new Promise((resolve, reject) => {
        console.log(`🔧 Compiling circuit: ${circuitName}`);
        
        const args = [
            '--r1cs',
            '--wasm', 
            '--sym',
            '--output', outputDir,
            '-l', '.',
            inputFile
        ];
        
        // Use circom from PATH (installed via cargo)
        const circom = spawn('circom', args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH}` }
        });
        
        let stdout = '';
        let stderr = '';
        
        circom.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        circom.stderr.on('data', (data) => {
            stderr += data.toString();
            console.log(`${circuitName} error:`, data.toString());
        });
        
        circom.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ ${circuitName} compiled successfully`);
                resolve(stdout);
            } else {
                console.log(`❌ ${circuitName} compilation failed with code ${code}`);
                reject(new Error(`Circuit compilation failed with code ${code}`));
            }
        });
        
        circom.on('error', (err) => {
            console.log(`❌ Failed to start circom for ${circuitName}:`, err.message);
            reject(err);
        });
    });
}

async function main() {
    console.log('🔧 Compiling ZK circuits...');
    
    try {
        for (const circuit of circuits) {
            const inputFile = path.join(CIRCUITS_DIR, `${circuit}.circom`);
            const outputDir = path.join(BUILD_DIR, circuit);
            
            if (!existsSync(inputFile)) {
                console.log(`⚠️  Circuit file not found: ${inputFile}`);
                continue;
            }
            
            // Create output directory for this circuit
            if (!existsSync(outputDir)) {
                mkdirSync(outputDir, { recursive: true });
            }
            
            await compileCircuit(circuit, inputFile, outputDir);
        }
        
        console.log('🎉 All circuits compiled successfully!');
    } catch (error) {
        console.error('❌ Circuit compilation failed:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);