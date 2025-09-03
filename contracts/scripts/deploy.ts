import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", await deployer.getAddress());

  // Deploy ValuationOracle owned by deployer
  const Oracle = await ethers.getContractFactory("ValuationOracle");
  const oracle = await Oracle.deploy(await deployer.getAddress());
  await oracle.waitForDeployment();
  console.log("ValuationOracle:", await oracle.getAddress());

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy(await deployer.getAddress());
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // Deploy MockDomainNFT
  const MockDomainNFT = await ethers.getContractFactory("MockDomainNFT");
  const domainNFT = await MockDomainNFT.deploy(await deployer.getAddress());
  await domainNFT.waitForDeployment();
  console.log("MockDomainNFT:", await domainNFT.getAddress());

  // Deploy DomainBasket
  const DomainBasket = await ethers.getContractFactory("DomainBasket");
  const basket = await DomainBasket.deploy(await deployer.getAddress());
  await basket.waitForDeployment();
  console.log("DomainBasket:", await basket.getAddress());

  // Deploy DomainMarketplace
  const DomainMarketplace = await ethers.getContractFactory("DomainMarketplace");
  const marketplace = await DomainMarketplace.deploy(
    await oracle.getAddress(),
    await usdc.getAddress(),
    await deployer.getAddress()
  );
  await marketplace.waitForDeployment();
  console.log("DomainMarketplace:", await marketplace.getAddress());

  // Deploy CompetitionFactory
  const Factory = await ethers.getContractFactory("CompetitionFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  console.log("CompetitionFactory:", await factory.getAddress());

  // Example: create a competition (now -> now+7days, 0.01 ETH entry)
  const now = Math.floor(Date.now() / 1000);
  const start = now + 60; // start in 1 min
  const end = start + 7 * 24 * 3600;
  const entryFee = ethers.parseEther("0.01");
  const tx = await factory.createCompetition(start, end, entryFee, await oracle.getAddress());
  await tx.wait();
  console.log("Competition created.");

  // Mint some test domains
  console.log("Minting test domains...");
  await domainNFT.mintDomain(await deployer.getAddress(), "example.com", "https://example.com/metadata/1");
  await domainNFT.mintDomain(await deployer.getAddress(), "test.net", "https://example.com/metadata/2");
  await domainNFT.mintDomain(await deployer.getAddress(), "demo.org", "https://example.com/metadata/3");
  console.log("Test domains minted.");

  console.log("\nDeployment Summary:");
  console.log("==================");
  console.log("ValuationOracle:", await oracle.getAddress());
  console.log("MockUSDC:", await usdc.getAddress());
  console.log("MockDomainNFT:", await domainNFT.getAddress());
  console.log("DomainBasket:", await basket.getAddress());
  console.log("DomainMarketplace:", await marketplace.getAddress());
  console.log("CompetitionFactory:", await factory.getAddress());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
