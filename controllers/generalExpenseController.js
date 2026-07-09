const GeneralExpense = require("../models/GeneralExpense");

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

    const generalExpense = await GeneralExpense.create({
      reason,
      amount,
      expenseDate: expenseDate
        ? new Date(expenseDate)
        : new Date(),
      user: req.userId,
    });

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
      user: req.userId,
    });

    if (!generalExpense) {
      return res.status(404).json({
        success: false,
        message: "General expense not found",
      });
    }

    await GeneralExpense.findByIdAndDelete(id);

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