const Expense = require("../models/Expense");
const Sale = require("../models/Sale");
const Apartment = require("../models/Apartment");

exports.projectDashboard = async (req, res) => {
  const { projectId } = req.params;

  const expenses = await Expense.aggregate([
    { $match: { project: projectId } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);

  const apartments = await Apartment.find({ project: projectId });

  const soldApartments = apartments.filter(a => a.status === "sold");

  const sales = await Sale.find({
    apartment: { $in: soldApartments.map(a => a._id) }
  });

  const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalExpenses = expenses[0]?.total || 0;

  res.json({
    totalApartments: apartments.length,
    soldApartments: soldApartments.length,
    totalSales,
    totalExpenses,
    profit: totalSales - totalExpenses
  });
};
exports.getProjectExpenses = async (req, res) => {
    const { projectId } = req.params;
    const expenses = await Expense.find({ project: projectId });
    res.json(expenses);
}