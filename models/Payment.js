const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sale",
    required: true
  },

  amount: Number,
  method: String,

  dueDate: Date,
  paidDate: Date,

  status: {
    type: String,
    enum: ["paid", "pending"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
