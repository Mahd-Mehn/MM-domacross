import { expect } from "chai";
import { ethers } from "hardhat";
import { Competition, ValuationOracle } from "../typechain-types";

describe("Competition", function () {
  let competition: Competition;
  let oracle: ValuationOracle;
  let owner: any;
  let participant1: any;
  let participant2: any;

  beforeEach(async function () {
    [owner, participant1, participant2] = await ethers.getSigners();

    const Oracle = await ethers.getContractFactory("ValuationOracle");
    oracle = await Oracle.deploy(owner.address);
    await oracle.waitForDeployment();

    const startTime = Math.floor(Date.now() / 1000) - 60; // Start 1 minute ago
    const endTime = startTime + 3600;
    const entryFee = ethers.parseEther("0.01");

    const CompetitionContract = await ethers.getContractFactory("Competition");
    competition = await CompetitionContract.deploy(startTime, endTime, entryFee, oracle.target, owner.address);
    await competition.waitForDeployment();
  });

  it("Should allow participants to join", async function () {
    await expect(competition.connect(participant1).join({ value: ethers.parseEther("0.01") }))
      .to.emit(competition, "ParticipantJoined")
      .withArgs(participant1.address);

    expect(await competition.isParticipant(participant1.address)).to.be.true;
  });

  it("Should not allow joining with incorrect fee", async function () {
    await expect(competition.connect(participant1).join({ value: ethers.parseEther("0.001") }))
      .to.be.revertedWith("Incorrect entry fee");
  });

  it("Should not allow joining twice", async function () {
    await competition.connect(participant1).join({ value: ethers.parseEther("0.01") });
    await expect(competition.connect(participant1).join({ value: ethers.parseEther("0.01") }))
      .to.be.revertedWith("Already a participant");
  });

  it("Should end competition and distribute prize", async function () {
    const initialBalance = await ethers.provider.getBalance(participant1.address);
    await competition.connect(participant1).join({ value: ethers.parseEther("0.01") });

    // Set a portfolio value for the participant
    await oracle.setDomainPrice(participant1.address, ethers.parseEther("1"));
    const portfolioTracker = await competition.portfolioTracker();
    const PortfolioTracker = await ethers.getContractAt("PortfolioTracker", portfolioTracker);
    await PortfolioTracker.addDomain(participant1.address, participant1.address);

    // Fast forward time to after end time
    await ethers.provider.send("evm_increaseTime", [3700]);
    await ethers.provider.send("evm_mine");

    await expect(competition.endCompetition())
      .to.emit(competition, "CompetitionEnded");

    expect(await competition.ended()).to.be.true;
    expect(await competition.winner()).to.equal(participant1.address);
  });
});
