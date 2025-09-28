pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// Simple email verification circuit
template EmailVerificationCircuit() {
    // Private inputs
    signal input email_hash;         // Poseidon hash of email address
    signal input otp_hash;          // Poseidon hash of correct OTP
    signal input provided_otp_hash; // Poseidon hash of provided OTP  
    signal input session_nonce;     // Session randomness
    
    // Public inputs
    signal input expected_commitment; // Expected commitment from module
    signal input timestamp;          // Verification timestamp
    
    // Public outputs
    signal output verification_flag; // 1 if all checks pass, 0 otherwise
    signal output commitment;        // Privacy-preserving commitment
    signal output nullifier;         // Unique nullifier
    
    // Verify OTP matches
    component otpCheck = IsEqual();
    otpCheck.in[0] <== otp_hash;
    otpCheck.in[1] <== provided_otp_hash;
    
    // Generate commitment
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== email_hash;
    commitmentHasher.inputs[1] <== otp_hash;
    commitmentHasher.inputs[2] <== session_nonce;
    
    commitment <== commitmentHasher.out;
    
    // Generate nullifier
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== email_hash;
    nullifierHasher.inputs[1] <== timestamp;
    nullifierHasher.inputs[2] <== 54321; // Fixed salt for nullifier
    
    nullifier <== nullifierHasher.out;
    
    // Verify commitment matches expected
    component commitmentCheck = IsEqual();
    commitmentCheck.in[0] <== commitment;
    commitmentCheck.in[1] <== expected_commitment;
    
    // Final verification
    verification_flag <== otpCheck.out * commitmentCheck.out;
}

component main = EmailVerificationCircuit();