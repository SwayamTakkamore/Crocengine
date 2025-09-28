pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// Simple PAN verification circuit that actually compiles
template PanVerificationCircuit() {
    // Private inputs (PII data - never revealed)
    signal input pan_hash;            // Poseidon hash of PAN number  
    signal input name_hash;           // Poseidon hash of full name
    signal input session_nonce;       // Fresh randomness per session
    signal input government_response; // Gov API response (1=valid, 0=invalid)
    
    // Public inputs
    signal input expected_commitment; // Expected commitment from module
    signal input timestamp;           // Verification timestamp
    
    // Public outputs  
    signal output verification_flag;  // 1 if all checks pass, 0 otherwise
    signal output commitment;         // Privacy-preserving commitment
    signal output nullifier;          // Unique nullifier for this verification
    
    // Verify government response is binary (0 or 1)
    component govCheck = IsEqual();
    govCheck.in[0] <== government_response * government_response;
    govCheck.in[1] <== government_response;
    
    // Generate commitment using Poseidon hash
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== pan_hash;
    commitmentHasher.inputs[1] <== name_hash;
    commitmentHasher.inputs[2] <== session_nonce;
    
    commitment <== commitmentHasher.out;
    
    // Generate nullifier (different from commitment to prevent linkage)
    component nullifierHasher = Poseidon(3);
    nullifierHasher.inputs[0] <== pan_hash;
    nullifierHasher.inputs[1] <== timestamp;
    nullifierHasher.inputs[2] <== 12345; // Fixed salt for nullifier
    
    nullifier <== nullifierHasher.out;
    
    // Verify commitment matches expected
    component commitmentCheck = IsEqual();
    commitmentCheck.in[0] <== commitment;
    commitmentCheck.in[1] <== expected_commitment;
    
    // Final verification: government response AND commitment match
    signal intermediate;
    intermediate <== government_response * commitmentCheck.out;
    verification_flag <== intermediate * govCheck.out;
}

component main = PanVerificationCircuit();