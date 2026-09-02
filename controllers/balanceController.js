const BalanceHistory = require("../models/BalanceHistory");

const {
  getOrCreateBalance,
  adjustBalance,
  deleteBalanceHistoryEntry,
  recalculateBalance,
} = require("../utils/balanceHelper");

// ============================================================
// GET BALANCE
// ============================================================

exports.getBalance = async (req, res) => {
  try {
    const balance = await getOrCreateBalance();

    res.json({
      balance: balance.currentBalance,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// ADD BALANCE
// ============================================================

exports.addBalance = async (req, res) => {
  try {
    const { description, amount, date } = req.body;

    if (
      !description ||
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return res.status(400).json({
        message: "Description and amount are required",
      });
    }

    const numericAmount = Number(amount);

    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        message: "Amount must be a positive number",
      });
    }

    const parsedDate =
      date && !isNaN(new Date(date).getTime())
        ? new Date(date)
        : new Date();

    const result = await adjustBalance({
      userId: req.userId,
      amount: numericAmount,
      type: "deposit",
      description,
      date: parsedDate,
    });

    res.json({
      balance: result.balance.currentBalance,
      history: result.history,
    });
  } catch (err) {
    console.error("Add balance error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// GET BALANCE HISTORY
// ============================================================

exports.getHistory = async (req, res) => {
  try {
    const history = await BalanceHistory.find({})
      .sort({
        date: -1,
        createdAt: -1,
      })
      .populate("project", "name")
      .populate("user", "name email")
      .populate("expense", "reason amount date")
      .populate("commission", "amount label date")
      .populate(
        "generalExpense",
        "reason amount expenseDate"
      );

    res.json(history);
  } catch (err) {
    console.error("Get balance history error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};

// ============================================================
// DELETE ANY BALANCE HISTORY ENTRY
// ============================================================

exports.deleteHistoryEntry = async (req, res) => {
  try {
    const result = await deleteBalanceHistoryEntry(
      req.params.id
    );

    res.json({
      success: true,
      balance: result.balance,
    });
  } catch (err) {
    console.error("Delete balance history error:", err);

    res.status(err.statusCode || 500).json({
      message: err.message,
    });
  }
};

// ============================================================
// RECALCULATE BALANCE FROM HISTORY
//
// Fixes drift between Balance.currentBalance and the actual
// sum of BalanceHistory entries (e.g. after a direct DB import
// that bypassed adjustBalance). Safe to call any time — it just
// recomputes the true total and saves it.
// ============================================================

exports.recalculateBalance = async (req, res) => {
  try {
    const result = await recalculateBalance();

    res.json({
      success: true,
      previousBalance: result.previousBalance,
      balance: result.newBalance,
    });
  } catch (err) {
    console.error("Recalculate balance error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
};