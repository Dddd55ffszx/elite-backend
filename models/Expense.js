const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    isGeneralExpense: {
      type: Boolean,
      default: false,
    },
    generalExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GeneralExpense",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", ExpenseSchema);