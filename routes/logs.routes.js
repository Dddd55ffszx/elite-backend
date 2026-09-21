const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const ActivityLog = require("../models/ActivityLog");

// ============================================================
// GET ACTIVITY LOGS
//
// Returns the full activity feed (logins + create/update/delete
// actions), newest first. This is the data behind the password-
// gated Logs page in the sidebar.
// ============================================================
router.get("/", auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 2000);

    const logs = await ActivityLog.find({})
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .populate("project", "name");

    res.json({ success: true, logs });
  } catch (err) {
    console.error("Get logs error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
