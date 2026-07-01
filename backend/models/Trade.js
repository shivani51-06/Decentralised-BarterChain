const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema(
  {
    userA: { type: String, required: true, lowercase: true },
    userB: { type: String, required: true, lowercase: true },
    productA: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productB: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "staked", "shipped", "completed", "disputed"],
      default: "pending",
    },
    // Shipping details
    trackingA: { type: String, default: null },
    trackingB: { type: String, default: null },
    proofA: { type: String, default: null },
    proofB: { type: String, default: null },
    // Confirmation flags (off-chain mirror of on-chain state)
    userAConfirmed: { type: Boolean, default: false },
    userBConfirmed: { type: Boolean, default: false },
    // On-chain references
    contractTradeId: { type: String, default: null },
    stakeAmount: { type: String, default: null }, // stored in wei as string
  },
  { timestamps: true }
);

module.exports = mongoose.model("Trade", tradeSchema);
