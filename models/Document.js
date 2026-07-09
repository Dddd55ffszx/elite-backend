const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  relatedType: {
    type: String,
    enum: ["project", "apartment", "client"],
    required: true
  },

  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },

  fileUrl: String,

  documentType: String // contract, receipt, id, etc.
}, { timestamps: true });

module.exports = mongoose.model("Document", documentSchema);
