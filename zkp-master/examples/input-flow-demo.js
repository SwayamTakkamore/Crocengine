// Example: How to provide inputs to ZK circuits
// This shows the complete flow from user data to ZK proof

import * as snarkjs from 'snarkjs';
import { poseidon } from 'circomlib-js';

// Example: User provides PAN verification data
async function generatePanProof() {
    console.log('📝 Generating PAN verification proof...');
    
    // 1. USER INPUTS (this is what you provide)
    const userInputs = {
        panNumber: "ABCDE1234F",        // Real PAN number (private)
        fullName: "John Doe",           // Full name (private)  
        govApiResponse: 1,              // Government API said valid (private)
        sessionId: "session_123"        // Unique session (private)
    };
    
    // 2. HASH THE SENSITIVE DATA (privacy-preserving)
    const panHash = poseidon([...Buffer.from(userInputs.panNumber)]);
    const nameHash = poseidon([...Buffer.from(userInputs.fullName)]);
    const sessionNonce = poseidon([...Buffer.from(userInputs.sessionId)]);
    
    // 3. GENERATE EXPECTED COMMITMENT (this is what the circuit will verify)
    const expectedCommitment = poseidon([panHash, nameHash, sessionNonce]);
    
    // 4. CIRCUIT INPUTS (what gets fed to the ZK circuit)
    const circuitInputs = {
        // Private inputs (never revealed to anyone)
        pan_hash: panHash.toString(),
        name_hash: nameHash.toString(), 
        session_nonce: sessionNonce.toString(),
        government_response: userInputs.govApiResponse,
        
        // Public inputs (can be seen by verifiers)
        expected_commitment: expectedCommitment.toString(),
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('🔐 Circuit Inputs:');
    console.log('Private inputs (hidden):', {
        pan_hash: '0x...' + panHash.toString().slice(-8),
        name_hash: '0x...' + nameHash.toString().slice(-8),
        session_nonce: '0x...' + sessionNonce.toString().slice(-8),
        government_response: circuitInputs.government_response
    });
    console.log('Public inputs (visible):', {
        expected_commitment: '0x...' + circuitInputs.expected_commitment.slice(-8),
        timestamp: new Date(circuitInputs.timestamp * 1000).toISOString()
    });
    
    // 5. GENERATE ZK PROOF using snarkjs
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(
            circuitInputs,
            "build/pan_verification_simple/pan_verification_simple_js/pan_verification_simple.wasm",
            "keys/pan_verification_simple_final.zkey"
        );
        
        console.log('✅ ZK Proof generated successfully!');
        console.log('🔍 Proof size:', JSON.stringify(proof).length, 'bytes');
        console.log('📊 Public signals:', publicSignals);
        
        return { proof, publicSignals, commitment: expectedCommitment };
        
    } catch (error) {
        console.error('❌ Proof generation failed:', error.message);
        throw error;
    }
}

// Example: Integration with your existing verification modules
async function integrateWithExistingModules() {
    console.log('🔗 Integrating with existing CrocEngine modules...');
    
    // This is how your existing modules would provide inputs:
    
    // From ai-models/pan_verification/
    const panVerificationResult = {
        isValid: true,
        panNumber: "ABCDE1234F",  // This comes from OCR/validation
        confidence: 0.95,
        govApiResponse: 1
    };
    
    // From ai-models/email_verification/
    const emailVerificationResult = {
        isValid: true,
        email: "user@example.com",
        otpVerified: true,
        timestamp: Date.now()
    };
    
    // Convert to ZK-friendly inputs
    const zkInputs = {
        pan: {
            pan_hash: poseidon([...Buffer.from(panVerificationResult.panNumber)]),
            government_response: panVerificationResult.govApiResponse,
            session_nonce: poseidon([Math.random() * 1000000])
        },
        email: {
            email_hash: poseidon([...Buffer.from(emailVerificationResult.email)]),
            verification_status: emailVerificationResult.isValid ? 1 : 0,
            session_nonce: poseidon([Math.random() * 1000000])
        }
    };
    
    console.log('🔄 Converted verification results to ZK inputs');
    console.log('📈 Ready for master proof generation');
    
    return zkInputs;
}

// Example: Master proof combining multiple verifications
async function generateMasterProof(panProof, emailProof) {
    console.log('🎯 Generating master aggregation proof...');
    
    const masterInputs = {
        // Private inputs from individual module proofs
        module1_commitment: panProof.commitment,
        module1_flag: 1,  // PAN verification passed
        module2_commitment: emailProof.commitment, 
        module2_flag: 1,  // Email verification passed
        session_nonce: poseidon([Date.now()]),
        master_secret: poseidon([Math.random() * 1000000]),
        
        // Public policy requirements
        required_modules: 3,  // Both PAN and Email required (bitmask: 01 + 10 = 11 = 3)
        min_threshold: 2,     // Must pass at least 2 modules
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    console.log('📋 Master proof inputs prepared');
    console.log('🎯 Policy: Require both PAN and Email verification');
    
    // Generate the master proof (this would use the master aggregation circuit)
    return masterInputs;
}

// Usage example
if (import.meta.url === new URL(import.meta.url).href) {
    console.log('🚀 ZKP Input Example Demo');
    console.log('=' .repeat(50));
    
    generatePanProof()
        .then(result => {
            console.log('✅ PAN proof completed');
            return integrateWithExistingModules();
        })
        .then(zkInputs => {
            console.log('✅ Integration completed');
            console.log('🎉 Ready to generate master proof!');
        })
        .catch(console.error);
}

export { generatePanProof, integrateWithExistingModules, generateMasterProof };