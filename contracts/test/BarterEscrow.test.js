const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BarterEscrow", function () {
  let escrow;
  let owner, userA, userB, userC;
  const ONE_MATIC = ethers.parseEther("1.0");
  const HALF_MATIC = ethers.parseEther("0.5");

  beforeEach(async function () {
    [owner, userA, userB, userC] = await ethers.getSigners();
    const BarterEscrow = await ethers.getContractFactory("BarterEscrow");
    escrow = await BarterEscrow.deploy();
  });

  // 1. createTrade
  describe("createTrade", function () {
    it("creates a trade and emits TradeCreated", async function () {
      await expect(escrow.connect(userA).createTrade(userB.address))
        .to.emit(escrow, "TradeCreated")
        .withArgs(0, userA.address, userB.address);

      const trade = await escrow.trades(0);
      expect(trade.userA).to.equal(userA.address);
      expect(trade.userB).to.equal(userB.address);
      expect(trade.isActive).to.be.true;
    });

    it("increments tradeCount", async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).createTrade(userC.address);
      expect(await escrow.tradeCount()).to.equal(2);
    });

    it("reverts when trading with yourself", async function () {
      await expect(
        escrow.connect(userA).createTrade(userA.address)
      ).to.be.revertedWith("Cannot trade with yourself");
    });
  });

  // 2. depositStake
  describe("depositStake", function () {
    beforeEach(async function () {
      await escrow.connect(userA).createTrade(userB.address);
    });

    it("allows userA to deposit first and sets stake amount", async function () {
      await expect(
        escrow.connect(userA).depositStake(0, { value: ONE_MATIC })
      )
        .to.emit(escrow, "StakeDeposited")
        .withArgs(0, userA.address, ONE_MATIC);

      const trade = await escrow.trades(0);
      expect(trade.stakeAmount).to.equal(ONE_MATIC);
      expect(trade.userAStaked).to.be.true;
    });

    it("requires userB to match the stake amount", async function () {
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await expect(
        escrow.connect(userB).depositStake(0, { value: HALF_MATIC })
      ).to.be.revertedWith("Must match the first deposit amount");
    });

    it("allows both users to deposit matching amounts", async function () {
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userB).depositStake(0, { value: ONE_MATIC });

      const trade = await escrow.trades(0);
      expect(trade.userAStaked).to.be.true;
      expect(trade.userBStaked).to.be.true;
    });

    it("reverts if non-participant tries to stake", async function () {
      await expect(
        escrow.connect(userC).depositStake(0, { value: ONE_MATIC })
      ).to.be.revertedWith("Not a participant");
    });
  });

  // 3. confirmTrade
  describe("confirmTrade", function () {
    beforeEach(async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userB).depositStake(0, { value: ONE_MATIC });
    });

    it("emits TradeCompleted and releases funds when both confirm", async function () {
      const balABefore = await ethers.provider.getBalance(userA.address);
      const balBBefore = await ethers.provider.getBalance(userB.address);

      await escrow.connect(userA).confirmTrade(0);
      await expect(escrow.connect(userB).confirmTrade(0))
        .to.emit(escrow, "TradeCompleted")
        .withArgs(0);

      const balAAfter = await ethers.provider.getBalance(userA.address);
      const balBAfter = await ethers.provider.getBalance(userB.address);

      expect(balAAfter).to.be.gt(balABefore);
      expect(balBAfter).to.be.gt(balBBefore);

      const trade = await escrow.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("does not complete with only one confirmation", async function () {
      await escrow.connect(userA).confirmTrade(0);
      const trade = await escrow.trades(0);
      expect(trade.isActive).to.be.true;
    });

    it("reverts confirming before both stakes are deposited", async function () {
      await escrow.connect(userA).createTrade(userB.address); // tradeId = 1
      await escrow.connect(userA).depositStake(1, { value: ONE_MATIC });
      await expect(
        escrow.connect(userA).confirmTrade(1)
      ).to.be.revertedWith("Both parties must stake first");
    });
  });

  // 4. raiseDispute
  describe("raiseDispute", function () {
    beforeEach(async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userB).depositStake(0, { value: ONE_MATIC });
    });

    it("marks trade as disputed", async function () {
      await expect(escrow.connect(userA).raiseDispute(0))
        .to.emit(escrow, "DisputeRaised")
        .withArgs(0, userA.address);

      const trade = await escrow.trades(0);
      expect(trade.isDisputed).to.be.true;
      expect(trade.isActive).to.be.true;
    });

    it("reverts raising dispute twice", async function () {
      await escrow.connect(userA).raiseDispute(0);
      await expect(
        escrow.connect(userB).raiseDispute(0)
      ).to.be.revertedWith("Already disputed");
    });
  });

  // 5. resolveDispute
  describe("resolveDispute", function () {
    beforeEach(async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userB).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userA).raiseDispute(0);
    });

    it("resolves with correct splits: winner=100%, loser=70%, owner=30%", async function () {
      const ownerBefore = await ethers.provider.getBalance(owner.address);
      const winnerBefore = await ethers.provider.getBalance(userA.address);
      const loserBefore = await ethers.provider.getBalance(userB.address);

      await expect(escrow.connect(owner).resolveDispute(0, userA.address))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(0, userA.address);

      const penalty = ONE_MATIC * 30n / 100n;
      const loserRefund = ONE_MATIC - penalty;

      const ownerAfter = await ethers.provider.getBalance(owner.address);
      const winnerAfter = await ethers.provider.getBalance(userA.address);
      const loserAfter = await ethers.provider.getBalance(userB.address);

      expect(winnerAfter - winnerBefore).to.be.closeTo(ONE_MATIC, ethers.parseEther("0.01"));
      expect(loserAfter - loserBefore).to.be.closeTo(loserRefund, ethers.parseEther("0.01"));
      expect(ownerAfter - ownerBefore).to.be.closeTo(penalty, ethers.parseEther("0.01"));

      const trade = await escrow.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("reverts if non-owner tries to resolve", async function () {
      await expect(
        escrow.connect(userA).resolveDispute(0, userA.address)
      ).to.be.revertedWith("Not owner");
    });

    it("reverts if winner is not a participant", async function () {
      await expect(
        escrow.connect(owner).resolveDispute(0, userC.address)
      ).to.be.revertedWith("Winner must be a participant");
    });
  });

  // 6. cancelTrade
  describe("cancelTrade", function () {
    it("refunds userA if only userA staked", async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });

      const balBefore = await ethers.provider.getBalance(userA.address);
      await expect(escrow.connect(userA).cancelTrade(0))
        .to.emit(escrow, "TradeCancelled")
        .withArgs(0);
      const balAfter = await ethers.provider.getBalance(userA.address);

      expect(balAfter).to.be.gt(balBefore);
      const trade = await escrow.trades(0);
      expect(trade.isActive).to.be.false;
    });

    it("cancels with no stakes deposited", async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await expect(escrow.connect(userB).cancelTrade(0))
        .to.emit(escrow, "TradeCancelled")
        .withArgs(0);
    });

    it("reverts cancel when both have staked", async function () {
      await escrow.connect(userA).createTrade(userB.address);
      await escrow.connect(userA).depositStake(0, { value: ONE_MATIC });
      await escrow.connect(userB).depositStake(0, { value: ONE_MATIC });

      await expect(
        escrow.connect(userA).cancelTrade(0)
      ).to.be.revertedWith("Both already staked - raise a dispute instead");
    });
  });
});
