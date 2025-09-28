const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Deploy the ZKP Anchor contract
  const CrocEngineZKPAnchor = await ethers.getContractFactory("CrocEngineZKPAnchor");
  
  // Constructor parameters
  const zkpServiceAddress = deployer.address; // In production, use actual ZKP service address
  const maxCommitmentsPerBlock = 100;
  const anchoringFee = ethers.utils.parseEther("0.001"); // 0.001 ETH fee
  
  const zkpAnchor = await CrocEngineZKPAnchor.deploy(
    zkpServiceAddress,
    maxCommitmentsPerBlock,
    anchoringFee
  );

  await zkpAnchor.deployed();

  console.log("CrocEngineZKPAnchor deployed to:", zkpAnchor.address);
  console.log("ZKP Service Address:", zkpServiceAddress);
  console.log("Max Commitments Per Block:", maxCommitmentsPerBlock);
  console.log("Anchoring Fee:", ethers.utils.formatEther(anchoringFee), "ETH");

  // Verify the deployment
  console.log("\nVerifying deployment...");
  const owner = await zkpAnchor.owner();
  const isPaused = await zkpAnchor.paused();
  const currentFee = await zkpAnchor.anchoringFee();
  
  console.log("Contract Owner:", owner);
  console.log("Contract Paused:", isPaused);
  console.log("Current Fee:", ethers.utils.formatEther(currentFee), "ETH");
  
  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    contractAddress: zkpAnchor.address,
    deployer: deployer.address,
    zkpServiceAddress: zkpServiceAddress,
    maxCommitmentsPerBlock: maxCommitmentsPerBlock,
    anchoringFee: anchoringFee.toString(),
    deploymentBlock: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString()
  };
  
  console.log("\nDeployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });