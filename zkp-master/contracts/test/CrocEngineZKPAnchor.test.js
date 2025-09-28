const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrocEngineZKPAnchor", function () {
  let zkpAnchor;
  let owner;
  let zkpService;
  let user1;
  let user2;
  let addrs;

  const maxCommitmentsPerBlock = 10;
  const anchoringFee = ethers.utils.parseEther("0.001");

  beforeEach(async function () {
    [owner, zkpService, user1, user2, ...addrs] = await ethers.getSigners();

    const CrocEngineZKPAnchor = await ethers.getContractFactory("CrocEngineZKPAnchor");
    zkpAnchor = await CrocEngineZKPAnchor.deploy(
      zkpService.address,
      maxCommitmentsPerBlock,
      anchoringFee
    );
    await zkpAnchor.deployed();

    // Authorize the zkp service
    await zkpAnchor.authorizeProver(zkpService.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await zkpAnchor.owner()).to.equal(owner.address);
    });

    it("Should set the correct initial parameters", async function () {
      expect(await zkpAnchor.maxCommitmentsPerBlock()).to.equal(maxCommitmentsPerBlock);
      expect(await zkpAnchor.anchoringFee()).to.equal(anchoringFee);
      expect(await zkpAnchor.paused()).to.equal(false);
    });

    it("Should authorize the ZKP service", async function () {
      expect(await zkpAnchor.authorizedProvers(zkpService.address)).to.equal(true);
    });
  });

  describe("Commitment Anchoring", function () {
    it("Should anchor a commitment successfully", async function () {
      const commitmentRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      await expect(
        zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        )
      ).to.emit(zkpAnchor, "CommitmentAnchored")
        .withArgs(commitmentRoot, nullifierHash, await ethers.provider.getBlockNumber() + 1);

      // Verify the commitment is stored
      const blockNumber = await ethers.provider.getBlockNumber();
      expect(await zkpAnchor.commitments(blockNumber)).to.equal(commitmentRoot);
      expect(await zkpAnchor.isNullifierUsed(nullifierHash)).to.equal(true);
    });

    it("Should reject unauthorized prover", async function () {
      const commitmentRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      await expect(
        zkpAnchor.connect(user1).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        )
      ).to.be.revertedWith("Unauthorized prover");
    });

    it("Should reject insufficient fee", async function () {
      const commitmentRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      await expect(
        zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: ethers.utils.parseEther("0.0005") }
        )
      ).to.be.revertedWith("Insufficient fee");
    });

    it("Should reject duplicate nullifier", async function () {
      const commitmentRoot1 = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const commitmentRoot2 = "0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      // First anchoring should succeed
      await zkpAnchor.connect(zkpService).anchorCommitment(
        commitmentRoot1,
        nullifierHash,
        { value: anchoringFee }
      );

      // Second anchoring with same nullifier should fail
      await expect(
        zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot2,
          nullifierHash,
          { value: anchoringFee }
        )
      ).to.be.revertedWith("Nullifier already used");
    });

    it("Should enforce rate limiting", async function () {
      // Fill up the block limit
      for (let i = 0; i < maxCommitmentsPerBlock; i++) {
        const commitmentRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`commitment${i}`));
        const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`nullifier${i}`));
        
        await zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        );
      }

      // Next commitment should fail
      const commitmentRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("overflow"));
      const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("overflow_nullifier"));

      await expect(
        zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        )
      ).to.be.revertedWith("Block commitment limit reached");
    });
  });

  describe("Batch Operations", function () {
    it("Should verify multiple commitments in batch", async function () {
      const commitments = [];
      const nullifiers = [];
      
      // Anchor some commitments
      for (let i = 0; i < 3; i++) {
        const commitmentRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`commitment${i}`));
        const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`nullifier${i}`));
        
        commitments.push(commitmentRoot);
        nullifiers.push(nullifierHash);
        
        await zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        );
      }

      // Get current block number
      const blockNumber = await ethers.provider.getBlockNumber();
      const blocks = [blockNumber - 2, blockNumber - 1, blockNumber];

      // Verify batch
      const results = await zkpAnchor.verifyBatch(blocks, commitments, nullifiers);
      
      expect(results.length).to.equal(3);
      expect(results[0]).to.equal(true);
      expect(results[1]).to.equal(true);
      expect(results[2]).to.equal(true);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to authorize provers", async function () {
      await zkpAnchor.connect(owner).authorizeProver(user1.address);
      expect(await zkpAnchor.authorizedProvers(user1.address)).to.equal(true);
    });

    it("Should allow owner to revoke provers", async function () {
      await zkpAnchor.connect(owner).authorizeProver(user1.address);
      await zkpAnchor.connect(owner).revokeProver(user1.address);
      expect(await zkpAnchor.authorizedProvers(user1.address)).to.equal(false);
    });

    it("Should reject non-owner authorization", async function () {
      await expect(
        zkpAnchor.connect(user1).authorizeProver(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow owner to pause and unpause", async function () {
      await zkpAnchor.connect(owner).pause();
      expect(await zkpAnchor.paused()).to.equal(true);

      await zkpAnchor.connect(owner).unpause();
      expect(await zkpAnchor.paused()).to.equal(false);
    });

    it("Should reject operations when paused", async function () {
      await zkpAnchor.connect(owner).pause();

      const commitmentRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      await expect(
        zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        )
      ).to.be.revertedWith("Pausable: paused");
    });
  });

  describe("Fee Management", function () {
    it("Should allow owner to update anchoring fee", async function () {
      const newFee = ethers.utils.parseEther("0.002");
      await zkpAnchor.connect(owner).setAnchoringFee(newFee);
      expect(await zkpAnchor.anchoringFee()).to.equal(newFee);
    });

    it("Should allow owner to withdraw fees", async function () {
      // Anchor some commitments to generate fees
      const commitmentRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
      const nullifierHash = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

      await zkpAnchor.connect(zkpService).anchorCommitment(
        commitmentRoot,
        nullifierHash,
        { value: anchoringFee }
      );

      const initialBalance = await ethers.provider.getBalance(owner.address);
      await zkpAnchor.connect(owner).withdrawFees();
      const finalBalance = await ethers.provider.getBalance(owner.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("Statistics", function () {
    it("Should track commitment statistics", async function () {
      const initialStats = await zkpAnchor.getCommitmentStats();
      expect(initialStats.totalCommitments).to.equal(0);

      // Anchor some commitments
      for (let i = 0; i < 3; i++) {
        const commitmentRoot = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`commitment${i}`));
        const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`nullifier${i}`));
        
        await zkpAnchor.connect(zkpService).anchorCommitment(
          commitmentRoot,
          nullifierHash,
          { value: anchoringFee }
        );
      }

      const finalStats = await zkpAnchor.getCommitmentStats();
      expect(finalStats.totalCommitments).to.equal(3);
      expect(finalStats.totalFees).to.equal(anchoringFee.mul(3));
    });
  });
});