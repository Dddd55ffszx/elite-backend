const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    console.log('🔐 Auth Middleware - Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    });

    const header = req.headers.authorization;

    if (!header) {
      console.log('❌ No authorization header');
      return res.status(401).json({ 
        success: false,
        message: "No token provided" 
      });
    }

    const token = header.split(" ")[1];
    console.log('📦 Token received:', token ? token.substring(0, 20) + '...' : 'none');

    if (!token) {
      console.log('❌ Invalid token format - no token after Bearer');
      return res.status(401).json({ 
        success: false,
        message: "Invalid token format" 
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token verified. Decoded:', decoded);

      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.log('❌ User not found for id:', decoded.id);
        return res.status(401).json({ 
          success: false,
          message: "User not found" 
        });
      }

      console.log('✅ User found:', { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        isApproved: user.isApproved 
      });

      // Check if user is approved (unless they're admin)
      if (!user.isApproved && user.role !== 'admin') {
        console.log('❌ User not approved:', user.email);
        return res.status(403).json({ 
          success: false,
          message: "Your account is pending approval" 
        });
      }

      req.user = user;
      req.userId = user._id;

      console.log('✅ Authentication successful for:', user.email);
      next();
    } catch (jwtError) {
      console.error('❌ JWT Error:', {
        name: jwtError.name,
        message: jwtError.message,
        token: token.substring(0, 20) + '...'
      });
      
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
    console.error('❌ Auth middleware unexpected error:', err);
    return res.status(401).json({ 
      success: false,
      message: "Authentication failed" 
    });
  }
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  console.log('👑 Admin check:', { 
    user: req.user ? req.user.email : 'none',
    role: req.user ? req.user.role : 'none'
  });
  
  if (req.user && req.user.role === 'admin') {
    console.log('✅ Admin access granted');
    next();
  } else {
    console.log('❌ Admin access denied');
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }
};

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;