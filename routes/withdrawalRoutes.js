const express = require('express');
const {
  createWithdrawal,
  getUserWithdrawals,
  getAdminWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
} = require('../controllers/withdrawalController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, createWithdrawal);
router.get('/user', authMiddleware, getUserWithdrawals);
router.get('/admin', authMiddleware, adminMiddleware, getAdminWithdrawals);
router.patch('/:id/approve', authMiddleware, adminMiddleware, approveWithdrawal);
router.patch('/:id/reject', authMiddleware, adminMiddleware, rejectWithdrawal);

module.exports = router;
