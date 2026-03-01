const express = require('express');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
} = require('../controllers/productController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', authMiddleware, adminMiddleware, createProduct);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);

module.exports = router;
