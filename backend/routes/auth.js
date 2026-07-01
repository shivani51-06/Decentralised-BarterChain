const express = require("express");
const router = express.Router();
const User = require("../models/User");

// POST /api/auth/connect-wallet
// Upserts a user by wallet address and returns the user document
router.post("/connect-wallet", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const user = await User.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { walletAddress: walletAddress.toLowerCase() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
