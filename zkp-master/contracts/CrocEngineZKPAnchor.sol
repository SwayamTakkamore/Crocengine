// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CrocEngineZKPAnchor
 * @dev Smart contract for anchoring ZKP Master Module commitment proofs on-chain
 * @notice This contract stores only commitment roots, never PII or sensitive data
 */
contract CrocEngineZKPAnchor is Ownable, ReentrancyGuard, Pausable {
    
    // Events
    event CommitmentAnchored(
        bytes32 indexed commitmentRoot,
        bytes32 indexed nullifier,
        uint256 indexed blockNumber,
        address prover,
        uint256 timestamp
    );
    
    event ProverAuthorized(address indexed prover, bool authorized);
    event AnchorFeeUpdated(uint256 oldFee, uint256 newFee);
    
    // Structs
    struct Anchor {
        bytes32 commitmentRoot;      // Root of Merkle tree of module commitments
        bytes32 nullifier;           // Unique nullifier to prevent double-anchoring
        address prover;              // Address of the prover service
        uint256 blockNumber;         // Block number when anchored
        uint256 timestamp;           // Timestamp when anchored
        bool exists;                 // Whether this anchor exists
    }
    
    // State variables
    mapping(bytes32 => Anchor) public anchors;                    // commitmentRoot => Anchor
    mapping(bytes32 => bool) public usedNullifiers;              // nullifier => used
    mapping(address => bool) public authorizedProvers;           // prover => authorized
    
    uint256 public anchorFee = 0.001 ether;                      // Fee for anchoring
    uint256 public totalAnchors = 0;                             // Total number of anchors
    uint256 public maxCommitmentsPerBlock = 100;                 // Rate limiting
    uint256 public currentBlockCommitments = 0;                  // Current block counter
    uint256 public lastBlockNumber = 0;                          // Last processed block
    
    // Constants
    uint256 public constant MAX_ANCHOR_FEE = 0.01 ether;         // Maximum fee cap
    uint256 public constant NULLIFIER_EXPIRY = 365 days;        // Nullifier validity period
    
    // Modifiers
    modifier onlyAuthorizedProver() {
        require(authorizedProvers[msg.sender], "CrocZKPAnchor: Unauthorized prover");
        _;
    }
    
    modifier validCommitmentRoot(bytes32 _commitmentRoot) {
        require(_commitmentRoot != bytes32(0), "CrocZKPAnchor: Invalid commitment root");
        _;
    }
    
    modifier validNullifier(bytes32 _nullifier) {
        require(_nullifier != bytes32(0), "CrocZKPAnchor: Invalid nullifier");
        require(!usedNullifiers[_nullifier], "CrocZKPAnchor: Nullifier already used");
        _;
    }
    
    constructor() {
        authorizedProvers[msg.sender] = true;
        emit ProverAuthorized(msg.sender, true);
    }
    
    /**
     * @dev Anchor a commitment root on-chain
     * @param _commitmentRoot Root hash of all module commitments
     * @param _nullifier Unique nullifier to prevent replay attacks
     * @notice Only authorized provers can call this function
     */
    function anchorCommitment(
        bytes32 _commitmentRoot,
        bytes32 _nullifier
    ) 
        external
        payable
        onlyAuthorizedProver
        validCommitmentRoot(_commitmentRoot)
        validNullifier(_nullifier)
        whenNotPaused
        nonReentrant
    {
        // Check fee
        require(msg.value >= anchorFee, "CrocZKPAnchor: Insufficient fee");
        
        // Rate limiting per block
        if (block.number != lastBlockNumber) {
            lastBlockNumber = block.number;
            currentBlockCommitments = 0;
        }
        require(currentBlockCommitments < maxCommitmentsPerBlock, "CrocZKPAnchor: Block rate limit exceeded");
        currentBlockCommitments++;
        
        // Prevent double-anchoring same commitment
        require(!anchors[_commitmentRoot].exists, "CrocZKPAnchor: Commitment already anchored");
        
        // Store anchor
        anchors[_commitmentRoot] = Anchor({
            commitmentRoot: _commitmentRoot,
            nullifier: _nullifier,
            prover: msg.sender,
            blockNumber: block.number,
            timestamp: block.timestamp,
            exists: true
        });
        
        // Mark nullifier as used
        usedNullifiers[_nullifier] = true;
        
        // Update counters
        totalAnchors++;
        
        // Emit event
        emit CommitmentAnchored(
            _commitmentRoot,
            _nullifier,
            block.number,
            msg.sender,
            block.timestamp
        );
        
        // Refund excess payment
        if (msg.value > anchorFee) {
            payable(msg.sender).transfer(msg.value - anchorFee);
        }
    }
    
    /**
     * @dev Verify if a commitment root has been anchored
     * @param _commitmentRoot The commitment root to verify
     * @return exists Whether the commitment is anchored
     * @return blockNumber Block number when anchored
     * @return timestamp Timestamp when anchored
     */
    function verifyAnchor(bytes32 _commitmentRoot) 
        external 
        view 
        returns (bool exists, uint256 blockNumber, uint256 timestamp) 
    {
        Anchor memory anchor = anchors[_commitmentRoot];
        return (anchor.exists, anchor.blockNumber, anchor.timestamp);
    }
    
    /**
     * @dev Get full anchor details
     * @param _commitmentRoot The commitment root to query
     * @return anchor Full anchor struct
     */
    function getAnchor(bytes32 _commitmentRoot) 
        external 
        view 
        returns (Anchor memory anchor) 
    {
        return anchors[_commitmentRoot];
    }
    
    /**
     * @dev Check if a nullifier has been used
     * @param _nullifier The nullifier to check
     * @return used Whether the nullifier has been used
     */
    function isNullifierUsed(bytes32 _nullifier) 
        external 
        view 
        returns (bool used) 
    {
        return usedNullifiers[_nullifier];
    }
    
    /**
     * @dev Batch verification of multiple commitment roots
     * @param _commitmentRoots Array of commitment roots to verify
     * @return results Array of verification results
     */
    function batchVerifyAnchors(bytes32[] calldata _commitmentRoots)
        external
        view
        returns (bool[] memory results)
    {
        results = new bool[](_commitmentRoots.length);
        for (uint256 i = 0; i < _commitmentRoots.length; i++) {
            results[i] = anchors[_commitmentRoots[i]].exists;
        }
        return results;
    }
    
    // Admin functions
    
    /**
     * @dev Authorize or deauthorize a prover address
     * @param _prover The prover address
     * @param _authorized Whether to authorize or deauthorize
     */
    function setProverAuthorization(address _prover, bool _authorized) 
        external 
        onlyOwner 
    {
        require(_prover != address(0), "CrocZKPAnchor: Invalid prover address");
        authorizedProvers[_prover] = _authorized;
        emit ProverAuthorized(_prover, _authorized);
    }
    
    /**
     * @dev Update the anchor fee
     * @param _newFee The new fee amount
     */
    function setAnchorFee(uint256 _newFee) 
        external 
        onlyOwner 
    {
        require(_newFee <= MAX_ANCHOR_FEE, "CrocZKPAnchor: Fee too high");
        uint256 oldFee = anchorFee;
        anchorFee = _newFee;
        emit AnchorFeeUpdated(oldFee, _newFee);
    }
    
    /**
     * @dev Update rate limiting parameter
     * @param _maxCommitmentsPerBlock New maximum commitments per block
     */
    function setMaxCommitmentsPerBlock(uint256 _maxCommitmentsPerBlock) 
        external 
        onlyOwner 
    {
        require(_maxCommitmentsPerBlock > 0 && _maxCommitmentsPerBlock <= 1000, 
                "CrocZKPAnchor: Invalid rate limit");
        maxCommitmentsPerBlock = _maxCommitmentsPerBlock;
    }
    
    /**
     * @dev Pause the contract (emergency stop)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw accumulated fees
     * @param _to Address to send fees to
     */
    function withdrawFees(address payable _to) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(_to != address(0), "CrocZKPAnchor: Invalid withdrawal address");
        uint256 balance = address(this).balance;
        require(balance > 0, "CrocZKPAnchor: No fees to withdraw");
        
        _to.transfer(balance);
    }
    
    /**
     * @dev Clean up expired nullifiers (governance function)
     * @param _nullifiers Array of expired nullifiers to clean
     */
    function cleanupExpiredNullifiers(bytes32[] calldata _nullifiers) 
        external 
        onlyOwner 
    {
        for (uint256 i = 0; i < _nullifiers.length; i++) {
            // In a real implementation, you'd check if nullifier is actually expired
            // For simplicity, we'll allow owner to clean any nullifier
            delete usedNullifiers[_nullifiers[i]];
        }
    }
    
    // View functions for statistics
    
    /**
     * @dev Get contract statistics
     * @return totalAnchorsCount Total number of anchors
     * @return currentFee Current anchor fee
     * @return contractBalance Contract balance
     */
    function getStats() 
        external 
        view 
        returns (uint256 totalAnchorsCount, uint256 currentFee, uint256 contractBalance) 
    {
        return (totalAnchors, anchorFee, address(this).balance);
    }
    
    /**
     * @dev Get anchors created in a specific block range
     * @param _fromBlock Starting block number
     * @param _toBlock Ending block number
     * @return count Number of anchors in the range
     */
    function getAnchorCountInRange(uint256 _fromBlock, uint256 _toBlock) 
        external 
        view 
        returns (uint256 count) 
    {
        // This is a simplified implementation
        // In practice, you'd use events or maintain block-indexed mappings
        require(_fromBlock <= _toBlock, "CrocZKPAnchor: Invalid block range");
        
        // For MVP, return 0 - would need event indexing for efficient implementation
        return 0;
    }
    
    /**
     * @dev Emergency function to recover stuck tokens
     * @dev This contract should only handle ETH, but adding as safety measure
     */
    function emergencyTokenRecovery(address _token, address _to, uint256 _amount) 
        external 
        onlyOwner 
    {
        require(_token != address(0) && _to != address(0), "CrocZKPAnchor: Invalid addresses");
        
        // Use low-level call to handle any ERC20 token
        (bool success, ) = _token.call(
            abi.encodeWithSignature("transfer(address,uint256)", _to, _amount)
        );
        require(success, "CrocZKPAnchor: Token transfer failed");
    }
}