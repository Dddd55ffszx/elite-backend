const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { getBalance, addBalance } = require("../controllers/balancController");

router.get("/", auth, getBalance);
router.post("/", auth, addBalance);

module.exports = router;