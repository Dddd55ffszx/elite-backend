const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  nationalId: String
}, { timestamps: true });

module.exports = mongoose.model("Client", clientSchema);
