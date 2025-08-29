const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = { role: 'user' };
    
    // Search filter
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Status filter
    if (req.query.status) {
      query.isActive = req.query.status === 'active';
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Add real-time online status to each user
    const usersWithOnlineStatus = users.map(user => {
      const userObj = user.toObject();
      userObj.isCurrentlyOnline = user.isCurrentlyOnline();
      return userObj;
    });

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      users: usersWithOnlineStatus
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private/Admin
const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's conversation count
    const conversationCount = await Conversation.countDocuments({ userId: user._id });

    res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        conversationCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user conversations
// @route   GET /api/admin/users/:id/conversations
// @access  Private/Admin
const getUserConversations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const conversations = await Conversation.find({ userId: req.params.id })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Conversation.countDocuments({ userId: req.params.id });

    res.status(200).json({
      success: true,
      count: conversations.length,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      conversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res, next) => {
  try {
    // Get basic counts
    const totalUsers = await User.countDocuments({ role: 'user' });
    const activeUsers = await User.countDocuments({ role: 'user', isActive: true });
    
    // Get online users (active within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await User.countDocuments({ 
      role: 'user',
      lastActivity: { $gte: fiveMinutesAgo }
    });
    
    const totalConversations = await Conversation.countDocuments();
    
    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await User.countDocuments({
      role: 'user',
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get message type breakdown
    const messageStats = await Conversation.aggregate([
      { $unwind: '$messages' },
      {
        $group: {
          _id: '$messages.type',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentActivity = await Conversation.countDocuments({
      lastActivity: { $gte: sevenDaysAgo }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        onlineUsers,
        totalConversations,
        recentUsers,
        recentActivity,
        messageTypes: messageStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user status
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private/Admin
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify admin user'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isActive: user.isActive
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add new user
// @route   POST /api/admin/users
// @access  Private/Admin
const addUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create new user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role: role === 'admin' ? 'admin' : 'user',
      isActive: true
    });

    // Return user without password
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: userResponse
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin user'
      });
    }

    // Delete user's conversations and messages
    const conversations = await Conversation.find({ userId: user._id });
    const conversationIds = conversations.map(conv => conv._id);
    
    // Delete messages for these conversations
    await Message.deleteMany({ conversationId: { $in: conversationIds } });
    
    // Delete conversations
    await Conversation.deleteMany({ userId: user._id });
    
    // Delete the user
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User and all associated data deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  getUserConversations,
  getDashboardStats,
  toggleUserStatus,
  addUser,
  deleteUser
};
