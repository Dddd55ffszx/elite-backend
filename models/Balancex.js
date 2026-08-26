const mongoose = require("mongoose");

// Shared balance: a single document for the whole app (not per user).
const BalanceSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "shared",
      unique: true,
    },
    currentBalance: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Balance", BalanceSchema);
