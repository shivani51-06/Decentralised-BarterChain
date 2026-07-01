const express = require("express");
const router = express.Router();
const Trade = require("../models/Trade");
const User = require("../models/User");
const auth = require("../middleware/auth");

// GET /api/trades/my — all trades involving this wallet
router.get("/my", auth, async (req, res) => {
  try {
    const wallet = req.walletAddress;
    const trades = await Trade.find({
      $or: [{ userA: wallet }, { userB: wallet }],
    })
      .populate("productA")
      .populate("productB")
      .sort({ createdAt: -1 });
    res.json(trades);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/request
// userB requests a trade with userA, proposing productA (A's) and productB (B's)
router.post("/request", auth, async (req, res) => {
  try {
    const { productA, productB, userA } = req.body;
    if (!productA || !productB || !userA) {
      return res.status(400).json({ error: "productA, productB, and userA are required" });
    }

    const trade = await Trade.create({
      userA: userA.toLowerCase(),
      userB: req.walletAddress,
      productA,
      productB,
    });

    res.status(201).json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/accept — userA accepts incoming request
// Also stores the on-chain contractTradeId created during acceptance
router.post("/accept", auth, async (req, res) => {
  try {
    const { tradeId, contractTradeId } = req.body;
    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });
    if (trade.userA !== req.walletAddress)
      return res.status(403).json({ error: "Only userA can accept this trade" });
    if (trade.status !== "pending")
      return res.status(400).json({ error: "Trade is not in pending state" });

    trade.status = "accepted";
    if (contractTradeId !== undefined && contractTradeId !== null) {
      trade.contractTradeId = String(contractTradeId);
    }
    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/stake — record on-chain staking info
router.post("/stake", auth, async (req, res) => {
  try {
    const { tradeId, contractTradeId, stakeAmount } = req.body;
    if (!tradeId || contractTradeId === undefined || !stakeAmount) {
      return res.status(400).json({ error: "tradeId, contractTradeId, and stakeAmount are required" });
    }

    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });
    if (trade.userA !== req.walletAddress && trade.userB !== req.walletAddress)
      return res.status(403).json({ error: "Not a participant" });

    // Record on-chain trade ID and stake amount
    if (!trade.contractTradeId) {
      trade.contractTradeId = String(contractTradeId);
    }
    if (!trade.stakeAmount) {
      trade.stakeAmount = String(stakeAmount);
    }

    // We track who has staked via on-chain events; here we just update status if both done
    // The frontend knows who has staked from the contract — status update is best-effort
    if (trade.status === "accepted") {
      trade.status = "staked";
    }

    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/upload-proof — upload shipment proof image URL
router.post("/upload-proof", auth, async (req, res) => {
  try {
    const { tradeId, proofUrl } = req.body;
    if (!tradeId || !proofUrl) {
      return res.status(400).json({ error: "tradeId and proofUrl are required" });
    }

    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    if (req.walletAddress === trade.userA) {
      trade.proofA = proofUrl;
    } else if (req.walletAddress === trade.userB) {
      trade.proofB = proofUrl;
    } else {
      return res.status(403).json({ error: "Not a participant" });
    }

    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/add-tracking — add shipment tracking ID
router.post("/add-tracking", auth, async (req, res) => {
  try {
    const { tradeId, trackingId } = req.body;
    if (!tradeId || !trackingId) {
      return res.status(400).json({ error: "tradeId and trackingId are required" });
    }

    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    if (req.walletAddress === trade.userA) {
      trade.trackingA = trackingId;
    } else if (req.walletAddress === trade.userB) {
      trade.trackingB = trackingId;
    } else {
      return res.status(403).json({ error: "Not a participant" });
    }

    // If both have added tracking, advance to shipped
    if (trade.trackingA && trade.trackingB && trade.status === "staked") {
      trade.status = "shipped";
    }

    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/confirm — user confirms receipt
router.post("/confirm", auth, async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });

    if (req.walletAddress === trade.userA) {
      trade.userAConfirmed = true;
    } else if (req.walletAddress === trade.userB) {
      trade.userBConfirmed = true;
    } else {
      return res.status(403).json({ error: "Not a participant" });
    }

    if (trade.userAConfirmed && trade.userBConfirmed) {
      trade.status = "completed";
      // Reward both users with +1 trustScore and +1 completedTrades
      await User.updateOne(
        { walletAddress: trade.userA },
        { $inc: { trustScore: 1, completedTrades: 1 } }
      );
      await User.updateOne(
        { walletAddress: trade.userB },
        { $inc: { trustScore: 1, completedTrades: 1 } }
      );
    }

    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/trades/dispute — raise a dispute
router.post("/dispute", auth, async (req, res) => {
  try {
    const { tradeId } = req.body;
    const trade = await Trade.findById(tradeId);
    if (!trade) return res.status(404).json({ error: "Trade not found" });
    if (trade.userA !== req.walletAddress && trade.userB !== req.walletAddress)
      return res.status(403).json({ error: "Not a participant" });
    if (trade.status === "completed" || trade.status === "disputed")
      return res.status(400).json({ error: "Cannot dispute this trade" });

    trade.status = "disputed";

    // Increment dispute counters for both users
    await User.updateOne({ walletAddress: trade.userA }, { $inc: { disputes: 1 } });
    await User.updateOne({ walletAddress: trade.userB }, { $inc: { disputes: 1 } });

    await trade.save();
    res.json(trade);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
