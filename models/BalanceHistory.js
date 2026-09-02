const mongoose = require("mongoose");

const BalanceHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["deposit", "expense", "commission", "generalExpense"],
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    // Positive = money added
    // Negative = money deducted
    amount: {
      type: Number,
      required: true,
    },

    // Balance immediately after this transaction happened.
    // This is historical and will not be changed when another
    // transaction is deleted.
    balanceAfter: {
      type: Number,
      required: true,
    },

    date: {
      type: Date,
      default: Date.now,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    // Project Expense
    expense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },

    // Commission
    commission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Commission",
      default: null,
    },

    // General Expense
    generalExpense: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeneralExpense",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BalanceHistory", BalanceHistorySchema);