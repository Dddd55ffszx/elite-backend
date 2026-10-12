const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  getGeneralExpenses,
  addGeneralExpense,
  deleteGeneralExpense,
  redistributeGeneralExpenses,
} = require("../controllers/generalExpenseController");

router.get("/", auth, getGeneralExpenses);
router.post("/", auth, addGeneralExpense);
router.delete("/:id", auth, deleteGeneralExpense);
router.post("/redistribute", auth, redistributeGeneralExpenses);

module.exports = router;