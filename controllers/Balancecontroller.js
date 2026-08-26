const Balance = require("../models/Balance");
const Expense = require("../models/Expense");

// ================= GET BALANCE (current amount + history) =================
exports.getBalance = async (req, res) => {
  try {
    const entries = await Balance.find({}).sort({ date: -1, createdAt: -1 });

    const totalAdded = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Every expense added to any project reduces the balance by the same amount.
    const expenseAgg = await Expense.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses = expenseAgg[0]?.total || 0;

    const balance = totalAdded - totalExpenses;

    res.json({
      success: true,
      balance,
      totalAdded,
      totalExpenses,
      entries,
    });
  } catch (error) {
    console.error("Get balance error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= ADD BALANCE ENTRY =================
exports.addBalance = async (req, res) => {
  try {
    const { description, amount, date } = req.body;

    if (!description || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid description and amount required",
      });
    }

    const entry = await Balance.create({
      description,
      amount,
      date: date ? new Date(date) : new Date(),
      user: req.userId,
    });

    res.json({
      success: true,
      message: "Balance added successfully",
      entry,
    });
  } catch (error) {
    console.error("Add balance error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};