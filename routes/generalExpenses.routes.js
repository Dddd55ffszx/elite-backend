const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getGeneralExpenses,
  addGeneralExpense,
  deleteGeneralExpense,
} = require("../controllers/generalExpenseController");

router.get("/", auth, getGeneralExpenses);
router.post("/", auth, addGeneralExpense);
router.delete("/:id", auth, deleteGeneralExpense);

module.exports = router;