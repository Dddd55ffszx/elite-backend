const mongoose = require("mongoose");

const TadaemMichealSchema = new mongoose.Schema({
  reason: { type: String, required: true },
  amount: { type: Number, required: true },
  expenseDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model("TadaemMicheal", TadaemMichealSchema);