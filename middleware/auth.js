const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({
        success: false,
        message: "No token provided"
      });
    }

    const token = header.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format"
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found"
        });
      }

      // Check if user is approved (unless they're admin)
      if (!user.isApproved && user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: "Your account is pending approval"
        });
      }

      req.user = user;
      req.userId = user._id;

      next();
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: "Invalid token"
        });
      }

      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: "Token expired"
        });
      }

      return res.status(401).json({
        success: false,
        message: "Authentication failed"
      });
    }
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed"
    });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }
};

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;