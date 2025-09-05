import { ethers } from "hardhat";

// Demo script: finalize a competition payout using CompetitionSettlement
// Prints the tx hash to stdout for backend verification via /api/v1/settlement/competitions/{id}/verify
async function main() {
  const [owner, r1, r2] = await ethers.getSigners();

  // Addresses can be overridden via env for re-use
  const USDC_ADDR = process.env.USDC_ADDR;
  const SETTLE_ADDR = process.env.SETTLE_ADDR;

  let usdc;
  if (!USDC_ADDR) {
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.connect(owner).deploy(await owner.getAddress());
    await usdc.waitForDeployment();
  } else {
    usdc = await ethers.getContractAt("MockUSDC", USDC_ADDR);
  }

  let settlement;
  if (!SETTLE_ADDR) {
    const Settlement = await ethers.getContractFactory("CompetitionSettlement");
    settlement = await Settlement.connect(owner).deploy(await usdc.getAddress());
    await settlement.waitForDeployment();
  } else {
    settlement = await ethers.getContractAt("CompetitionSettlement", SETTLE_ADDR);
  }

  // Fund owner with USDC and approve
  await (await usdc.connect(owner).mint(await owner.getAddress(), ethers.parseUnits("1000", 6))).wait();
  await (await usdc.connect(owner).approve(await settlement.getAddress(), ethers.parseUnits("1000", 6))).wait();

  const recipients = [await r1.getAddress(), await r2.getAddress()];
  const amounts = [ethers.parseUnits("10", 6), ethers.parseUnits("25", 6)];

  const competitionId = 1n;
  const tx = await settlement.connect(owner).finalizeAndPayout(competitionId, recipients, amounts);
  const rcpt = await tx.wait();
  console.log("TX:", tx.hash);
  console.log("Settlement:", await settlement.getAddress());
  console.log("USDC:", await usdc.getAddress());
  console.log("Block:", rcpt?.blockNumber);
}

main().catch((e) => { console.error(e); process.exit(1); });
