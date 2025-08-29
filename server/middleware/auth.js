const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found'
      });
    }

    if (!req.user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    // Update user activity (for online status tracking)
    req.user.lastActivity = new Date();
    req.user.isOnline = true;
    await req.user.save();

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token failed'
    });
  }
};

// Admin only middleware - must be used after protect
const adminOnly = (req, res, next) => {
  // Check if request is from localhost
  const clientIP = req.ip || req.connection.remoteAddress;
  const isLocalhost = clientIP === '::1' || 
                     clientIP === '127.0.0.1' || 
                     clientIP === '::ffff:127.0.0.1' ||
                     clientIP.includes('127.0.0.1') ||
                     clientIP.includes('localhost');
  
  if (!isLocalhost) {
    return res.status(403).json({
      success: false,
      message: 'Admin access only available from localhost'
    });
  }
  
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  next();
};

// User only middleware - restrict admin from mobile routes
const userOnly = (req, res, next) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({
      success: false,
      message: 'This endpoint is for regular users only'
    });
  }
  
  next();
};

module.exports = {
  protect,
  adminOnly,
  userOnly
};
