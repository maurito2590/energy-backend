const express = require('express');
const {
  createTransaction,
  getUserTransactions,
  getTransactionById,
  updateTransactionStatus,
} = require('../controllers/transactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, createTransaction);
router.get('/', authMiddleware, getUserTransactions);
router.get('/:id', authMiddleware, getTransactionById);
router.put('/:id/status', authMiddleware, adminMiddleware, updateTransactionStatus);

module.exports = router;
