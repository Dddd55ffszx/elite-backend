const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Sale = require("../models/Sale");

// Get sales for a project
router.get("/:projectId", auth, async (req, res) => {
  try {
    const sales = await Sale.find({
      project: req.params.projectId,
    }).sort({ createdAt: -1 });

    res.json(sales);
  } catch (err) {
    console.error("❌ Load sales error:", err);
    res.status(500).json({ message: "Failed to load sales" });
  }
});

// Add new sale
router.post("/:projectId", auth, async (req, res) => {
  try {
    const { reason, amount } = req.body;

    const sale = await Sale.create({
      project: req.params.projectId,
      reason,
      amount,
    });

    res.json(sale);
  } catch (err) {
    console.error("❌ Add sale error:", err);
    res.status(500).json({ message: "Failed to add sale" });
  }
});

module.exports = router;
