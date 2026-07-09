const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Try to load email service, but don't crash if it fails
let emailService;
try {
  emailService = require("../utils/emailService");
  console.log("✅ Email service loaded successfully");
} catch (error) {
  console.log("⚠️ Email service not available, email functions will be disabled");
  emailService = null;
}

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d"
  });
};

// Safe email sending function
const safeSendEmail = async (emailFunction, ...args) => {
  if (emailService && emailService[emailFunction]) {
    try {
      await emailService[emailFunction](...args);
      return true;
    } catch (error) {
      console.log(`⚠️ Email sending failed (${emailFunction}):`, error.message);
      return false;
    }
  }
  return false;
};

// @desc    Register user
// @route   POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Please provide all required fields" 
      });
    }

    // Validate email format
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long"
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this email" 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      isApproved: false,
      role: 'user'
    });

    // Try to send email but don't wait for it
    safeSendEmail('sendApprovalRequestEmail', user).then(sent => {
      if (sent) {
        console.log(`✅ Approval email requested for ${user.email}`);
      }
    });

    res.status(201).json({
      success: true,
      message: "Registration successful! Please wait for admin approval.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during registration" 
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    // Check user - IMPORTANT: Need to select password explicitly
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check if user has password
    if (!user.password) {
      console.error("User found but password field is missing:", user.email);
      return res.status(500).json({ 
        success: false,
        message: "Server error - user data incomplete" 
      });
    }

    // Check password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    
    if (!isPasswordCorrect) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid email or password" 
      });
    }

    // Check if approved
    if (!user.isApproved) {
      return res.status(403).json({ 
        success: false,
        message: "Your account is pending approval. Please wait for admin confirmation." 
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    // Create token
    const token = generateToken(user._id);

    // Send response
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isApproved: user.isApproved
        }
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error during login" 
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isApproved: user.isApproved,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
};

// @desc    Approve user (Admin only)
// @route   PUT /api/auth/users/:userId/approve
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.isApproved) {
      return res.status(400).json({
        success: false,
        message: "User is already approved"
      });
    }

    user.isApproved = true;
    user.approvedBy = req.user?.id;
    user.approvedAt = Date.now();
    await user.save();

    // Try to send email but don't wait
    safeSendEmail('sendApprovalStatusEmail', user.email, 'approved');

    res.status(200).json({
      success: true,
      message: `User ${user.name} has been approved successfully`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error("Approve user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get pending users (Admin only)
// @route   GET /api/auth/users/pending
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ 
      isApproved: false,
      role: 'user'
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error("Get pending users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get all users (Admin only)
// @route   GET /api/auth/users
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// @desc    Get user statistics (Admin only)
// @route   GET /api/auth/stats
exports.getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingUsers = await User.countDocuments({ isApproved: false, role: 'user' });
    const approvedUsers = await User.countDocuments({ isApproved: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsers = await User.countDocuments({
      createdAt: { $gte: lastWeek }
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        pending: pendingUsers,
        approved: approvedUsers,
        admins: adminUsers,
        newThisWeek: newUsers
      }
    });
  } catch (error) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};