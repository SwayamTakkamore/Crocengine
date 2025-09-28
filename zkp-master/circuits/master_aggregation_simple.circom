pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

// Simple master aggregation circuit
template MasterAggregationCircuit() {
    // Private inputs - limit to small number for simplicity
    signal input module1_commitment;   // PAN module commitment
    signal input module1_flag;         // PAN verification result (0/1)
    signal input module2_commitment;   // Email module commitment  
    signal input module2_flag;         // Email verification result (0/1)
    signal input session_nonce;        // Session randomness
    signal input master_secret;        // Master secret for nullifier
    
    // Public inputs  
    signal input required_modules;     // Bitmask: which modules required (1=PAN, 2=Email, 3=both)
    signal input min_threshold;        // Minimum passing modules (1 or 2)
    signal input timestamp;            // Proof generation time
    
    // Public outputs
    signal output verification_result; // Overall verification result
    signal output commitment_root;     // Root of all commitments
    signal output nullifier;           // Unique nullifier for this session
    signal output policy_satisfied;    // Whether policy requirements met
    
    // Verify flags are binary
    component flag1Check = IsEqual();
    flag1Check.in[0] <== module1_flag * module1_flag;
    flag1Check.in[1] <== module1_flag;
    
    component flag2Check = IsEqual();
    flag2Check.in[0] <== module2_flag * module2_flag;
    flag2Check.in[1] <== module2_flag;
    
    // Count passing modules
    signal total_passed;
    total_passed <== module1_flag + module2_flag;
    
    // Check if threshold met
    component thresholdCheck = GreaterEqThan(4);
    thresholdCheck.in[0] <== total_passed;
    thresholdCheck.in[1] <== min_threshold;
    
    // Generate commitment root from module commitments
    component rootHasher = Poseidon(3);
    rootHasher.inputs[0] <== module1_commitment;
    rootHasher.inputs[1] <== module2_commitment;
    rootHasher.inputs[2] <== session_nonce;
    
    commitment_root <== rootHasher.out;
    
    // Generate unique nullifier
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== commitment_root;
    nullifierHasher.inputs[1] <== master_secret;
    nullifierHasher.inputs[2] <== timestamp;
    nullifierHasher.inputs[3] <== 99999; // Fixed salt
    
    nullifier <== nullifierHasher.out;
    
    // Simple policy check - for now just check if we meet minimum threshold
    policy_satisfied <== thresholdCheck.out;
    
    // Overall result: flags valid AND threshold met AND policy satisfied
    signal flags_valid;
    signal intermediate;
    flags_valid <== flag1Check.out * flag2Check.out;
    intermediate <== flags_valid * thresholdCheck.out;
    verification_result <== intermediate * policy_satisfied;
}

component main = MasterAggregationCircuit();