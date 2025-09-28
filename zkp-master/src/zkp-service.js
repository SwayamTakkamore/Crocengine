import snarkjs from 'snarkjs';
import { poseidon } from 'poseidon-lite';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ZKPService {
    constructor() {
        this.projectRoot = path.join(__dirname, '..');
        this.keysDir = path.join(this.projectRoot, 'keys');
        this.buildDir = path.join(this.projectRoot, 'build');
        
        // Circuit configurations
        this.circuits = {
            'pan_verification': {
                name: 'PAN Verification',
                maxConstraints: 5000,
                publicInputs: 2
            },
            'email_verification': {
                name: 'Email Verification', 
                maxConstraints: 3000,
                publicInputs: 3
            },
            'master_aggregation': {
                name: 'Master Aggregation',
                maxConstraints: 20000,
                publicInputs: 5
            }
        };
        
        // Cache for verification keys
        this.verificationKeys = new Map();
        
        this.initialize();
    }
    
    async initialize() {
        console.log('Initializing ZKP Service...');
        
        // Load verification keys
        for (const circuitId of Object.keys(this.circuits)) {
            try {
                await this.loadVerificationKey(circuitId);
                console.log(`✅ Loaded verification key for ${circuitId}`);
            } catch (error) {
                console.warn(`⚠️ Could not load verification key for ${circuitId}: ${error.message}`);
            }
        }
    }
    
    async loadVerificationKey(circuitId) {
        const vkeyPath = path.join(this.keysDir, circuitId, `${circuitId}_verification_key.json`);
        
        if (!existsSync(vkeyPath)) {
            throw new Error(`Verification key not found: ${vkeyPath}`);
        }
        
        const vkey = JSON.parse(readFileSync(vkeyPath, 'utf8'));
        this.verificationKeys.set(circuitId, vkey);
        return vkey;
    }
    
    async getAvailableCircuits() {
        return Object.entries(this.circuits).map(([id, config]) => ({
            id,
            ...config,
            hasVerificationKey: this.verificationKeys.has(id)
        }));
    }
    
    async getVerificationKey(circuitId) {
        if (this.verificationKeys.has(circuitId)) {
            return this.verificationKeys.get(circuitId);
        }
        
        try {
            return await this.loadVerificationKey(circuitId);
        } catch (error) {
            return null;
        }
    }
    
    generateCommitment(data, nonce) {
        // Convert data to field elements for Poseidon hash
        const inputs = [];
        
        if (Array.isArray(data)) {
            inputs.push(...data.map(d => BigInt(d)));
        } else if (typeof data === 'string') {
            // Convert string to bytes then to field elements
            const bytes = Buffer.from(data, 'utf8');
            for (let i = 0; i < bytes.length; i += 31) { // 31 bytes max per field element
                const chunk = bytes.slice(i, i + 31);
                inputs.push(BigInt('0x' + chunk.toString('hex')));
            }
        } else {
            inputs.push(BigInt(data));
        }
        
        inputs.push(BigInt(nonce));
        
        // Generate Poseidon hash
        const hash = poseidon(inputs);
        return '0x' + hash.toString(16).padStart(64, '0');
    }
    
    async generateMasterProof({ sessionId, modules, policy, options, timestamp }) {
        try {
            // Step 1: Prepare circuit inputs
            const circuitInputs = this.prepareMasterCircuitInputs(modules, policy, sessionId, timestamp);
            
            // Step 2: Generate witness
            const witness = await this.generateWitness('master_aggregation', circuitInputs);
            
            // Step 3: Generate proof
            const proof = await this.generateProof('master_aggregation', witness, circuitInputs);
            
            // Step 4: Generate nullifier and commitment root
            const commitmentRoot = this.calculateCommitmentRoot(modules.map(m => m.commitment));
            const nullifier = this.generateNullifier(commitmentRoot, sessionId, timestamp);
            
            // Step 5: Handle optional on-chain anchoring
            let anchorTx = null;
            if (options.anchor_on_chain) {
                anchorTx = await this.anchorOnChain(commitmentRoot, options.chain_id);
            }
            
            const response = {
                masterProof: proof.proof,
                publicSignals: proof.publicSignals,
                commitment: commitmentRoot,
                nullifier,
                session_id: sessionId,
                timestamp,
                expiry: timestamp + (options.expiry_minutes || 60) * 60,
                policy_hash: this.generatePolicyHash(policy),
                anchorTx,
                verification: {
                    verificationKey: `${process.env.API_BASE_URL || 'http://localhost:3001'}/api/v1/zk/verification-key/master_aggregation`,
                    circuitId: 'master_aggregation',
                    modulesSatisfied: modules.filter(m => m.verification_flag === 1).map(m => m.module_id),
                    policysSatisfied: this.validatePolicy(modules, policy)
                }
            };
            
            return response;
            
        } catch (error) {
            throw new Error(`Master proof generation failed: ${error.message}`);
        }
    }
    
    prepareMasterCircuitInputs(modules, policy, sessionId, timestamp) {
        const maxModules = 8; // Must match circuit parameter
        
        // Pad arrays to fixed size
        const moduleCommitments = new Array(maxModules).fill(0);
        const moduleFlags = new Array(maxModules).fill(0);
        const moduleSignatures = new Array(maxModules).fill(0);
        const requiredModules = new Array(maxModules).fill(0);
        
        // Fill with actual module data
        for (let i = 0; i < Math.min(modules.length, maxModules); i++) {
            const module = modules[i];
            moduleCommitments[i] = BigInt(module.commitment);
            moduleFlags[i] = module.verification_flag;
            moduleSignatures[i] = BigInt(module.signature); // Simplified - should validate signature
        }
        
        // Set required modules based on policy
        for (let i = 0; i < modules.length && i < maxModules; i++) {
            const moduleId = modules[i].module_id;
            requiredModules[i] = policy.required.includes(moduleId) ? 1 : 0;
        }
        
        const sessionNonce = this.stringToFieldElement(sessionId);
        const masterSecret = this.generateMasterSecret(); // Should be derived from secure source
        const policyHash = this.generatePolicyHash(policy);
        
        return {
            // Private inputs
            module_commitments: moduleCommitments,
            module_flags: moduleFlags,
            module_signatures: moduleSignatures,
            session_nonce: sessionNonce,
            master_secret: masterSecret,
            
            // Public inputs
            required_modules: requiredModules,
            min_threshold: policy.threshold || policy.required.length,
            policy_hash: policyHash,
            timestamp: BigInt(timestamp)
        };
    }
    
    async generateWitness(circuitId, inputs) {
        try {
            const wasmPath = path.join(this.buildDir, circuitId, `${circuitId}.wasm`);
            
            if (!existsSync(wasmPath)) {
                throw new Error(`Circuit WASM not found: ${wasmPath}`);
            }
            
            // Use snarkjs to calculate witness
            const { witness } = await snarkjs.wtns.calculate(inputs, wasmPath);
            return witness;
            
        } catch (error) {
            throw new Error(`Witness generation failed: ${error.message}`);
        }
    }
    
    async generateProof(circuitId, witness, publicSignals) {
        try {
            const zkeyPath = path.join(this.keysDir, circuitId, `${circuitId}_final.zkey`);
            
            if (!existsSync(zkeyPath)) {
                throw new Error(`Proving key not found: ${zkeyPath}`);
            }
            
            // Generate Groth16 proof
            const { proof, publicSignals: calculatedPublicSignals } = await snarkjs.groth16.prove(
                zkeyPath,
                witness
            );
            
            return {
                proof: {
                    pi_a: proof.pi_a.slice(0, 2).map(x => x.toString()),
                    pi_b: proof.pi_b.slice(0, 2).map(row => row.map(x => x.toString())),
                    pi_c: proof.pi_c.slice(0, 2).map(x => x.toString()),
                    protocol: 'groth16',
                    curve: 'bn128'
                },
                publicSignals: calculatedPublicSignals.map(x => x.toString())
            };
            
        } catch (error) {
            throw new Error(`Proof generation failed: ${error.message}`);
        }
    }
    
    async verifyProof(proof, publicSignals, verificationKey) {
        try {
            // Use provided verification key or get from cache
            const vkey = verificationKey || this.verificationKeys.get('master_aggregation');
            
            if (!vkey) {
                throw new Error('Verification key not available');
            }
            
            const isValid = await snarkjs.groth16.verify(vkey, publicSignals, proof);
            return isValid;
            
        } catch (error) {
            console.error('Proof verification error:', error);
            return false;
        }
    }
    
    calculateCommitmentRoot(commitments) {
        // Simple Merkle tree calculation using Poseidon
        // In production, use proper Merkle tree implementation
        const leaves = commitments.map(c => BigInt(c));
        
        // Pad to power of 2
        while (leaves.length < 8) {
            leaves.push(BigInt(0));
        }
        
        // Build tree bottom-up
        let currentLevel = leaves;
        while (currentLevel.length > 1) {
            const nextLevel = [];
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : BigInt(0);
                nextLevel.push(poseidon([left, right]));
            }
            currentLevel = nextLevel;
        }
        
        return '0x' + currentLevel[0].toString(16).padStart(64, '0');
    }
    
    generateNullifier(commitmentRoot, sessionId, timestamp) {
        const inputs = [
            BigInt(commitmentRoot),
            this.stringToFieldElement(sessionId),
            BigInt(timestamp)
        ];
        
        const nullifier = poseidon(inputs);
        return '0x' + nullifier.toString(16).padStart(64, '0');
    }
    
    generatePolicyHash(policy) {
        const policyString = JSON.stringify({
            required: policy.required.sort(),
            threshold: policy.threshold || policy.required.length,
            optional: policy.optional?.sort() || []
        });
        
        const hash = crypto.createHash('sha256').update(policyString).digest('hex');
        return BigInt('0x' + hash.slice(0, 62)); // Truncate to fit field
    }
    
    validatePolicy(modules, policy) {
        const passedModules = modules.filter(m => m.verification_flag === 1);
        const passedIds = passedModules.map(m => m.module_id);
        
        // Check all required modules passed
        const allRequiredPassed = policy.required.every(requiredId => 
            passedIds.includes(requiredId)
        );
        
        // Check threshold if specified
        const thresholdMet = !policy.threshold || passedModules.length >= policy.threshold;
        
        return allRequiredPassed && thresholdMet;
    }
    
    stringToFieldElement(str) {
        const hash = crypto.createHash('sha256').update(str).digest('hex');
        return BigInt('0x' + hash.slice(0, 62)); // Truncate to fit BN254 field
    }
    
    generateMasterSecret() {
        // In production, derive from secure key management system
        return BigInt('0x' + crypto.randomBytes(31).toString('hex'));
    }
    
    async anchorOnChain(commitmentRoot, chainId) {
        // TODO: Implement blockchain anchoring
        // This would interact with a smart contract to store the commitment root
        console.log(`Would anchor ${commitmentRoot} on chain ${chainId}`);
        
        return null; // Placeholder
    }
}