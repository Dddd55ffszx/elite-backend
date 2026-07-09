const Sale = require("../models/Sale");
const Payment = require("../models/Payment");
const Apartment = require("../models/Apartment");

exports.createSale = async (req, res) => {
  const {
    apartment,
    client,
    paymentType,
    totalAmount,
    downPayment,
    installmentCount
  } = req.body;

  let installmentAmount = 0;
  let remainingAmount = totalAmount - (downPayment || 0);

  if (paymentType === "installment") {
    installmentAmount = remainingAmount / installmentCount;
  }

  const sale = await Sale.create({
    apartment,
    client,
    paymentType,
    totalAmount,
    downPayment,
    installmentCount,
    installmentAmount,
    remainingAmount
  });

  // Mark apartment as sold
  await Apartment.findByIdAndUpdate(apartment, { status: "sold" });

  // Create installment payments
  if (paymentType === "installment") {
    const payments = [];
    for (let i = 1; i <= installmentCount; i++) {
      payments.push({
        sale: sale._id,
        amount: installmentAmount,
        dueDate: new Date(new Date().setMonth(new Date().getMonth() + i))
      });
    }
    await Payment.insertMany(payments);
  }

  res.status(201).json(sale);
};
exports.getsales = async (req, res) => {
    const sales = await Sale.find().populate('apartment').populate('client');
    res.json(sales);    
}

