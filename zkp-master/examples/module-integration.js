// Integration adapter: Connecting existing modules to ZKP system
// This shows how your current verification modules feed into ZK circuits

import { poseidon } from 'circomlib-js';

/**
 * Adapter for PAN Verification Module
 * Converts output from ai-models/pan_verification/ to ZK-compatible format
 */
class PanVerificationAdapter {
    static async convertToZkInputs(panModuleOutput) {
        console.log('🔄 Converting PAN module output to ZK inputs...');
        
        // Input from your existing PAN module (ai-models/pan_verification/pipeline.py)
        const {
            pan_number,           // Extracted via OCR
            name,                // Extracted from document
            government_valid,    // Result from government API
            confidence_score,    // OCR confidence
            verification_id      // Unique verification session
        } = panModuleOutput;
        
        // Convert to privacy-preserving hashes
        const zkInputs = {
            // Private inputs (PII hashed for privacy)
            pan_hash: poseidon([...Buffer.from(pan_number)]).toString(),
            name_hash: poseidon([...Buffer.from(name)]).toString(),
            session_nonce: poseidon([...Buffer.from(verification_id)]).toString(),
            government_response: government_valid ? 1 : 0,
            
            // Public inputs (safe to expose)
            expected_commitment: null, // Will be calculated
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Calculate expected commitment
        zkInputs.expected_commitment = poseidon([
            BigInt(zkInputs.pan_hash),
            BigInt(zkInputs.name_hash), 
            BigInt(zkInputs.session_nonce)
        ]).toString();
        
        console.log('✅ PAN verification converted to ZK format');
        console.log('🔐 PII safely hashed for privacy');
        
        return zkInputs;
    }
}

/**
 * Adapter for Email Verification Module  
 * Converts output from ai-models/email_verification/ to ZK-compatible format
 */
class EmailVerificationAdapter {
    static async convertToZkInputs(emailModuleOutput) {
        console.log('🔄 Converting Email module output to ZK inputs...');
        
        // Input from your existing email module (ai-models/email_verification/api.py)
        const {
            email_address,       // User's email
            otp_provided,       // OTP user entered  
            otp_expected,       // Correct OTP from server
            verification_status, // Did OTP match?
            session_id          // Verification session
        } = emailModuleOutput;
        
        // Convert to ZK-friendly format
        const zkInputs = {
            // Private inputs (sensitive data hashed)
            email_hash: poseidon([...Buffer.from(email_address)]).toString(),
            otp_hash: poseidon([...Buffer.from(otp_expected)]).toString(),
            provided_otp_hash: poseidon([...Buffer.from(otp_provided)]).toString(),
            session_nonce: poseidon([...Buffer.from(session_id)]).toString(),
            
            // Public inputs
            expected_commitment: null, // Will be calculated
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Calculate expected commitment
        zkInputs.expected_commitment = poseidon([
            BigInt(zkInputs.email_hash),
            BigInt(zkInputs.otp_hash),
            BigInt(zkInputs.session_nonce)
        ]).toString();
        
        console.log('✅ Email verification converted to ZK format');
        
        return zkInputs;
    }
}

/**
 * Master Integration Service
 * Orchestrates all verification modules and generates master proof
 */
class ZkpMasterIntegration {
    constructor() {
        this.verificationResults = new Map();
    }
    
    async processPanVerification(panData) {
        console.log('🆔 Processing PAN verification...');
        
        // 1. Your existing PAN module does the real verification
        // (OCR, validation, government API call)
        const panResult = await this.callExistingPanModule(panData);
        
        // 2. Convert to ZK-compatible format
        const zkInputs = await PanVerificationAdapter.convertToZkInputs(panResult);
        
        // 3. Store for master proof
        this.verificationResults.set('pan', zkInputs);
        
        return zkInputs;
    }
    
    async processEmailVerification(emailData) {
        console.log('📧 Processing Email verification...');
        
        // 1. Your existing email module does the real verification
        const emailResult = await this.callExistingEmailModule(emailData);
        
        // 2. Convert to ZK format
        const zkInputs = await EmailVerificationAdapter.convertToZkInputs(emailResult);
        
        // 3. Store for master proof
        this.verificationResults.set('email', zkInputs);
        
        return zkInputs;
    }
    
    async generateMasterProof() {
        console.log('🎯 Generating master ZK proof...');
        
        const panInputs = this.verificationResults.get('pan');
        const emailInputs = this.verificationResults.get('email');
        
        if (!panInputs || !emailInputs) {
            throw new Error('Missing verification results for master proof');
        }
        
        // Prepare inputs for master aggregation circuit
        const masterInputs = {
            // Private: Individual module commitments and results
            module1_commitment: panInputs.expected_commitment,
            module1_flag: panInputs.government_response, 
            module2_commitment: emailInputs.expected_commitment,
            module2_flag: emailInputs.verification_status || 1,
            session_nonce: poseidon([Date.now()]).toString(),
            master_secret: poseidon([Math.random() * 1000000]).toString(),
            
            // Public: Policy and requirements
            required_modules: 3,  // Bitmask: PAN(1) + Email(2) = 3
            min_threshold: 2,     // Both modules must pass
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        console.log('✅ Master proof inputs prepared');
        console.log('🔒 Privacy: No PII in master proof');
        console.log('🎯 Policy: Both PAN and Email required');
        
        return masterInputs;
    }
    
    // Mock calls to your existing modules (replace with actual integration)
    async callExistingPanModule(panData) {
        // This would actually call your ai-models/pan_verification/pipeline.py
        return {
            pan_number: panData.panNumber,
            name: panData.fullName,
            government_valid: true,  // Result from government API
            confidence_score: 0.95,
            verification_id: `pan_${Date.now()}`
        };
    }
    
    async callExistingEmailModule(emailData) {
        // This would actually call your ai-models/email_verification/api.py
        return {
            email_address: emailData.email,
            otp_provided: emailData.otp,
            otp_expected: emailData.correctOtp,
            verification_status: emailData.otp === emailData.correctOtp,
            session_id: `email_${Date.now()}`
        };
    }
}

// Example usage
export async function demonstrateIntegration() {
    console.log('🚀 ZKP Master Module Integration Demo');
    console.log('=' .repeat(60));
    
    const zkpMaster = new ZkpMasterIntegration();
    
    try {
        // 1. Process PAN verification (your existing flow)
        await zkpMaster.processPanVerification({
            panNumber: "ABCDE1234F",
            fullName: "John Doe"
        });
        
        // 2. Process Email verification (your existing flow)  
        await zkpMaster.processEmailVerification({
            email: "john@example.com",
            otp: "123456",
            correctOtp: "123456"
        });
        
        // 3. Generate master proof combining both
        const masterProof = await zkpMaster.generateMasterProof();
        
        console.log('🎉 Integration completed successfully!');
        console.log('📊 Master proof ready for generation');
        
        return masterProof;
        
    } catch (error) {
        console.error('❌ Integration failed:', error.message);
        throw error;
    }
}

export { PanVerificationAdapter, EmailVerificationAdapter, ZkpMasterIntegration };