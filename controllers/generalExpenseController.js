const GeneralExpense = require("../models/GeneralExpense");
const Project = require("../models/Project");
const Expense = require("../models/Expense");

const {
  deleteBalanceHistoryForGeneralExpense,
} = require("../utils/balanceHelper");
const { logActivity } = require("../utils/activityLogger");

// ============================================================
// GET GENERAL EXPENSES
// ============================================================

exports.getGeneralExpenses = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = {
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

    const expenses = await GeneralExpense.find(query)
      .sort({ expenseDate: -1 });

    res.json({
      success: true,
      expenses,
    });
  } catch (error) {
    console.error(
      "Get general expenses error:",
      error
    );

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

    const generalExpense =
      await GeneralExpense.create({
        reason,
        amount: numericAmount,
        expenseDate: parsedDate,
        user: req.userId,
      });

    // NOTE: General expenses no longer deduct from the shared balance.
    // Only project Expenses affect the balance.

    logActivity({
      userId: req.userId,
      action: "create",
      entityType: "GeneralExpense",
      entityId: generalExpense._id,
      description: `Added general expense "${reason}" of ${numericAmount} EGP`,
    });

    res.json({
      success: true,
      message:
        "General expense added successfully",
      generalExpense,
    });
  } catch (error) {
    console.error(
      "Add general expense error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DELETE GENERAL EXPENSE
// ============================================================

exports.deleteGeneralExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const generalExpense =
      await GeneralExpense.findOne({
        _id: id,
        user: req.userId,
      });

    if (!generalExpense) {
      return res.status(404).json({
        success: false,
        message: "General expense not found",
      });
    }

    // Restore balance + remove history.
    await deleteBalanceHistoryForGeneralExpense(
      generalExpense._id
    );

    // Delete actual record.
    await GeneralExpense.findByIdAndDelete(
      generalExpense._id
    );

    logActivity({
      userId: req.userId,
      action: "delete",
      entityType: "GeneralExpense",
      entityId: generalExpense._id,
      description: `Deleted general expense "${generalExpense.reason}" of ${generalExpense.amount} EGP`,
    });

    res.json({
      success: true,
      message:
        "General expense deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete general expense error:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// REDISTRIBUTE GENERAL EXPENSES
// ============================================================

exports.redistributeGeneralExpenses = async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Fetch all projects and general expenses for this user
    const projects = await Project.find({ user: userId }).sort({ createdAt: 1 });
    const generalExpenses = await GeneralExpense.find({ user: userId });

    if (projects.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No projects found to redistribute expenses to."
      });
    }

    // 2. Clear existing distributions to avoid duplicates
    await Expense.deleteMany({
      user: userId,
      isGeneralExpense: true
    });

    const redistributionDetails = [];

    // 3. Loop through each general expense
    for (const gExp of generalExpenses) {
      const expenseDate = new Date(gExp.expenseDate);

      // Filter projects that existed at the time of the expense
      const eligibleProjects = projects.filter(proj =>
        new Date(proj.createdAt) <= expenseDate
      );

      if (eligibleProjects.length === 0) continue;

      const share = gExp.amount / eligibleProjects.length;

      // Create an expense record for each eligible project
      const expensePromises = eligibleProjects.map(proj => {
        return Expense.create({
          project: proj._id,
          reason: `[GENERAL] ${gExp.reason}`,
          amount: share,
          date: gExp.expenseDate,
          user: userId,
          isGeneralExpense: true,
          generalExpenseId: gExp._id
        });
      });

      await Promise.all(expensePromises);

      redistributionDetails.push({
        generalExpenseId: gExp._id,
        distributedTo: eligibleProjects.length,
        amountPerProject: share
      });
    }

    logActivity({
      userId,
      action: "redistribute",
      entityType: "GeneralExpense",
      description: "Redistributed all general expenses across eligible projects",
    });

    res.json({
      success: true,
      message: "General expenses redistributed successfully",
      details: redistributionDetails
    });

  } catch (error) {
    console.error("Redistribute general expenses error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during redistribution",
      error: error.message
    });
  }
};