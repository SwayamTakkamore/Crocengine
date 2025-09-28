pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";

// Email format validation circuit (simplified)
template EmailFormatValidator() {
    signal input email_hash;    // Hash of email for privacy
    signal input domain_hash;   // Hash of domain part
    signal output valid;
    
    // For MVP, assume email is valid if hashes are non-zero
    // In production, could validate specific domain patterns
    component emailCheck = IsZero();
    component domainCheck = IsZero();
    
    emailCheck.in <== email_hash;
    domainCheck.in <== domain_hash;
    
    // Valid if both hashes are non-zero
    valid <== (1 - emailCheck.out) * (1 - domainCheck.out);
}

// OTP validation circuit
template OtpValidator() {
    signal input provided_otp[6];    // 6-digit OTP as array
    signal input expected_otp[6];    // Expected OTP from server
    signal output valid;
    
    component isEqual[6];
    signal matches[6];
    signal allMatch;
    
    // Check each digit matches
    for (var i = 0; i < 6; i++) {
        isEqual[i] = IsEqual();
        isEqual[i].in[0] <== provided_otp[i];
        isEqual[i].in[1] <== expected_otp[i];
        matches[i] <== isEqual[i].out;
    }
    
    // All digits must match - use cascading multiplications
    signal intermediate[5];
    intermediate[0] <== matches[0] * matches[1];
    intermediate[1] <== intermediate[0] * matches[2];
    intermediate[2] <== intermediate[1] * matches[3];
    intermediate[3] <== intermediate[2] * matches[4];
    intermediate[4] <== intermediate[3] * matches[5];
    
    allMatch <== intermediate[4];
    valid <== allMatch;
}

// Main email verification circuit  
template EmailVerificationCircuit() {
    // Private inputs
    signal input email_hash;          // Poseidon hash of email address
    signal input domain_hash;         // Poseidon hash of domain  
    signal input provided_otp[6];     // OTP entered by user
    signal input expected_otp[6];     // Correct OTP from server
    signal input session_nonce;      // Session randomness
    
    // Public inputs
    signal input expected_commitment;         // Expected commitment from module
    signal input timestamp;                   // Verification timestamp
    signal input otp_expiry;                 // OTP expiration time
    
    // Public outputs
    signal output verification_flag;          // Overall verification result
    signal output commitment;                 // Privacy-preserving commitment
    
    // Components
    component format_validator = EmailFormatValidator();
    component otp_validator = OtpValidator();
    component commitment_hasher = Poseidon(4);
    component commitment_check = IsEqual();
    component time_check = LessEqThan(32);
    
    // 1. Validate email format  
    format_validator.email_hash <== email_hash;
    format_validator.domain_hash <== domain_hash;
    
    // 2. Validate OTP
    otp_validator.provided_otp <== provided_otp;
    otp_validator.expected_otp <== expected_otp;
    
    // 3. Check timestamp is before expiry
    time_check.in[0] <== timestamp;
    time_check.in[1] <== otp_expiry;
    
    // 4. Generate commitment
    commitment_hasher.inputs[0] <== email_hash;
    commitment_hasher.inputs[1] <== domain_hash;
    commitment_hasher.inputs[2] <== session_nonce;
    commitment_hasher.inputs[3] <== timestamp;
    commitment <== commitment_hasher.out;
    
    // 5. Verify commitment matches expected
    commitment_check.in[0] <== commitment;
    commitment_check.in[1] <== expected_commitment;
    
    // 6. Combine all verification conditions
    verification_flag <== format_validator.valid * otp_validator.valid * time_check.out * commitment_check.out;
}

component main = EmailVerificationCircuit();