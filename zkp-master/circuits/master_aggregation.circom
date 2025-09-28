pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";
include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/mux1.circom";

// Policy validation circuit
template PolicyValidator(n_modules) {
    signal input module_flags[n_modules];     // Verification flags from each module
    signal input required_modules[n_modules]; // 1 if module is required, 0 if optional
    signal input min_threshold;              // Minimum number of modules that must pass
    
    signal output policy_satisfied;          // 1 if policy is satisfied
    
    component isRequired[n_modules];
    component flagCheck[n_modules];
    
    signal required_passed[n_modules];
    signal total_passed;
    signal required_count;
    signal threshold_met;
    
    var sum_passed = 0;
    var sum_required = 0;
    
    // Check each module
    for (var i = 0; i < n_modules; i++) {
        // If module is required, it must pass
        isRequired[i] = IsEqual();
        isRequired[i].in[0] <== required_modules[i];
        isRequired[i].in[1] <== 1;
        
        // Required modules must have flag = 1
        flagCheck[i] = IsEqual();
        flagCheck[i].in[0] <== module_flags[i];
        flagCheck[i].in[1] <== 1;
        
        // Required module passed check
        required_passed[i] <== isRequired[i].out * flagCheck[i].out + (1 - isRequired[i].out);
        
        sum_passed += module_flags[i];
        sum_required += required_modules[i];
    }
    
    // All required modules must pass - use cascading multiplications
    signal required_intermediate[n_modules - 1];
    required_intermediate[0] <== required_passed[0] * required_passed[1];
    for (var i = 1; i < n_modules - 1; i++) {
        required_intermediate[i] <== required_intermediate[i - 1] * required_passed[i + 1];
    }
    
    signal all_required_passed;
    all_required_passed <== required_intermediate[n_modules - 2];
    
    // Check if threshold is met
    component thresholdCheck = GreaterEqThan(8);
    thresholdCheck.in[0] <== sum_passed;
    thresholdCheck.in[1] <== min_threshold;
    
    policy_satisfied <== all_required_passed * thresholdCheck.out;
}

// Merkle tree for commitment aggregation (binary tree)
template MerkleTree(n_levels) {
    signal input leaves[2**n_levels];
    signal output root;
    
    component hashers[2**n_levels - 1];
    
    // Build tree bottom-up
    for (var level = 0; level < n_levels; level++) {
        var nodes_at_level = 2**(n_levels - level - 1);
        for (var i = 0; i < nodes_at_level; i++) {
            hashers[2**level - 1 + i] = Poseidon(2);
            if (level == 0) {
                // Leaf level
                hashers[i].inputs[0] <== leaves[2*i];
                hashers[i].inputs[1] <== leaves[2*i + 1];
            } else {
                // Internal level
                var parent_idx = 2**level - 1 + i;
                var left_child = 2**(level-1) - 1 + 2*i;
                var right_child = left_child + 1;
                hashers[parent_idx].inputs[0] <== hashers[left_child].out;
                hashers[parent_idx].inputs[1] <== hashers[right_child].out;
            }
        }
    }
    
    root <== hashers[2**n_levels - 2].out; // Root is the last hasher
}

// Main master aggregation circuit
template MasterAggregationCircuit(max_modules) {
    // Private inputs
    signal input module_commitments[max_modules];  // Commitments from each module
    signal input module_flags[max_modules];        // Verification flags (0 or 1)
    signal input module_signatures[max_modules];   // Module attestation signatures
    signal input session_nonce;                   // Session randomness
    signal input master_secret;                   // Master secret for nullifier
    
    // Public inputs  
    signal input required_modules[max_modules];           // Policy: which modules are required
    signal input min_threshold;                           // Policy: minimum passing modules
    signal input policy_hash;                            // Hash of verification policy
    signal input timestamp;                              // Proof generation time
    
    // Public outputs
    signal output verification_result;                   // Overall verification result
    signal output commitment_root;                       // Merkle root of all commitments
    signal output nullifier;                            // Unique nullifier for this session
    signal output policy_satisfied;                     // Whether policy requirements met
    
    // Components
    component policy_validator = PolicyValidator(max_modules);
    component merkle_tree = MerkleTree(4); // Supports up to 16 modules (2^4)
    component nullifier_generator = Poseidon(4);
    component policy_hasher = Poseidon(max_modules + 1);
    component policy_check = IsEqual();
    
    // 1. Validate policy requirements
    policy_validator.module_flags <== module_flags;
    policy_validator.required_modules <== required_modules;
    policy_validator.min_threshold <== min_threshold;
    policy_satisfied <== policy_validator.policy_satisfied;
    
    // 2. Generate commitment root via Merkle tree
    // Pad unused module slots with zeros
    for (var i = 0; i < 16; i++) {
        if (i < max_modules) {
            merkle_tree.leaves[i] <== module_commitments[i];
        } else {
            merkle_tree.leaves[i] <== 0;
        }
    }
    commitment_root <== merkle_tree.root;
    
    // 3. Verify policy hash matches
    policy_hasher.inputs[0] <== min_threshold;
    for (var i = 0; i < max_modules; i++) {
        policy_hasher.inputs[i + 1] <== required_modules[i];
    }
    
    policy_check.in[0] <== policy_hasher.out;
    policy_check.in[1] <== policy_hash;
    
    // 4. Generate unique nullifier
    nullifier_generator.inputs[0] <== commitment_root;
    nullifier_generator.inputs[1] <== session_nonce;
    nullifier_generator.inputs[2] <== master_secret;
    nullifier_generator.inputs[3] <== timestamp;
    nullifier <== nullifier_generator.out;
    
    // 5. Final verification result
    verification_result <== policy_satisfied * policy_check.out;
}

// Instantiate with support for up to 8 modules
component main = MasterAggregationCircuit(8);