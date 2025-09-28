# ZKP Master Module - Smart Contract Integration

This directory contains the smart contract component for the ZKP Master Module, providing optional on-chain anchoring of commitment roots for enhanced transparency and verifiability.

## Overview

The `CrocEngineZKPAnchor` contract enables the ZKP Master Module to anchor commitment roots on-chain while maintaining complete privacy of the underlying identity data. Only cryptographic hashes are stored, ensuring no PII is exposed.

## Features

- **Commitment Anchoring**: Store commitment roots on-chain for public verifiability
- **Nullifier Tracking**: Prevent double-spending and replay attacks
- **Access Control**: Authorize specific provers for security
- **Rate Limiting**: Prevent spam and DoS attacks
- **Fee Management**: Configurable anchoring fees with withdrawal
- **Emergency Controls**: Pause/unpause functionality for emergencies
- **Batch Operations**: Efficient verification of multiple commitments
- **Statistics Tracking**: Monitor usage and generate reports

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ZKP Service   │───▶│  Smart Contract │───▶│   Blockchain    │
│                 │    │                 │    │                 │
│ • Generate ZKP  │    │ • Store Hash    │    │ • Public Ledger │
│ • Create Commit │    │ • Verify Proof  │    │ • Immutable     │
│ • Send TX       │    │ • Track Stats   │    │ • Transparent   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd contracts
npm install
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Run Tests

```bash
npm test
```

### 4. Deploy Locally

```bash
# Start local blockchain
npm run node

# In another terminal, deploy
npm run deploy:local
```

### 5. Deploy to Testnet

```bash
# Set environment variables
export GOERLI_URL="https://goerli.infura.io/v3/YOUR_PROJECT_ID"
export PRIVATE_KEY="your_private_key"
export ETHERSCAN_API_KEY="your_etherscan_key"

# Deploy to Goerli
npm run deploy:testnet

# Verify on Etherscan
npm run verify -- --network goerli DEPLOYED_CONTRACT_ADDRESS
```

## Contract Interface

### Core Functions

#### `anchorCommitment(bytes32 commitmentRoot, bytes32 nullifierHash)`
Anchors a commitment root on-chain with the specified nullifier.

**Parameters:**
- `commitmentRoot`: The root hash of the commitment tree
- `nullifierHash`: Unique nullifier to prevent double-spending

**Requirements:**
- Caller must be authorized prover
- Sufficient fee must be paid
- Nullifier must not be used before
- Rate limit not exceeded

#### `verifyAnchor(uint256 blockNumber, bytes32 commitmentRoot, bytes32 nullifierHash)`
Verifies that a commitment was anchored at the specified block.

**Returns:** `bool` - True if the commitment is valid

#### `verifyBatch(uint256[] blocks, bytes32[] commitments, bytes32[] nullifiers)`
Batch verification of multiple commitments for efficiency.

**Returns:** `bool[]` - Array of verification results

### Admin Functions

#### `authorizeProver(address prover)`
Authorize an address to anchor commitments.

#### `revokeProver(address prover)`
Revoke authorization from an address.

#### `setAnchoringFee(uint256 newFee)`
Update the fee required for anchoring.

#### `setMaxCommitmentsPerBlock(uint256 newMax)`
Update the rate limit for commitments per block.

#### `pause()` / `unpause()`
Emergency controls to halt operations.

#### `withdrawFees()`
Withdraw collected fees to the owner.

### View Functions

#### `getCommitmentStats()`
Returns usage statistics including total commitments and fees.

#### `isNullifierUsed(bytes32 nullifier)`
Check if a nullifier has been used.

#### `authorizedProvers(address prover)`
Check if an address is authorized to anchor commitments.

## Security Features

### Access Control
- **Owner**: Can manage provers, fees, and emergency controls
- **Authorized Provers**: Can anchor commitments (typically ZKP service)
- **Public**: Can verify anchored commitments

### Rate Limiting
- Maximum commitments per block configurable
- Prevents spam and DoS attacks
- Adjustable by contract owner

### Fee Management
- Configurable anchoring fee
- Prevents spam through economic incentive
- Owner can withdraw collected fees

### Emergency Controls
- Pause functionality for emergencies
- Owner can halt all operations
- Resume operations when safe

### Nullifier Tracking
- Prevents replay attacks
- Each commitment uses unique nullifier
- Permanent record prevents double-spending

## Gas Costs

Approximate gas costs for common operations:

| Operation | Gas Cost |
|-----------|----------|
| Anchor Commitment | ~70,000 |
| Verify Anchor | ~25,000 |
| Batch Verify (5) | ~45,000 |
| Authorize Prover | ~45,000 |
| Set Fee | ~30,000 |

## Integration Example

```javascript
const { ethers } = require('ethers');

// Connect to contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

// Anchor a commitment
async function anchorCommitment(commitmentRoot, nullifierHash) {
  const fee = await contract.anchoringFee();
  
  const tx = await contract.anchorCommitment(
    commitmentRoot,
    nullifierHash,
    { value: fee }
  );
  
  const receipt = await tx.wait();
  console.log('Commitment anchored at block:', receipt.blockNumber);
}

// Verify a commitment
async function verifyCommitment(blockNumber, commitmentRoot, nullifierHash) {
  const isValid = await contract.verifyAnchor(
    blockNumber,
    commitmentRoot,
    nullifierHash
  );
  
  return isValid;
}
```

## Events

The contract emits several events for monitoring and indexing:

### `CommitmentAnchored(bytes32 indexed commitmentRoot, bytes32 indexed nullifierHash, uint256 indexed blockNumber)`
Emitted when a commitment is successfully anchored.

### `ProverAuthorized(address indexed prover)`
Emitted when a new prover is authorized.

### `ProverRevoked(address indexed prover)`
Emitted when a prover's authorization is revoked.

### `AnchoringFeeUpdated(uint256 oldFee, uint256 newFee)`
Emitted when the anchoring fee is changed.

### `FeesWithdrawn(address indexed owner, uint256 amount)`
Emitted when fees are withdrawn by the owner.

## Monitoring and Analytics

The contract provides comprehensive statistics and events for monitoring:

```javascript
// Get usage statistics
const stats = await contract.getCommitmentStats();
console.log('Total Commitments:', stats.totalCommitments.toString());
console.log('Total Fees Collected:', ethers.utils.formatEther(stats.totalFees));
console.log('Unique Provers:', stats.uniqueProvers.toString());

// Listen to events
contract.on('CommitmentAnchored', (commitmentRoot, nullifierHash, blockNumber) => {
  console.log('New commitment anchored:', {
    commitmentRoot,
    nullifierHash,
    blockNumber: blockNumber.toString()
  });
});
```

## Security Considerations

1. **Private Key Management**: Secure the deployer and owner private keys
2. **Prover Authorization**: Only authorize trusted ZKP services
3. **Fee Configuration**: Set appropriate fees to prevent spam
4. **Rate Limiting**: Monitor and adjust commitment limits
5. **Emergency Response**: Have procedures for pause/unpause
6. **Upgrade Path**: Consider proxy patterns for upgradability

## Deployment Checklist

- [ ] Test thoroughly on local network
- [ ] Deploy and verify on testnet
- [ ] Configure initial parameters
- [ ] Authorize ZKP service address
- [ ] Set appropriate anchoring fee
- [ ] Configure rate limits
- [ ] Test emergency controls
- [ ] Monitor initial usage
- [ ] Document deployment details

## Support

For issues or questions about the smart contract integration:

1. Check the test suite for usage examples
2. Review the contract documentation
3. Test on local network first
4. Use testnet for integration testing
5. Monitor gas costs and optimize if needed

The smart contract complements the off-chain ZKP Master Module by providing optional transparency and public verifiability while maintaining complete privacy of identity data.