const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const Commission = require("../models/Commission");

const {
  adjustBalance,
  deleteBalanceHistoryForCommission,
} = require("../utils/balanceHelper");

// ============================================================
// GET COMMISSIONS
// ============================================================

router.get("/:projectId", auth, async (req, res) => {
  try {
    const commissions = await Commission.find({
      project: req.params.projectId,
    }).sort({ date: -1 });

    res.json({
      success: true,
      commissions,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================================================
// ADD COMMISSION
// ============================================================

router.post("/:projectId", auth, async (req, res) => {
  try {
    const {
      amount,
      date,
      label,
      apartmentId,
    } = req.body;

    const numericAmount = Number(amount);

    if (
      Number.isNaN(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        message: "Valid amount required",
      });
    }

    if (!date) {
      return res.status(400).json({
        message: "Date required",
      });
    }

    if (!label) {
      return res.status(400).json({
        message: "Label required",
      });
    }

    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        message: "Invalid date",
      });
    }

    const commissionData = {
      project: req.params.projectId,
      amount: numericAmount,
      date: parsedDate,
      label,
      user: req.userId,
      apartment: apartmentId || null,
    };

    const commission = await Commission.create(
      commissionData
    );

    try {
      await adjustBalance({
        userId: req.userId,

        // Commission is money leaving the company.
        amount: -numericAmount,

        type: "commission",

        description: `Commission (${label})`,

        date: parsedDate,

        project: req.params.projectId,

        // VERY IMPORTANT
        commission: commission._id,
      });
    } catch (balanceErr) {
      // Don't leave commission without balance history.
      await Commission.findByIdAndDelete(
        commission._id
      );

      throw balanceErr;
    }

    res.json({
      success: true,
      commission,
    });
  } catch (err) {
    console.error("Add commission error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

// ============================================================
// DELETE COMMISSION
// ============================================================

router.delete("/:id", auth, async (req, res) => {
  try {
    const commission = await Commission.findOne({
      _id: req.params.id,
      user: req.userId,
    });

    if (!commission) {
      return res.status(404).json({
        message: "Commission not found",
      });
    }

    // Restore balance and remove history.
    await deleteBalanceHistoryForCommission(
      commission._id
    );

    // Delete actual commission.
    await Commission.findByIdAndDelete(
      commission._id
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("Delete commission error:", err);

    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;