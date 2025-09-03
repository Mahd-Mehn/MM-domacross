import { expect } from "chai";
import { ethers } from "hardhat";
import { CompetitionFactory, ValuationOracle } from "../typechain-types";

describe("CompetitionFactory", function () {
  let factory: CompetitionFactory;
  let oracle: ValuationOracle;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    const Oracle = await ethers.getContractFactory("ValuationOracle");
    oracle = await Oracle.deploy(owner.address);
    await oracle.waitForDeployment();

    const Factory = await ethers.getContractFactory("CompetitionFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  });

  it("Should deploy a competition", async function () {
    const startTime = Math.floor(Date.now() / 1000) + 60;
    const endTime = startTime + 3600;
    const entryFee = ethers.parseEther("0.01");

    await expect(factory.createCompetition(startTime, endTime, entryFee, oracle.target))
      .to.emit(factory, "CompetitionCreated");

    const competitions = await factory.getDeployedCompetitions();
    expect(competitions.length).to.equal(1);
  });
});
