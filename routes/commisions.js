const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const Commission = require("../models/Commission");

const { logActivity } = require("../utils/activityLogger");

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

    // NOTE: Commissions no longer deduct from the shared balance.
    // Only Expenses and General Expenses affect the balance now.

    logActivity({
      userId: req.userId,
      action: "create",
      entityType: "Commission",
      entityId: commission._id,
      projectId: commission.project,
      description: `Added commission (${label}) of ${numericAmount} EGP`,
    });

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

    // Delete actual commission.
    // (Commissions no longer touch the shared balance, so there is
    // no balance history to reverse here.)
    await Commission.findByIdAndDelete(
      commission._id
    );

    logActivity({
      userId: req.userId,
      action: "delete",
      entityType: "Commission",
      entityId: commission._id,
      projectId: commission.project,
      description: `Deleted commission (${commission.label}) of ${commission.amount} EGP`,
    });

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