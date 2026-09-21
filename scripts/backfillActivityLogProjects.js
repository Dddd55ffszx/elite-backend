/**
 * ONE-TIME BACKFILL SCRIPT
 *
 * Every activity log recorded before the "project" field was added
 * to ActivityLog has no project attached, so it shows "—" on the
 * Logs page and won't match the project filter. This script fixes
 * existing entries by looking up the project through the record
 * each log already points to (entityId), and only touches logs
 * that don't already have a project set.
 *
 * Run once, from the server/ folder:
 *   node scripts/backfillActivityLogProjects.js
 *
 * It reads MONGO_URI from your existing .env, same as server.js.
 * Safe to run more than once — it skips logs that already have a
 * project.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const ActivityLog = require("../models/ActivityLog");
const Expense = require("../models/Expense");
const Apartment = require("../models/Apartment");
const Commission = require("../models/Commission");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const logsToFix = await ActivityLog.find({
    project: null,
    entityType: { $in: ["Expense", "Apartment", "Payment", "Commission", "Project"] },
    entityId: { $ne: null },
  });

  console.log(`Found ${logsToFix.length} log entries missing a project`);

  let updated = 0;
  let skipped = 0;

  for (const log of logsToFix) {
    let projectId = null;

    try {
      if (log.entityType === "Project") {
        // The entity itself IS the project.
        projectId = log.entityId;
      } else if (log.entityType === "Expense") {
        const expense = await Expense.findById(log.entityId).select("project");
        projectId = expense?.project || null;
      } else if (log.entityType === "Apartment" || log.entityType === "Payment") {
        // For payments, entityId was logged as the apartment's _id.
        const apartment = await Apartment.findById(log.entityId).select("project");
        projectId = apartment?.project || null;
      } else if (log.entityType === "Commission") {
        const commission = await Commission.findById(log.entityId).select("project");
        projectId = commission?.project || null;
      }
    } catch (err) {
      console.error(`Could not resolve project for log ${log._id}:`, err.message);
    }

    if (projectId) {
      log.project = projectId;
      await log.save();
      updated++;
    } else {
      // The underlying record (e.g. a deleted expense/apartment) is
      // gone, so there's nothing to backfill it from.
      skipped++;
    }
  }

  console.log(`Backfilled ${updated} log entries. Skipped ${skipped} (no matching record found).`);

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});