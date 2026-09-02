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
// ADD / SUBTRACT FROM BALANCE + CREATE HISTORY
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

  balance.currentBalance += Number(amount);

  await balance.save();

  const history = await BalanceHistory.create({
    user: userId,
    type,
    description,
    amount: Number(amount),
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
// DELETE BALANCE HISTORY + REVERSE ITS EFFECT
//
// This is used when something is deleted from the Balance page.
//
// Example:
// Balance = 300
// History = Expense -200
//
// Delete history
// Balance = 500
// Expense itself is also deleted.
// ============================================================

async function deleteBalanceHistoryEntry(historyId) {
  const history = await BalanceHistory.findById(historyId);

  if (!history) {
    const error = new Error("History entry not found");
    error.statusCode = 404;
    throw error;
  }

  const balance = await getOrCreateBalance();

  // Reverse the transaction.
  //
  // If history.amount = -200
  // adding -(-200) = +200
  //
  // If history.amount = +500
  // adding -(+500) = -500
  balance.currentBalance -= Number(history.amount);

  await balance.save();

  // ==========================================================
  // DELETE THE ACTUAL RECORD CONNECTED TO THIS HISTORY
  // ==========================================================

  // Project expense
  if (history.expense) {
    await Expense.findByIdAndDelete(history.expense);
  }

  // Commission
  if (history.commission) {
    await Commission.findByIdAndDelete(history.commission);
  }

  // General expense
  if (history.generalExpense) {
    await GeneralExpense.findByIdAndDelete(history.generalExpense);
  }

  // Finally delete the history itself.
  await BalanceHistory.findByIdAndDelete(history._id);

  return {
    balance: balance.currentBalance,
    history,
  };
}

// ============================================================
// DELETE HISTORY CONNECTED TO AN EXPENSE
//
// Used when deleting an Expense from its own page.
// ============================================================

async function deleteBalanceHistoryForExpense(expenseId) {
  const history = await BalanceHistory.findOne({
    expense: expenseId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  // Reverse the original deduction.
  balance.currentBalance -= Number(history.amount);

  await balance.save();

  await BalanceHistory.findByIdAndDelete(history._id);

  return balance;
}

// ============================================================
// DELETE HISTORY CONNECTED TO A COMMISSION
// ============================================================

async function deleteBalanceHistoryForCommission(commissionId) {
  const history = await BalanceHistory.findOne({
    commission: commissionId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  // Reverse original commission deduction.
  balance.currentBalance -= Number(history.amount);

  await balance.save();

  await BalanceHistory.findByIdAndDelete(history._id);

  return balance;
}

// ============================================================
// DELETE HISTORY CONNECTED TO A GENERAL EXPENSE
// ============================================================

async function deleteBalanceHistoryForGeneralExpense(generalExpenseId) {
  const history = await BalanceHistory.findOne({
    generalExpense: generalExpenseId,
  });

  if (!history) {
    return null;
  }

  const balance = await getOrCreateBalance();

  // Reverse original general expense deduction.
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