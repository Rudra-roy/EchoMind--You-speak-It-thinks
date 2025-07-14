const express = require('express');
const authController = require('../controllers/authController');
const { protect, userOnly } = require('../middleware/auth');

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected user routes
router.get('/me', protect, userOnly, authController.getMe);
router.post('/logout', protect, userOnly, authController.logout);

module.exports = router;
