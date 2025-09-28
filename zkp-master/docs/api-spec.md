# ZKP Master Module API Specification

## Overview

The ZKP Master Module API provides privacy-preserving identity verification orchestration through zero-knowledge proofs. It aggregates verification outputs from multiple identity modules into a single master attestation without exposing personal identifiable information (PII).

**Base URL:** `https://api.crocengine.com/zkp-master` (Production)  
**Base URL:** `http://localhost:3001` (Development)

**Version:** v1  
**Protocol:** HTTPS (Production), HTTP (Development)

## Authentication

Currently, the API uses session-based authentication with rate limiting. Future versions will support API key authentication.

### Headers
- `Content-Type: application/json`
- `X-Session-ID: <session_identifier>` (Required for proof generation)
- `Authorization: Bearer <api_key>` (Future implementation)

## Rate Limiting

- **Per IP:** 100 requests per hour
- **Per Session:** 20 requests per hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per window
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Time when the rate limit window resets

## Endpoints

### Health Check

**GET /health**

Returns the health status of the ZKP Master service.

**Response 200 OK:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-28T10:30:00.000Z",
  "service": "zkp-master",
  "version": "0.1.0"
}
```

### Get Available Circuits

**GET /api/v1/circuits**

Returns information about available ZK circuits and their capabilities.

**Response 200 OK:**
```json
{
  "circuits": [
    {
      "id": "pan_verification",
      "name": "PAN Verification",
      "maxConstraints": 5000,
      "publicInputs": 2,
      "hasVerificationKey": true
    },
    {
      "id": "email_verification", 
      "name": "Email Verification",
      "maxConstraints": 3000,
      "publicInputs": 3,
      "hasVerificationKey": true
    },
    {
      "id": "master_aggregation",
      "name": "Master Aggregation",
      "maxConstraints": 20000,
      "publicInputs": 5,
      "hasVerificationKey": true
    }
  ],
  "timestamp": "2025-09-28T10:30:00.000Z"
}
```

### Generate Master Proof

**POST /api/v1/zk/master_prove**

Generates a master zero-knowledge proof from multiple module verification outputs.

**Headers:**
- `X-Session-ID: <session_id>` (Required)

**Request Body:**
```json
{
  "session_id": "session_abc123def456",
  "modules": [
    {
      "module_id": "pan_v1",
      "verification_flag": 1,
      "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "signature": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      "timestamp": 1695900000
    },
    {
      "module_id": "email_v1",
      "verification_flag": 1, 
      "commitment": "0x2345678901bcdef02345678901bcdef02345678901bcdef02345678901bcdef0",
      "signature": "0xbcdef01234567890bcdef01234567890bcdef01234567890bcdef01234567890bcdef01234567890bcdef01234567890bcdef01234567890bcdef01234567890",
      "timestamp": 1695900030
    }
  ],
  "policy": {
    "required": ["pan_v1", "email_v1"],
    "threshold": 2,
    "optional": []
  },
  "options": {
    "anchor_on_chain": false,
    "chain_id": 1,
    "expiry_minutes": 60,
    "nullifier_seed": "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba"
  }
}
```

**Response 200 OK:**
```json
{
  "masterProof": {
    "pi_a": ["0x123...", "0x456...", "0x789..."],
    "pi_b": [["0xabc...", "0xdef..."], ["0x111...", "0x222..."], ["0x333...", "0x444..."]],
    "pi_c": ["0x555...", "0x666...", "0x777..."],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": [
    "0x8888888888888888888888888888888888888888888888888888888888888888",
    "0x9999999999999999999999999999999999999999999999999999999999999999"
  ],
  "commitment": "0x1111111111111111111111111111111111111111111111111111111111111111",
  "nullifier": "0x2222222222222222222222222222222222222222222222222222222222222222",
  "session_id": "session_abc123def456",
  "timestamp": 1695900060,
  "expiry": 1695903660,
  "policy_hash": "0x3333333333333333333333333333333333333333333333333333333333333333",
  "anchorTx": null,
  "verification": {
    "verificationKey": "http://localhost:3001/api/v1/zk/verification-key/master_aggregation",
    "circuitId": "master_aggregation",
    "modulesSatisfied": ["pan_v1", "email_v1"],
    "policysSatisfied": true
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Invalid request format",
  "details": [
    {
      "path": "/modules/0/commitment", 
      "message": "Invalid commitment format",
      "value": "invalid_commitment"
    }
  ]
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3600
}
```

### Verify Proof

**POST /api/v1/zk/verify**

Verifies a zero-knowledge proof locally using the public verification key.

**Request Body:**
```json
{
  "proof": {
    "pi_a": ["0x123...", "0x456...", "0x789..."],
    "pi_b": [["0xabc...", "0xdef..."], ["0x111...", "0x222..."], ["0x333...", "0x444..."]],
    "pi_c": ["0x555...", "0x666...", "0x777..."],
    "protocol": "groth16",
    "curve": "bn128"
  },
  "publicSignals": [
    "0x8888888888888888888888888888888888888888888888888888888888888888",
    "0x9999999999999999999999999999999999999999999999999999999999999999"
  ],
  "verificationKey": {
    // Optional - uses default if not provided
  }
}
```

**Response 200 OK:**
```json
{
  "valid": true,
  "timestamp": "2025-09-28T10:30:00.000Z"
}
```

### Get Verification Key

**GET /api/v1/zk/verification-key/{circuitId}**

Retrieves the public verification key for a specific circuit.

**Parameters:**
- `circuitId` (path): Circuit identifier (e.g., "master_aggregation")

**Response 200 OK:**
```json
{
  "circuitId": "master_aggregation",
  "verificationKey": {
    "protocol": "groth16",
    "curve": "bn128",
    "nPublic": 5,
    "vk_alpha_1": ["0x...", "0x...", "0x..."],
    "vk_beta_2": [["0x...", "0x..."], ["0x...", "0x..."], ["0x...", "0x..."]],
    "vk_gamma_2": [["0x...", "0x..."], ["0x...", "0x..."], ["0x...", "0x..."]],
    "vk_delta_2": [["0x...", "0x..."], ["0x...", "0x..."], ["0x...", "0x..."]],
    "IC": [
      ["0x...", "0x...", "0x..."],
      ["0x...", "0x...", "0x..."]
    ]
  },
  "timestamp": "2025-09-28T10:30:00.000Z"
}
```

### Generate Commitment

**POST /api/v1/zk/commitment**

Utility endpoint for generating Poseidon hash commitments (used by verification modules).

**Request Body:**
```json
{
  "data": ["input1", "input2", "input3"],
  "nonce": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}
```

**Response 200 OK:**
```json
{
  "commitment": "0x4444444444444444444444444444444444444444444444444444444444444444",
  "timestamp": "2025-09-28T10:30:00.000Z"
}
```

## Data Models

### Module Output Schema

```json
{
  "module_id": "string (pattern: ^[a-z_]+_v[0-9]+$)",
  "verification_flag": "integer (0 or 1)",
  "commitment": "string (pattern: ^0x[0-9a-fA-F]{64}$)",
  "signature": "string (pattern: ^0x[0-9a-fA-F]{128,140}$)",
  "timestamp": "integer (unix timestamp)",
  "proof": "object (optional ZK proof)",
  "publicSignals": "array of strings (optional)",
  "metadata": {
    "score": "number (0.0 to 1.0)",
    "risk_flags": "array of strings"
  }
}
```

### Master Proof Policy Schema

```json
{
  "required": "array of strings (module IDs that must pass)",
  "threshold": "integer (minimum number of passing modules)",
  "optional": "array of strings (optional module IDs)",
  "weights": "object (per-module weights for threshold)"
}
```

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Invalid request format | Request body validation failed |
| 401 | Unauthorized | Missing or invalid authentication |
| 404 | Circuit not found | Requested circuit doesn't exist |
| 429 | Rate limit exceeded | Too many requests from client |
| 500 | Proof generation failed | Internal error during proof generation |
| 503 | Service unavailable | ZKP service temporarily unavailable |

## Security Considerations

### Request Validation
- All inputs are validated against JSON schemas
- Module signatures are cryptographically verified
- Timestamp freshness is enforced (max 1 hour old)
- Commitment formats are strictly validated

### Privacy Protection
- Raw PII is never stored or logged
- Session-based nullifiers prevent replay attacks
- Secure deletion is performed after proof generation
- Rate limiting prevents enumeration attacks

### Proof Integrity
- All proofs use Groth16 protocol on BN254 curve
- Verification keys are served over authenticated channels
- Public signals are minimized to essential commitments only
- Circuit constraints prevent malicious proof generation

## Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

async function generateMasterProof(modules, policy) {
  const response = await axios.post('http://localhost:3001/api/v1/zk/master_prove', {
    session_id: 'my_session_' + Date.now(),
    modules,
    policy
  }, {
    headers: {
      'Content-Type': 'application/json',
      'X-Session-ID': 'my_session_' + Date.now()
    }
  });
  
  return response.data;
}
```

### Python
```python
import requests
import json

def generate_master_proof(modules, policy, session_id):
    url = "http://localhost:3001/api/v1/zk/master_prove"
    headers = {
        "Content-Type": "application/json",
        "X-Session-ID": session_id
    }
    data = {
        "session_id": session_id,
        "modules": modules,
        "policy": policy
    }
    
    response = requests.post(url, json=data, headers=headers)
    return response.json()
```

### cURL
```bash
curl -X POST http://localhost:3001/api/v1/zk/master_prove \
  -H "Content-Type: application/json" \
  -H "X-Session-ID: session_123" \
  -d '{
    "session_id": "session_123",
    "modules": [...],
    "policy": {...}
  }'
```

## Changelog

### v0.1.0 (Current)
- Initial implementation with Groth16 proofs
- Support for PAN and Email verification modules  
- Basic master aggregation circuit
- REST API with rate limiting
- Local proof verification

### Future Versions
- Recursive SNARK support for better scalability
- Additional verification modules (Passport, DL, Video KYC)
- On-chain verification contracts
- Advanced privacy features (differential privacy, MPC)
- GraphQL API
- WebSocket support for real-time proof generation