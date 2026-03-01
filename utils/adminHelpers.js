const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

/**
 * Validar si el usuario es super_admin o admin
 */
const validateAdminAccess = async (adminId) => {
  const admin = await User.findById(adminId);
  if (!admin || (admin.role !== 'admin' && admin.role !== 'super_admin')) {
    return null;
  }
  return admin;
};

/**
 * Validar permisos de admin sobre usuario
 */
const validateUserAccess = (admin, user) => {
  if (admin.role === 'super_admin') return true;
  if (admin.role === 'admin' && user.parentAdminId?.toString() === admin._id.toString()) {
    return true;
  }
  return false;
};

/**
 * Obtener usuarios según rol del admin (todos si super_admin, solo los suyos si admin)
 */
const getAdminUsers = async (adminId, role = 'user') => {
  const admin = await User.findById(adminId);
  
  if (admin.role === 'super_admin') {
    return await User.find({ role }).select('-password');
  } else {
    return await User.find({ parentAdminId: adminId, role }).select('-password');
  }
};

/**
 * Obtener IDs de usuarios según rol del admin
 */
const getAdminUserIds = async (adminId) => {
  const users = await getAdminUsers(adminId);
  return users.map(u => u._id);
};

/**
 * Calcular ganancias totales de usuario
 */
const calculateUserEarnings = async (userId) => {
  const transactions = await Transaction.find({ userId });
  return transactions.reduce((sum, tx) => sum + tx.totalExpectedIncome, 0);
};

/**
 * Calcular ganancias de múltiples usuarios
 */
const calculateMultipleUsersEarnings = async (userIds) => {
  const transactions = await Transaction.find({ userId: { $in: userIds } });
  const earningsMap = {};
  
  userIds.forEach(id => earningsMap[id.toString()] = 0);
  
  transactions.forEach(tx => {
    const key = tx.userId.toString();
    earningsMap[key] = (earningsMap[key] || 0) + tx.totalExpectedIncome;
  });
  
  return earningsMap;
};

/**
 * Calcular ganancias totales de un admin
 */
const calculateAdminEarnings = async (adminId) => {
  const userIds = await getAdminUserIds(adminId);
  const transactions = await Transaction.find({ userId: { $in: userIds } });
  return transactions.reduce((sum, tx) => sum + tx.totalExpectedIncome, 0);
};

/**
 * Calcular ganancia actual de una transacción
 */
const calculateCurrentEarning = (transaction) => {
  const now = new Date();
  const startDate = new Date(transaction.startDate);
  const endDate = new Date(transaction.endDate);
  
  if (now < startDate) return 0;
  if (now > endDate) return transaction.totalExpectedIncome;
  
  const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  return transaction.dailyIncome * daysElapsed;
};

/**
 * Enriquecer usuario con datos de transacciones y retiros
 */
const enrichUserWithTransactionData = async (user) => {
  const transactions = await Transaction.find({ userId: user._id });
  const withdrawals = await Withdrawal.find({ userId: user._id });
  
  return {
    ...user.toObject(),
    transactionCount: transactions.length,
    totalTransactionValue: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    withdrawalCount: withdrawals.length,
    pendingWithdrawals: withdrawals.filter((w) => w.status === 'pending').length,
  };
};

/**
 * Validar que el usuario puede acceder a la transacción
 */
const validateWithdrawalAccess = (admin, withdrawal) => {
  if (admin.role === 'super_admin') return true;
  // Para admin regular, validar que el userId pertenezca a sus usuarios
  return withdrawal.userId.parentAdminId?.toString() === admin._id.toString();
};

module.exports = {
  validateAdminAccess,
  validateUserAccess,
  getAdminUsers,
  getAdminUserIds,
  calculateUserEarnings,
  calculateMultipleUsersEarnings,
  calculateAdminEarnings,
  calculateCurrentEarning,
  enrichUserWithTransactionData,
  validateWithdrawalAccess,
};
