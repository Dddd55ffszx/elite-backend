const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    userName: {
      type: String,
      default: "Unknown",
    },
    userEmail: {
      type: String,
      default: "",
    },
    action: {
      type: String,
      enum: ["login", "create", "update", "delete"],
      required: true,
    },
    entityType: {
      type: String,
      default: "",
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    // Which project this action relates to, when applicable
    // (e.g. an apartment, expense or commission belongs to a
    // project). Left null for actions that aren't project-scoped
    // (logins, general expenses, balance entries).
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    description: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ date: -1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
