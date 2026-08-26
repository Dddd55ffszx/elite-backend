const BalanceHistory = require("../models/BalanceHistory");
const { getOrCreateBalance, adjustBalance } = require("../utils/balanceHelper");

// GET /api/balance
// The balance is shared across all users.
exports.getBalance = async (req, res) => {
  try {
    const balance = await getOrCreateBalance();
    res.json({ balance: balance.currentBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/balance  { description, amount, date }
exports.addBalance = async (req, res) => {
  try {
    const { description, amount, date } = req.body;

    if (!description || amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ message: "Description and amount are required" });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const parsedDate =
      date && !isNaN(new Date(date).getTime()) ? new Date(date) : new Date();

    const balance = await adjustBalance({
      userId: req.userId,
      amount: numericAmount,
      type: "deposit",
      description,
      date: parsedDate,
    });

    res.json({ balance: balance.currentBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/balance/history
// Shared history across all users — not filtered by who made the request.
exports.getHistory = async (req, res) => {
  try {
    const history = await BalanceHistory.find({})
      .sort({ date: -1, createdAt: -1 })
      .populate("project", "name")
      .populate("user", "name email");

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/balance/history/:id
// Only balances added manually ("deposit" entries) can be removed this way.
// Removing one reverses its effect on the shared balance and deletes the
// history record. Expense/refund entries stay tied to their expense or
// commission and should be removed from there instead.
exports.deleteHistoryEntry = async (req, res) => {
  try {
    const entry = await BalanceHistory.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: "History entry not found" });
    }
    if (entry.type !== "deposit") {
      return res.status(400).json({
        message: "Only manually added balance entries can be deleted here",
      });
    }

    // Reverse the effect this deposit had on the shared balance, without
    // creating a new history entry for the reversal itself.
    const balance = await getOrCreateBalance();
    balance.currentBalance -= entry.amount;
    await balance.save();

    await BalanceHistory.findByIdAndDelete(req.params.id);

    res.json({ success: true, balance: balance.currentBalance });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
