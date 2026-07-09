const mongoose = require("mongoose");

const GeneralExpenseSchema = new mongoose.Schema(
  {
    reason: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    distributedToProjects: {
      type: [
        {
          projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
          },
          distributedAmount: Number,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GeneralExpense", GeneralExpenseSchema);