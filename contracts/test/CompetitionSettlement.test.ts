import { expect } from "chai";
import { ethers } from "hardhat";

describe("CompetitionSettlement", () => {
  it("pays out USDC to winners and emits events", async () => {
    const [owner, w1, w2] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy(await owner.getAddress());
    await usdc.waitForDeployment();

    const Settlement = await ethers.getContractFactory("CompetitionSettlement");
    const settlement = await Settlement.deploy(await usdc.getAddress(), await owner.getAddress());
    await settlement.waitForDeployment();

    // Owner approves settlement to pull funds
    const total = 1_000_000; // 1 USDC (6 decimals)
    await usdc.connect(owner).approve(await settlement.getAddress(), total);

    const recipients = [await w1.getAddress(), await w2.getAddress()];
    const amounts = [600_000, 400_000];

    await expect(settlement.connect(owner).finalizeAndPayout(1, recipients, amounts))
      .to.emit(settlement, "SettlementFinalized").withArgs(1, total, recipients.length);

    expect(await usdc.balanceOf(recipients[0])).to.equal(amounts[0]);
    expect(await usdc.balanceOf(recipients[1])).to.equal(amounts[1]);
  });
});
