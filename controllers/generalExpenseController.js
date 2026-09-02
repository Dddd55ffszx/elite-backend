const GeneralExpense = require("../models/GeneralExpense");

const {
  adjustBalance,
  deleteBalanceHistoryForGeneralExpense,
} = require("../utils/balanceHelper");

// ============================================================
// GET GENERAL EXPENSES
// ============================================================

exports.getGeneralExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {
      user: req.userId,
    };

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

// ============================================================
// ADD GENERAL EXPENSE
// ============================================================

exports.addGeneralExpense = async (req, res) => {
  try {
    const {
      reason,
      amount,
      expenseDate,
    } = req.body;

    const numericAmount = Number(amount);

    if (
      !reason ||
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid reason and amount required",
      });
    }

    const parsedDate = expenseDate
      ? new Date(expenseDate)
      : new Date();

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense date",
      });
    }

    const generalExpense = await GeneralExpense.create({
      reason,
      amount: numericAmount,
      expenseDate: parsedDate,
      user: req.userId,
    });

    // Deduct from shared balance.
    //
    // IMPORTANT:
    // Store generalExpense ID in BalanceHistory.
    try {
      await adjustBalance({
        userId: req.userId,
        amount: -numericAmount,
        type: "generalExpense",
        description: reason,
        date: parsedDate,
        generalExpense: generalExpense._id,
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

// ============================================================
// DELETE GENERAL EXPENSE
//
// Delete actual record
// + delete balance history
// + restore balance
// ============================================================

exports.deleteGeneralExpense = async (req, res) => {
  try {
    const {
      id,
    } = req.params;

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

    // Restore balance and remove history.
    try {
      await deleteBalanceHistoryForGeneralExpense(
        generalExpense._id
      );
    } catch (balanceErr) {
      console.error(
        "Balance update failed for deleted general expense:",
        balanceErr.message
      );

      return res.status(500).json({
        success: false,
        message:
          "General expense could not be deleted because balance update failed",
      });
    }

    // Delete actual general expense.
    await GeneralExpense.findByIdAndDelete(
      generalExpense._id
    );

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