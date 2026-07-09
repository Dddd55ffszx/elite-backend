
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Expense = require("../models/Expense");
const GeneralExpense = require("../models/GeneralExpense");

router.get("/check-expenses", auth, async (req, res) => {
  try {
    // Find all general expenses
    const generalExpenses = await GeneralExpense.find({ user: req.userId });
    
    // Find all expenses with [GENERAL] prefix
    const generalProjectExpenses = await Expense.find({
      user: req.userId,
      reason: { $regex: /^\[GENERAL\]/, $options: 'i' }
    });
    
    // Find all expenses by project
    const allExpenses = await Expense.find({ user: req.userId }).populate('project', 'name');
    
    res.json({
      generalExpensesCount: generalExpenses.length,
      generalExpenses: generalExpenses.map(ge => ({
        id: ge._id,
        reason: ge.reason,
        amount: ge.amount,
        date: ge.expenseDate
      })),
      generalProjectExpensesCount: generalProjectExpenses.length,
      generalProjectExpenses: generalProjectExpenses.map(exp => ({
        id: exp._id,
        project: exp.project?.name || exp.project,
        reason: exp.reason,
        amount: exp.amount,
        date: exp.date
      })),
      allExpensesCount: allExpenses.length,
      allExpenses: allExpenses.map(exp => ({
        id: exp._id,
        project: exp.project?.name || exp.project,
        reason: exp.reason,
        amount: exp.amount,
        date: exp.date
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;