const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  reason: { type: String },
  isPaid: { type: Boolean, default: false }, // ← ADDED
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

    price: { type: Number, required: true, default: 0 },
    soldPrice: { type: Number, default: 0 },
    soldDate: { type: Date, default: null },

    size: { type: Number },

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

    installmentMonths: { type: Number },
    installmentStartDate: { type: Date },

    payments: [PaymentSchema],

    cashPaid: { type: Number, default: 0 },
    isSold: { type: Boolean, default: false },

    files: [{
      filename: { type: String, required: true },
      originalName: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      mimeType: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    }]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Apartment", ApartmentSchema);