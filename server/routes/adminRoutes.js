const express = require('express');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Admin login (public but IP restricted)
router.post('/login', authController.adminLogin);

// Protected admin routes
router.get('/dashboard', protect, adminOnly, adminController.getDashboardStats);
router.get('/me', protect, adminOnly, authController.getMe);

// User Management routes
router.get('/users', protect, adminOnly, adminController.getAllUsers);
router.get('/users/:id', protect, adminOnly, adminController.getUserById);
router.get('/users/:id/conversations', protect, adminOnly, adminController.getUserConversations);
router.put('/users/:id/toggle-status', protect, adminOnly, adminController.toggleUserStatus);

module.exports = router;
