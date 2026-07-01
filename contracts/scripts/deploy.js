const { ethers, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying BarterEscrow with account:", deployer.address);

  const BarterEscrow = await ethers.getContractFactory("BarterEscrow");
  const contract = await BarterEscrow.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("BarterEscrow deployed to:", address);

  const artifact = await artifacts.readArtifact("BarterEscrow");
  const outputDir = path.join(__dirname, "../../frontend/src/utils");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(outputDir, "BarterEscrow.json"),
    JSON.stringify({ address, abi: artifact.abi }, null, 2)
  );

  console.log("ABI + address written to frontend/src/utils/BarterEscrow.json");
  console.log(`\nSet VITE_CONTRACT_ADDRESS=${address} in frontend/.env`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
