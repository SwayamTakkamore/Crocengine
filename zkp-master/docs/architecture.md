# ZKP Master Module Architecture

## Overview

The ZKP Master Module implements a privacy-preserving identity verification orchestrator using zero-knowledge proofs. It aggregates verification outputs from multiple identity modules (PAN, Email, Passport, etc.) into a single master attestation without exposing personal identifiable information (PII).

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │  Module APIs     │    │  ZKP Master     │
│                 │    │                  │    │                 │
│ • Raw PII       │───▶│ • PAN Verify     │───▶│ • Proof Aggreg  │
│ • Upload Docs   │    │ • Email OTP      │    │ • Master Circuit│
│ • Submit Form   │    │ • Passport MRZ   │    │ • Commitment    │
│                 │    │ • DL QR Parse    │    │ • Nullifier     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Module Outputs   │    │ Master Proof    │
                       │                  │    │                 │
                       │ • verification   │    │ • SNARK proof   │
                       │ • commitment     │    │ • public signals│
                       │ • signature      │    │ • root commit   │
                       │ • metadata       │    │ • nullifier     │
                       └──────────────────┘    └─────────────────┘
```

## Data Flow

### Phase 1: Module Verification
1. **Input Collection**: Client collects user PII (documents, emails, phone numbers)
2. **Module Processing**: Each verification module processes its specific data type:
   - **PAN Module**: OCR extraction → format validation → government API check
   - **Email Module**: OTP generation → SendGrid delivery → OTP verification  
   - **Passport Module**: MRZ extraction → format parsing → validity checks
3. **Module Output**: Each module produces standardized output with commitment

### Phase 2: ZKP Generation  
1. **Input Validation**: Master prover validates module signatures and commitments
2. **Policy Evaluation**: Checks if provided modules satisfy verification policy
3. **Proof Generation**: Creates ZK proof that policy was satisfied without revealing PII
4. **Output**: Master proof with public commitment and nullifier

### Phase 3: Verification
1. **Local Verification**: Verifier checks proof against public verification key
2. **On-Chain Anchor** (Optional): Store commitment root on blockchain
3. **Consumer Validation**: Third parties verify proofs without accessing PII

## Component Details

### Per-Module Circuits

Each verification module has a corresponding ZK circuit:

```circom
template PanVerificationCircuit() {
    // Private inputs (never revealed)
    signal private input pan_number[10];       // PAN digits
    signal private input name_hash;            // Poseidon(full_name)
    signal private input session_nonce;       // Fresh randomness
    
    // Public inputs/outputs  
    signal input expected_commitment;         // From module output
    signal output verification_flag;          // 0 or 1
    signal output commitment;                 // Poseidon(pan_number, name_hash, session_nonce)
    
    // Verification logic
    component format_check = PanFormatValidator();
    component hash_commitment = Poseidon(3);
    
    // Validate PAN format (length, checksum, etc.)
    format_check.pan <== pan_number;
    verification_flag <== format_check.valid;
    
    // Generate commitment
    hash_commitment.inputs[0] <== pan_number;
    hash_commitment.inputs[1] <== name_hash; 
    hash_commitment.inputs[2] <== session_nonce;
    commitment <== hash_commitment.out;
    
    // Ensure commitment matches expected value
    component commitment_check = IsEqual();
    commitment_check.in[0] <== commitment;
    commitment_check.in[1] <== expected_commitment;
    commitment_check.out === 1;
}
```

### Master Aggregation Circuit

The master circuit verifies multiple module proofs:

```circom
template MasterAggregationCircuit(n_modules) {
    // Private inputs
    signal private input module_commitments[n_modules];
    signal private input module_flags[n_modules];
    signal private input session_nonce;
    
    // Public inputs  
    signal input policy_hash;                 // Hash of required modules
    signal input expected_root;               // Expected commitment root
    
    // Public outputs
    signal output verification_result;        // Overall pass/fail
    signal output commitment_root;            // Merkle root of all commitments  
    signal output nullifier;                  // Session nullifier
    
    // Policy validation
    component policy_checker = PolicyValidator(n_modules);
    policy_checker.flags <== module_flags;
    policy_checker.policy_hash <== policy_hash;
    verification_result <== policy_checker.satisfied;
    
    // Commitment aggregation
    component merkle_tree = MerkleTree(n_modules);
    merkle_tree.leaves <== module_commitments;
    commitment_root <== merkle_tree.root;
    
    // Nullifier generation
    component nullifier_gen = Poseidon(2);
    nullifier_gen.inputs[0] <== commitment_root;
    nullifier_gen.inputs[1] <== session_nonce;
    nullifier <== nullifier_gen.out;
    
    // Verify expected root matches
    component root_check = IsEqual();
    root_check.in[0] <== commitment_root;
    root_check.in[1] <== expected_root;
    root_check.out === 1;
}
```

## Security Model

### Threat Model

**Adversary Capabilities:**
- Network traffic interception (passive)
- API endpoint access and manipulation (active)  
- Compromised individual verification modules
- Access to public proofs and commitments

**Assets Protected:**
- Raw PII (PAN numbers, names, passport data, emails)
- Cross-session linkability 
- Verification policy details
- Module-specific verification logic

**Security Goals:**
- **Confidentiality**: PII never exposed in plaintext
- **Unlinkability**: Cannot correlate users across sessions
- **Integrity**: Proof manipulation should be detectable
- **Authenticity**: Module outputs must be properly signed

### Privacy Guarantees

1. **Zero PII Exposure**: All personal data hashed with Poseidon before entering circuits
2. **Commitment Hiding**: Commitments use fresh session nonces to prevent linkability  
3. **Minimal Disclosure**: Only binary verification flags and commitment roots revealed
4. **Forward Secrecy**: Session keys deleted after proof generation

### Attack Mitigations

| Attack Vector | Mitigation |
|---------------|------------|
| Module Compromise | Signature verification, key rotation, attestation checks |
| Replay Attacks | Session nonces, timestamp validation, nullifier tracking |
| Linkability | Fresh commitments per session, nullifier randomization |
| Proof Forgery | Cryptographic proof verification, trusted setup |
| Side Channels | Constant-time operations, secure deletion |

## Performance Characteristics

### Circuit Sizes (Estimated)

| Circuit | Constraints | Proving Time | Verification Time | Proof Size |
|---------|-------------|--------------|-------------------|------------|
| PAN Module | ~1,000 | 50ms | 5ms | 256 bytes |
| Email Module | ~500 | 25ms | 3ms | 256 bytes |  
| Master Aggregator (5 modules) | ~10,000 | 500ms | 10ms | 256 bytes |

### Scalability Considerations

- **Module Count**: Linear growth in master circuit size
- **Recursive Proofs**: Constant verification time regardless of module count
- **Batching**: Multiple sessions can be proven in batches for efficiency
- **Hardware Acceleration**: GPU proving for production deployments

## Implementation Trade-offs

### Approach A: Commitment Aggregation (Recommended for MVP)

**Pros:**
- Simple circuit implementation  
- Fast proving times
- Easy to extend with new modules
- Compatible with existing circom tooling

**Cons:**
- Relies on module signature trust
- Larger public input size
- Less elegant than full recursion

### Approach B: Recursive SNARKs 

**Pros:**
- Cryptographically elegant
- Constant verifier complexity
- Stronger security guarantees
- Composable proof systems

**Cons:**
- Complex implementation
- Requires specialized tooling (Halo2, Nova)
- Longer development time
- Higher computational requirements

### Recommendation

Start with **Approach A** for MVP to demonstrate core functionality, then migrate to **Approach B** for production scaling and enhanced security.

## Integration Points

### Existing Module Interfaces

The ZKP layer integrates with existing verification modules by:

1. **Wrapping Existing APIs**: Add ZKP endpoints alongside existing `/verify/*` endpoints
2. **Commitment Generation**: Modules compute Poseidon hashes of verification inputs
3. **Signature Addition**: Modules sign their outputs with attestation keys
4. **Standardized Responses**: All modules return consistent JSON schema

### Frontend Integration

```javascript
// Example: Integrated KYC flow
const kycFlow = new CrocKYCFlow({
  apiBase: 'https://api.crocengine.com',
  zkpEnabled: true
});

// Step 1: Collect PII and generate module proofs
const panResult = await kycFlow.verifyPAN(panImage, panNumber);
const emailResult = await kycFlow.verifyEmail(email, otp);

// Step 2: Generate master proof
const masterProof = await kycFlow.generateMasterProof({
  modules: [panResult, emailResult],
  policy: { required: ['pan_v1', 'email_v1'] }
});

// Step 3: Submit to third party with privacy preservation
await submitToBank({ 
  proof: masterProof.masterProof,
  commitment: masterProof.commitment,
  // No raw PII included!
});
```