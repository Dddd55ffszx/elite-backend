const mongoose = require("mongoose");

const InstallmentSchema = new mongoose.Schema(
  {
    month: String,
    amount: Number,
  },
  { _id: false }
);

// ✅ IMPORTANT: removed _id: false
const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const ApartmentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    apartmentId: { type: String, required: true },
    floor: { type: String },

    price: { type: Number },
    size: { type: Number },

    pricing: { type: Number },
    pricePerMeter: { type: Number },

    paymentType: {
      type: String,
      enum: ["cash", "installments"],
      required: true,
    },

    client: {
      name: String,
      phone: String,
      nationalId: String,
    },

    cashPaid: { type: Number, default: 0 },

    installmentPlan: { type: String },

    installments: [InstallmentSchema],

    payments: [PaymentSchema],

    isSold: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Apartment", ApartmentSchema);
