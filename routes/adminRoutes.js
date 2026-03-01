const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getAdminDashboard,
  getAdminUsers,
  getAdminUserDetail,
  updateUserStatus,
  createAdmin,
  getAllAdmins,
  deleteAdmin,
  getProductGroups,
  getUserGroups,
  createProduct,
  getAllProducts,
  updateProduct,
  toggleFeaturedProduct,
  deleteProduct,
  restoreProduct,
  getFeaturedProducts,
  getAdminEarningsStats,
  getProductGroupUsers,
} = require('../controllers/adminController');
const { getUserTransactionsForAdmin } = require('../controllers/transactionController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();

// Rate limiter para proteger endpoints sensibles
const createProductLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Too many requests, please try again later',
  standardHeaders: true,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // máximo 60 requests por IP
  message: 'Too many requests, please try again later',
});

// Todas las rutas requieren autenticación y rol admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard
router.get('/dashboard', getAdminDashboard);
router.get('/earnings-stats', getAdminEarningsStats);
router.get('/product-group-users', getProductGroupUsers);

// Usuarios
router.get('/users', getAdminUsers);
router.get('/users/:userId', getAdminUserDetail);
router.get('/users/:userId/investments', getUserTransactionsForAdmin);
router.patch('/users/:userId/status', updateUserStatus);

// Grupos
router.get('/groups/products', getProductGroups);
router.get('/groups/users', getUserGroups);

// Productos (solo super_admin) - Con rate limiting
router.post('/products', createProductLimiter, createProduct);
router.get('/products', getAllProducts);
router.get('/products/featured', getFeaturedProducts);
router.patch('/products/:productId', adminLimiter, updateProduct);
router.patch('/products/:productId/featured', adminLimiter, toggleFeaturedProduct);
router.delete('/products/:productId', adminLimiter, deleteProduct);
router.patch('/products/:productId/restore', adminLimiter, restoreProduct);

// Solo super admin
router.post('/admins', adminLimiter, createAdmin);
router.get('/admins', getAllAdmins);
router.delete('/admins/:adminId', adminLimiter, deleteAdmin);

module.exports = router;
