const Balance = require("../models/Balance");
const BalanceHistory = require("../models/BalanceHistory");

const Expense = require("../models/Expense");
const Commission = require("../models/Commission");
const GeneralExpense = require("../models/GeneralExpense");

const SHARED_KEY = "shared";

// ============================================================
// GET OR CREATE SHARED BALANCE
// ============================================================

async function getOrCreateBalance() {
  let balance = await Balance.findOne({ key: SHARED_KEY });

  if (!balance) {
    balance = await Balance.create({
      key: SHARED_KEY,
      currentBalance: 0,
    });
  }

  return balance;
}

// ============================================================
// ADD / SUBTRACT BALANCE + CREATE HISTORY
// ============================================================

async function adjustBalance({
  userId,
  amount,
  type,
  description,
  date,
  project,
  expense,
  commission,
  generalExpense,
}) {
  const balance = await getOrCreateBalance();

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    throw new Error("Invalid balance amount");
  }

  balance.currentBalance += numericAmount;

  await balance.save();

  const history = await BalanceHistory.create({
    user: userId,
    type,
    description,
    amount: numericAmount,
    balanceAfter: balance.currentBalance,
    date: date || new Date(),

    project: project || null,
    expense: expense || null,
    commission: commission || null,
    generalExpense: generalExpense || null,
  });

  return {
    balance,
    history,
  };
}

// ============================================================
// DELETE BALANCE HISTORY ENTRY
//
// This is used when deleting directly from Balance History.
//
// It:
// 1. Reverses the transaction
// 2. Deletes the connected actual record
// 3. Deletes the history entry
//
// NO refund history is created.
// ============================================================

async function deleteBalanceHistoryEntry(historyId) {
  const history = await BalanceHistory.findById(historyId);

  if (!history) {
    const error = new Error("History entry not found");
    error.statusCode = 404;
    throw error;
  }

  const balance = await getOrCreateBalance();

  // ==========================================================
  // REVERSE TRANSACTION
  // ==========================================================

  // Example:
  // expense = -200
  // balance -= (-200)
  // balance += 200
  //
  // deposit = +500
  // balance -= 500
  // balance -= 500

  balance.currentBalance -= Number(history.amount);

  await balance.save();

  // ==========================================================
  // DELETE CONNECTED ACTUAL RECORD
  // ==========================================================

  // ----------------------------------------------------------
  // NEW COMMISSION RECORD
  // ----------------------------------------------------------

  if (history.commission) {
    await Commission.findByIdAndDelete(history.commission);
  }

  // ----------------------------------------------------------
  // NEW GENERAL EXPENSE RECORD
  // ----------------------------------------------------------

  if (history.generalExpense) {
    await GeneralExpense.findByIdAndDelete(history.generalExpense);
  }

  // ----------------------------------------------------------
  // PROJECT EXPENSE
  // ----------------------------------------------------------

  if (history.expense) {
    await Expense.findByIdAndDelete(history.expense);
  }

  // ----------------------------------------------------------
  // LEGACY GENERAL EXPENSE
  //
  // Old code stored GeneralExpense._id inside "expense".
  //
  // We only use this fallback when there is no project.
  // ----------------------------------------------------------

  if (
    history.expense &&
    !history.project &&
    !history.commission &&
    !history.generalExpense
  ) {
    await GeneralExpense.findByIdAndDelete(history.expense);
  }

  // ==========================================================
  // DELETE HISTORY
  // ==========================================================

  await BalanceHistory.findByIdAndDelete(history._id);

  return {
    balance: balance.currentBalance,
    history,
  };
}

// ============================================================
// DELETE HISTORY CONNECTED TO PROJECT EXPENSE
//
// Called when deleting an Expense from the project page.
// ============================================================

async function deleteBalanceHistoryForExpense(expenseId) {
  const history = await BalanceHistory.findOne({
    expense: expenseId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  // Reverse original deduction.
  balance.currentBalance -= Number(history.amount);

  await balance.save();

  // Delete history only.
  // The Expense itself is deleted by the route/controller.
  await BalanceHistory.findByIdAndDelete(history._id);

  return balance;
}

// ============================================================
// DELETE HISTORY CONNECTED TO COMMISSION
// ============================================================

async function deleteBalanceHistoryForCommission(commissionId) {
  const history = await BalanceHistory.findOne({
    commission: commissionId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  balance.currentBalance -= Number(history.amount);

  await balance.save();

  await BalanceHistory.findByIdAndDelete(history._id);

  return balance;
}

// ============================================================
// DELETE HISTORY CONNECTED TO GENERAL EXPENSE
// ============================================================

async function deleteBalanceHistoryForGeneralExpense(generalExpenseId) {
  const history = await BalanceHistory.findOne({
    generalExpense: generalExpenseId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  balance.currentBalance -= Number(history.amount);

  await balance.save();

  await BalanceHistory.findByIdAndDelete(history._id);

  return balance;
}

module.exports = {
  getOrCreateBalance,
  adjustBalance,

  deleteBalanceHistoryEntry,

  deleteBalanceHistoryForExpense,
  deleteBalanceHistoryForCommission,
  deleteBalanceHistoryForGeneralExpense,
};