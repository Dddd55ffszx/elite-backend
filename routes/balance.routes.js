const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getBalance,
  addBalance,
  getHistory,
} = require("../controllers/balanceController");

router.get("/", auth, getBalance);
router.post("/", auth, addBalance);
router.get("/history", auth, getHistory);

module.exports = router;
