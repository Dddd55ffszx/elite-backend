const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Expense = require("../models/Expense");
const { adjustBalance } = require("../utils/balanceHelper");

// ✅ Get expenses by project
router.get("/:projectId", auth, async (req, res) => {
  try {
    const expenses = await Expense.find({
      project: req.params.projectId,
      user: req.userId,
    }).sort({ createdAt: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/:projectId", auth, async (req, res) => {
  try {
    const { reason, amount, date } = req.body;  // 👈 include date

    if (!reason || !amount) {
      return res.status(400).json({ message: "Reason and amount required" });
    }

    const expenseData = {
      project: req.params.projectId,
      reason,
      amount,
      user: req.userId,
    };

    // Only add date if it was provided and is valid
    if (date && !isNaN(new Date(date).getTime())) {
      expenseData.date = new Date(date);
    }

    const expense = await Expense.create(expenseData);

    // Every project expense automatically comes out of the balance.
    try {
      await adjustBalance({
        userId: req.userId,
        amount: -Math.abs(Number(amount)),
        type: "expense",
        description: reason,
        date: expenseData.date || new Date(),
        project: req.params.projectId,
        expense: expense._id,
      });
    } catch (balanceErr) {
      console.error("Balance update failed for new expense:", balanceErr.message);
    }

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete expense
router.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    // Refund the balance for whatever was deducted when this expense was added.
    if (expense) {
      try {
        await adjustBalance({
          userId: req.userId,
          amount: Math.abs(Number(expense.amount)),
          type: "refund",
          description: `Refund: ${expense.reason}`,
          date: new Date(),
          project: expense.project,
          expense: expense._id,
        });
      } catch (balanceErr) {
        console.error("Balance update failed for deleted expense:", balanceErr.message);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
