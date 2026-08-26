const GeneralExpense = require("../models/GeneralExpense");
const { adjustBalance } = require("../utils/balanceHelper");

// ================= GET GENERAL EXPENSES =================
exports.getGeneralExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = { user: req.userId };

    if (startDate || endDate) {
      query.expenseDate = {};

      if (startDate) {
        query.expenseDate.$gte = new Date(startDate);
      }

      if (endDate) {
        query.expenseDate.$lte = new Date(endDate);
      }
    }

    const expenses = await GeneralExpense.find(query).sort({
      expenseDate: -1,
    });

    res.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error("Get general expenses error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= ADD GENERAL EXPENSE =================
exports.addGeneralExpense = async (req, res) => {
  try {
    const { reason, amount, expenseDate } = req.body;

    if (!reason || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid reason and amount required",
      });
    }

    const parsedDate = expenseDate ? new Date(expenseDate) : new Date();

    const generalExpense = await GeneralExpense.create({
      reason,
      amount,
      expenseDate: parsedDate,
      user: req.userId,
    });

    // General expenses come out of the shared balance too, same as
    // project expenses. Store the linkage on `expense` so a later
    // delete can find and reverse this exact entry.
    try {
      await adjustBalance({
        userId: req.userId,
        amount: -Math.abs(Number(amount)),
        type: "expense",
        description: reason,
        date: parsedDate,
        expense: generalExpense._id,
      });
    } catch (balanceErr) {
      console.error(
        "Balance update failed for new general expense:",
        balanceErr.message
      );
    }

    res.json({
      success: true,
      message: "General expense added successfully",
      generalExpense,
    });
  } catch (error) {
    console.error("Add general expense error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE GENERAL EXPENSE =================
exports.deleteGeneralExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const generalExpense = await GeneralExpense.findOne({
      _id: id,
    });

    if (!generalExpense) {
      return res.status(404).json({
        success: false,
        message: "General expense not found",
      });
    }

    await GeneralExpense.findByIdAndDelete(id);

    // Refund whatever this expense deducted from the shared balance.
    try {
      await adjustBalance({
        userId: req.userId,
        amount: Math.abs(Number(generalExpense.amount)),
        type: "refund",
        description: `Refund: ${generalExpense.reason}`,
        date: new Date(),
        expense: generalExpense._id,
      });
    } catch (balanceErr) {
      console.error(
        "Balance update failed for deleted general expense:",
        balanceErr.message
      );
    }

    res.json({
      success: true,
      message: "General expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete general expense error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};