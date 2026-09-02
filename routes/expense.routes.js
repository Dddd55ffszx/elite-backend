const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const Expense = require("../models/Expense");

const {
  adjustBalance,
  deleteBalanceHistoryForExpense,
} = require("../utils/balanceHelper");

// ============================================================
// GET EXPENSES BY PROJECT
// ============================================================

router.get("/:projectId", auth, async (req, res) => {
  try {
    const expenses = await Expense.find({
      project: req.params.projectId,
      user: req.userId,
    }).sort({ createdAt: -1 });

    res.json(expenses);
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================================================
// ADD EXPENSE
// ============================================================

router.post("/:projectId", auth, async (req, res) => {
  try {
    const { reason, amount, date } = req.body;

    if (!reason || amount === undefined || amount === null) {
      return res.status(400).json({
        message: "Reason and amount required",
      });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than 0",
      });
    }

    const expenseData = {
      project: req.params.projectId,
      reason,
      amount: numericAmount,
      user: req.userId,
    };

    if (date && !isNaN(new Date(date).getTime())) {
      expenseData.date = new Date(date);
    }

    // Create actual expense first.
    const expense = await Expense.create(expenseData);

    try {
      // Deduct from shared balance.
      await adjustBalance({
        userId: req.userId,
        amount: -numericAmount,
        type: "expense",
        description: reason,
        date: expenseData.date || new Date(),
        project: req.params.projectId,
        expense: expense._id,
      });
    } catch (balanceErr) {
      // If balance update fails, don't leave an orphan expense.
      await Expense.findByIdAndDelete(expense._id);

      throw balanceErr;
    }

    res.json(expense);
  } catch (err) {
    console.error("Add expense error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================================================
// DELETE EXPENSE
// ============================================================

router.delete("/:id", auth, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    // First restore balance and delete its history.
    await deleteBalanceHistoryForExpense(expense._id);

    // Then delete actual expense.
    await Expense.findByIdAndDelete(expense._id);

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("Delete expense error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;