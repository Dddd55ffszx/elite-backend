const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Expense = require("../models/Expense");

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

    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete expense
router.delete("/:id", auth, async (req, res) => {
  try {
    await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.userId,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
