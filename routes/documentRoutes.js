const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const upload = require("../config/upload");
const { uploadDocument } = require("../controllers/documentController");

router.post("/", auth, upload.single("file"), uploadDocument);

module.exports = router;
