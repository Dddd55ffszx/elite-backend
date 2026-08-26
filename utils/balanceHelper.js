const Balance = require("../models/Balance");
const BalanceHistory = require("../models/BalanceHistory");

const SHARED_KEY = "shared";

// The balance is shared across all users, so there's a single document for
// it (keyed by SHARED_KEY). Create it on first use, starting at 0.
async function getOrCreateBalance() {
  let balance = await Balance.findOne({ key: SHARED_KEY });
  if (!balance) {
    balance = await Balance.create({ key: SHARED_KEY, currentBalance: 0 });
  }
  return balance;
}

// Adjust the shared balance and log a history entry in one place, so every
// caller (manual deposits, project expenses, expense deletions, ...) stays
// consistent. `userId` records who performed the action, for the history
// log only — it does not scope the balance itself.
//
// amount: positive to add to the balance, negative to deduct from it.
async function adjustBalance({
  userId,
  amount,
  type,
  description,
  date,
  project,
  expense,
}) {
  const balance = await getOrCreateBalance();
  balance.currentBalance += amount;
  await balance.save();

  await BalanceHistory.create({
    user: userId,
    type,
    description,
    amount,
    balanceAfter: balance.currentBalance,
    date: date || new Date(),
    project: project || null,
    expense: expense || null,
  });

  return balance;
}

module.exports = { getOrCreateBalance, adjustBalance };
