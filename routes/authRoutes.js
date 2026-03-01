const express = require('express');
const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getProfile,
} = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;
