const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { exportProjectToExcel } = require("../controllers/exportController");

// Export project to Excel - matches frontend: /api/export/project/${projectId}
router.get("/project/:projectId", auth, exportProjectToExcel);
const Commission =
  require("../models/Commission");

  
module.exports = router;