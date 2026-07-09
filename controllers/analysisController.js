const GeneralExpense = require("../models/GeneralExpense");

exports.getGeneralExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = { user: req.userId };

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(startDate);
      if (endDate) query.expenseDate.$lte = new Date(endDate);
    }

    const expenses = await GeneralExpense.find(query).sort({
      expenseDate: -1, // ✅ sorted
    });

    res.json({ success: true, expenses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addGeneralExpense = async (req, res) => {
  try {
    const { reason, amount, expenseDate } = req.body;

    const exp = await GeneralExpense.create({
      reason,
      amount,
      expenseDate,
      user: req.userId,
    });

    res.json({ success: true, exp });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteGeneralExpense = async (req, res) => {
  await GeneralExpense.findByIdAndDelete(req.params.id);
  res.json({ success: true });
};