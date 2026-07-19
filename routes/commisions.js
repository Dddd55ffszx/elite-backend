const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Commission = require("../models/Commission");
const Apartment = require("../models/Apartment");

// GET /commissions/:projectId  — all commissions for a project
router.get("/:projectId", auth, async (req, res) => {
  try {
    const commissions = await Commission.find({
      project: req.params.projectId,
    }).sort({ date: -1 });
    res.json({ success: true, commissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /commissions/:projectId  — add a commission
router.post("/:projectId", auth, async (req, res) => {
  try {
    const { amount, date, label, apartmentId } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Valid amount required" });
    if (!date)
      return res.status(400).json({ message: "Date required" });
    if (!label)
      return res.status(400).json({ message: "Label required" });

    const commissionData = {
      project: req.params.projectId,
      amount: Number(amount),
      date: new Date(date),
      label,
      user: req.userId,
    };

    // if an apartmentId ObjectId was provided, store it too
    if (apartmentId) commissionData.apartment = apartmentId;

    const commission = await Commission.create(commissionData);
    res.json({ success: true, commission });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /commissions/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await Commission.findOneAndDelete({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;