const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getBalance,
  addBalance,
  getHistory,
  deleteHistoryEntry,
} = require("../controllers/balanceController");

router.get("/", auth, getBalance);
router.post("/", auth, addBalance);
router.get("/history", auth, getHistory);
router.delete("/history/:id", auth, deleteHistoryEntry);

module.exports = router;
