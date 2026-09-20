const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");

// ============================================================
// LOG ACTIVITY
//
// Fire-and-forget logger used across controllers to record who
// did what and when (create / update / delete / login). Never
// throws — a logging failure should never break the actual
// request it's attached to.
// ============================================================

async function logActivity({
  userId,
  user, // optional pre-loaded user doc, to avoid an extra lookup
  action,
  entityType = "",
  entityId = null,
  description = "",
}) {
  try {
    let userDoc = user || null;

    if (!userDoc && userId) {
      userDoc = await User.findById(userId).select("name email");
    }

    await ActivityLog.create({
      user: userId || userDoc?._id || null,
      userName: userDoc?.name || "Unknown",
      userEmail: userDoc?.email || "",
      action,
      entityType,
      entityId,
      description,
    });
  } catch (err) {
    // Never let logging failures break the calling request.
    console.error("Activity log error:", err.message);
  }
}

module.exports = { logActivity };
