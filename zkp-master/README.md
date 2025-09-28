# ZKP Master Module - Privacy-Preserving Identity Verification Orchestrator

## Overview

The ZKP Master Module is a zero-knowledge-proof orchestration layer that aggregates verification outputs from multiple identity verification modules (PAN, Email, Passport, etc.) into a single privacy-preserving master attestation.

## Architecture

```
Client Input → Per-Module Verification → Module Proofs → Master Aggregator → Master Proof
     ↓                    ↓                    ↓             ↓              ↓
[Raw PII] →     [OCR/OTP/MRZ Processing] → [Commitments] → [ZK Circuits] → [Public Signals]
```

### Key Components

1. **Per-Module ZKP Circuits**: Generate proofs for individual verification modules
2. **Master Aggregation Circuit**: Combines multiple module proofs into single attestation  
3. **Prover Service**: REST API for proof generation and verification
4. **Commitment Scheme**: Privacy-preserving commitments using Poseidon hashing
5. **Optional On-Chain Anchor**: Store commitment roots on blockchain

### Privacy Guarantees

- **Zero PII Storage**: Raw personal data never persisted unencrypted
- **Unlinkability**: Session-based nullifiers prevent cross-session correlation
- **Minimal Disclosure**: Only verification flags and commitments exposed
- **Secure Deletion**: Ephemeral data wiped after proof generation

## Quick Start

```bash
# Install dependencies
cd zkp-master
npm install

# Generate circuits and keys
npm run circuit:compile
npm run circuit:setup

# Start prover service
npm run serve

# Test end-to-end flow
npm test
```

## API Usage

```javascript
// Generate master proof
const response = await fetch('/api/v1/zk/master_prove', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: "session_123",
    modules: [
      {
        module_id: "pan_v1",
        verification_flag: 1,
        commitment: "0x1a2b3c...",
        signature: "0x4d5e6f..."
      },
      {
        module_id: "email_v1", 
        verification_flag: 1,
        commitment: "0x7g8h9i...",
        signature: "0xjklmno..."
      }
    ],
    policy: {
      required: ["pan_v1", "email_v1"],
      threshold: 2
    }
  })
});

const { masterProof, publicSignals, commitment } = await response.json();
```

## Security Model

- **Threat Model**: Protects against module compromise, replay attacks, linkability
- **Trust Assumptions**: Relies on circuit correctness and proving key secrecy
- **Attack Surface**: API endpoints, key management, circuit implementations

See [docs/](./docs/) for detailed specifications, threat model, and implementation guides.