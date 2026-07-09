const mongoose = require("mongoose");

const CommissionSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // "project" label means it belongs to the project itself,
    // or it stores an apartment's apartmentId string (e.g. "A-101")
    label: {
      type: String,
      required: true,
      default: "project",
    },
    // optional: store the apartment ObjectId when label is an apartment
    apartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Apartment",
      default: null,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Commission", CommissionSchema);