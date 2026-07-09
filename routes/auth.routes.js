const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

// TEST ROUTE
router.get("/test", (req, res) => {
  res.json({ 
    success: true,
    message: "Auth routes working",
    timestamp: new Date().toISOString()
  });
});

// PUBLIC ROUTES
router.post("/login", authController.login);

// PROTECTED ROUTES (require authentication)
router.get("/me", authMiddleware, authController.getCurrentUser);
router.post("/logout", authMiddleware, authController.logout);

module.exports = router;