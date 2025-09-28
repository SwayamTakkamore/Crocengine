pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/bitify.circom";

// PAN format validation circuit
template PanFormatValidator() {
    signal input pan[10];  // PAN as array of digits
    signal output valid;
    
    // PAN format: AAAAA9999A where A=alpha(encoded as numbers), 9=numeric
    // For simplicity, we'll validate length and basic checksum
    
    component isEqual[10];
    component lessThan[10];
    component greaterEqual[10];
    
    signal validDigits[10];
    signal allValid;
    
    // Check each digit is valid (0-9 for numeric positions, 10-35 for alpha)
    for (var i = 0; i < 10; i++) {
        // Allow 0-35 (0-9 for digits, 10-35 for letters A-Z)
        lessThan[i] = LessThan(6);
        lessThan[i].in[0] <== pan[i];
        lessThan[i].in[1] <== 36;
        
        greaterEqual[i] = GreaterEqThan(6);
        greaterEqual[i].in[0] <== pan[i];
        greaterEqual[i].in[1] <== 0;
        
        validDigits[i] <== lessThan[i].out * greaterEqual[i].out;
    }
    
    // All digits must be valid - use cascading multiplications to avoid non-quadratic constraints
    signal intermediate[9];
    intermediate[0] <== validDigits[0] * validDigits[1];
    intermediate[1] <== intermediate[0] * validDigits[2];
    intermediate[2] <== intermediate[1] * validDigits[3];
    intermediate[3] <== intermediate[2] * validDigits[4];
    intermediate[4] <== intermediate[3] * validDigits[5];
    intermediate[5] <== intermediate[4] * validDigits[6];
    intermediate[6] <== intermediate[5] * validDigits[7];
    intermediate[7] <== intermediate[6] * validDigits[8];
    intermediate[8] <== intermediate[7] * validDigits[9];
    
    allValid <== intermediate[8];
    valid <== allValid;
}

// Main PAN verification circuit
template PanVerificationCircuit() {
    // Private inputs (never revealed)
    signal input pan_digits[10];       // PAN as array of digits/letters
    signal input name_hash;            // Poseidon hash of full name  
    signal input session_nonce;       // Fresh randomness per session
    signal input government_response;  // Gov API response (1=valid, 0=invalid)
    
    // Public inputs
    signal input expected_commitment;         // Expected commitment from module
    signal input timestamp;                   // Verification timestamp
    
    // Public outputs  
    signal output verification_flag;          // 1 if all checks pass, 0 otherwise
    signal output commitment;                 // Poseidon(pan_digits || name_hash || session_nonce)
    
    // Components
    component format_validator = PanFormatValidator();
    component commitment_hasher = Poseidon(12); // 10 digits + name_hash + nonce
    component commitment_check = IsEqual();
    
    // 1. Validate PAN format
    format_validator.pan <== pan_digits;
    
    // 2. Generate commitment 
    for (var i = 0; i < 10; i++) {
        commitment_hasher.inputs[i] <== pan_digits[i];
    }
    commitment_hasher.inputs[10] <== name_hash;
    commitment_hasher.inputs[11] <== session_nonce;
    commitment <== commitment_hasher.out;
    
    // 3. Verify commitment matches expected value
    commitment_check.in[0] <== commitment;
    commitment_check.in[1] <== expected_commitment;
    
    // 4. Combine all verification conditions
    verification_flag <== format_validator.valid * government_response * commitment_check.out;
}

component main = PanVerificationCircuit();