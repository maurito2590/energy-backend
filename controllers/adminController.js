const User = require('../models/User');
const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');
const crypto = require('crypto');
const { sendEmail } = require('../config/email');
const {
  calculateAdminEarnings,
  getAdminUserIds,
  enrichUserWithTransactionData,
  calculateUserEarnings,
} = require('../utils/adminHelpers');

// Obtener dashboard del admin (solo ve sus usuarios)
exports.getAdminDashboard = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    if (admin.role === 'super_admin') {
      // Super admin ve estadísticas globales
      const totalUsers = await User.countDocuments({ role: 'user' });
      const totalAdmins = await User.countDocuments({ role: 'admin' });
      const totalGroups = await Group.countDocuments();
      
      const allTransactions = await Transaction.find();
      const totalInvested = allTransactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalEarnings = allTransactions.reduce((sum, tx) => sum + tx.totalExpectedIncome, 0);

      res.json({
        adminType: 'super_admin',
        totalUsers,
        totalAdmins,
        totalGroups,
        totalInvested,
        totalEarnings,
      });
    } else {
      // Admin regular ve solo sus usuarios
      const users = await User.find({ parentAdminId: adminId });
      const groups = await Group.find({ adminId });

      const userIds = users.map((u) => u._id);
      const transactions = await Transaction.find({ userId: { $in: userIds } });

      const totalInvested = transactions.reduce((sum, tx) => sum + tx.amount, 0);
      const totalEarnings = transactions.reduce((sum, tx) => sum + tx.totalExpectedIncome, 0);

      res.json({
        adminType: 'admin',
        totalUsers: users.length,
        totalGroups: groups.length,
        totalInvested,
        totalEarnings,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos los usuarios que administra
exports.getAdminUsers = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    let users;
    if (admin.role === 'super_admin') {
      // Super admin ve todos los usuarios
      users = await User.find({ role: 'user' }).select('-password');
    } else {
      // Admin regular ve solo sus usuarios
      users = await User.find({ parentAdminId: adminId }).select('-password');
    }

    // Agregar datos de transacciones y retiros
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const transactions = await Transaction.find({ userId: user._id });
        const withdrawals = await Withdrawal.find({ userId: user._id });

        return {
          ...user.toObject(),
          transactionCount: transactions.length,
          totalTransactionValue: transactions.reduce((sum, tx) => sum + tx.amount, 0),
          withdrawalCount: withdrawals.length,
          pendingWithdrawals: withdrawals.filter((w) => w.status === 'pending').length,
        };
      })
    );

    res.json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener detalles de un usuario específico
exports.getAdminUserDetail = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validar permisos
    if (admin.role === 'admin' && user.parentAdminId.toString() !== adminId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const transactions = await Transaction.find({ userId }).populate('productId');
    const withdrawals = await Withdrawal.find({ userId });
    const group = user.groupId ? await Group.findById(user.groupId) : null;

    res.json({
      user,
      transactions,
      withdrawals,
      group,
      stats: {
        totalInvested: user.totalInvested,
        totalEarnings: user.totalEarnings,
        withdrawnAmount: user.withdrawnAmount,
        availableBalance: user.totalEarnings - user.withdrawnAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cambiar estado de usuario
exports.updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Validar permisos
    if (admin.role === 'admin' && user.parentAdminId.toString() !== adminId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    user.status = status;
    await user.save();

    res.json({ message: 'User status updated', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo admin (solo super_admin)
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can create admins' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const referralCode = crypto.randomBytes(6).toString('hex').toUpperCase();

    const newAdmin = new User({
      name,
      email,
      password,
      role: 'admin',
      referralCode,
      isEmailVerified: true,
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin created successfully',
      admin: {
        id: newAdmin._id,
        name: newAdmin.name,
        email: newAdmin.email,
        referralCode: newAdmin.referralCode,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos los admins (solo super_admin)
exports.getAllAdmins = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can view all admins' });
    }

    const admins = await User.find({ role: 'admin' }).select('-password');

    const adminsWithStats = await Promise.all(
      admins.map(async (admin) => {
        const userCount = await User.countDocuments({ parentAdminId: admin._id });
        const groupCount = await Group.countDocuments({ adminId: admin._id });
        const totalEarnings = await calculateAdminEarnings(admin._id);

        return {
          ...admin.toObject(),
          userCount,
          groupCount,
          totalEarnings,
        };
      })
    );

    res.json(adminsWithStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar admin (solo super_admin)
exports.deleteAdmin = async (req, res) => {
  try {
    const requester = await User.findById(req.user._id);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can delete admins' });
    }

    const { adminId } = req.params;
    const adminToDelete = await User.findById(adminId);

    if (!adminToDelete) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (adminToDelete.role !== 'admin') {
      return res.status(400).json({ error: 'Can only delete admins, not super admins' });
    }

    // Get users under this admin
    const usersToReassign = await User.find({ parentAdminId: adminId });

    if (usersToReassign.length > 0) {
      // Get all other admins
      const otherAdmins = await User.find({
        role: 'admin',
        _id: { $ne: adminId }
      });

      if (otherAdmins.length === 0) {
        return res.status(400).json({
          error: 'Cannot delete the only admin. There must be at least one admin to reassign users.',
        });
      }

      // Distribute users equally among other admins
      const usersPerAdmin = Math.ceil(usersToReassign.length / otherAdmins.length);

      for (let i = 0; i < usersToReassign.length; i++) {
        const adminIndex = Math.floor(i / usersPerAdmin) % otherAdmins.length;
        usersToReassign[i].parentAdminId = otherAdmins[adminIndex]._id;
        await usersToReassign[i].save();
      }

      // Also reassign product groups
      const groupsToUpdate = await Group.find({ adminId });
      for (const group of groupsToUpdate) {
        // Distribute groups among other admins as well
        const adminIndex = Math.floor(Math.random() * otherAdmins.length);
        group.adminId = otherAdmins[adminIndex]._id;
        await group.save();
      }
    }

    // Delete the admin
    await User.findByIdAndDelete(adminId);

    res.json({
      message: 'Admin deleted successfully. Users and groups have been reassigned.',
      usersReassigned: usersToReassign.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener grupos de productos
exports.getProductGroups = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    let groups;
    if (admin.role === 'super_admin') {
      // Super admin ve todos los grupos de productos
      groups = await Group.find({ productId: { $ne: null } })
        .populate('adminId', 'name email')
        .populate('productId', 'name productCode')
        .sort({ createdAt: -1 });
    } else {
      // Admin regular ve solo sus grupos de productos
      groups = await Group.find({ adminId, productId: { $ne: null } })
        .populate('productId', 'name productCode')
        .sort({ createdAt: -1 });
    }

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener grupos de usuarios (grupos administrativos)
exports.getUserGroups = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    let groups;
    if (admin.role === 'super_admin') {
      // Super admin ve todos los grupos de usuarios
      groups = await Group.find({ productId: null })
        .populate('adminId', 'name email')
        .sort({ createdAt: -1 });
    } else {
      // Admin regular ve solo sus grupos de usuarios
      groups = await Group.find({ adminId, productId: null })
        .populate('members', 'name email')
        .sort({ createdAt: -1 });
    }

    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Crear nuevo producto (solo super_admin)
exports.createProduct = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can create products' });
    }

    const { name, productCode, type, initialPrice, dailyIncomeRate, duration, icon } = req.body;

    // Validaciones - MEJORADAS
    if (!name || !productCode || !type || initialPrice === undefined || dailyIncomeRate === undefined || duration === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validar tipos de datos
    if (typeof name !== 'string' || typeof productCode !== 'string') {
      return res.status(400).json({ error: 'Name and productCode must be strings' });
    }

    if (typeof initialPrice !== 'number' || typeof dailyIncomeRate !== 'number' || typeof duration !== 'number') {
      return res.status(400).json({ error: 'Prices and duration must be numbers' });
    }

    // Validar rangos
    if (initialPrice <= 0 || initialPrice > 10000000) {
      return res.status(400).json({ error: 'Initial price must be between $0.01 and $10,000,000' });
    }

    if (dailyIncomeRate < 0 || dailyIncomeRate > 1) {
      return res.status(400).json({ error: 'Daily income rate must be between 0% and 100%' });
    }

    if (duration <= 0 || duration > 3650) {
      return res.status(400).json({ error: 'Duration must be between 1 and 3650 days (10 years)' });
    }

    // Validar longitudes de strings
    if (name.length < 3 || name.length > 200) {
      return res.status(400).json({ error: 'Product name must be between 3 and 200 characters' });
    }

    if (productCode.length < 2 || productCode.length > 50) {
      return res.status(400).json({ error: 'Product code must be between 2 and 50 characters' });
    }

    // Validar tipo enum
    if (!['tradicional', 'limpia'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "tradicional" or "limpia"' });
    }

    // Validar unicidad de productCode
    const Product = require('../models/Product');
    const existingProduct = await Product.findOne({ productCode });
    if (existingProduct) {
      return res.status(400).json({ error: 'Product code already exists' });
    }

    // Validar icon
    let validIcon = '📦';
    if (icon && typeof icon === 'string' && icon.length <= 2) {
      validIcon = icon;
    }

    // Calcular ingresos totales (usando modelo lineal como está diseñado)
    const totalIncome = parseFloat((initialPrice * (1 + dailyIncomeRate * duration)).toFixed(2));

    const newProduct = new Product({
      name: name.trim(),
      productCode: productCode.trim().toUpperCase(),
      type,
      initialPrice: parseFloat(initialPrice),
      dailyIncomeRate: parseFloat(dailyIncomeRate),
      duration: Math.floor(duration),
      totalIncome,
      icon: validIcon,
      isActive: true,
      createdBy: adminId,
    });

    await newProduct.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener todos los productos (solo super_admin)
exports.getAllProducts = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can view all products' });
    }

    const Product = require('../models/Product');
    const products = await Product.find().sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener estadísticas de ganancias actuales para admin
exports.getAdminEarningsStats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    if (admin.role === 'super_admin') {
      // Super admin: ver ganancias totales, por grupo y por admin
      
      // Total global
      const allTransactions = await Transaction.find({ status: 'active' }).populate('userId').populate('productId').populate('groupId');
      
      let totalCurrentEarnings = 0;
      allTransactions.forEach(tx => {
        const now = new Date();
        const startDate = new Date(tx.startDate);
        const endDate = new Date(tx.endDate);

        if (now >= startDate && now <= endDate) {
          const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          totalCurrentEarnings += tx.dailyIncome * daysElapsed;
        } else if (now > endDate) {
          totalCurrentEarnings += tx.totalExpectedIncome;
        }
      });

      // Por grupo
      const groupEarnings = {};
      allTransactions.forEach(tx => {
        if (tx.groupId) {
          if (!groupEarnings[tx.groupId._id]) {
            groupEarnings[tx.groupId._id] = {
              groupId: tx.groupId._id,
              groupName: tx.groupId.name,
              productName: tx.productId?.name || 'Unknown',
              earnings: 0,
              userCount: 0,
            };
          }

          const now = new Date();
          const startDate = new Date(tx.startDate);
          const endDate = new Date(tx.endDate);

          if (now >= startDate && now <= endDate) {
            const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            groupEarnings[tx.groupId._id].earnings += tx.dailyIncome * daysElapsed;
          } else if (now > endDate) {
            groupEarnings[tx.groupId._id].earnings += tx.totalExpectedIncome;
          }
          groupEarnings[tx.groupId._id].userCount += 1;
        }
      });

      // Por admin
      const admins = await User.find({ role: 'admin' });
      const adminEarnings = await Promise.all(admins.map(async (admin) => {
        const adminUsers = await User.find({ parentAdminId: admin._id });
        const adminUserIds = adminUsers.map(u => u._id);
        const adminTxs = await Transaction.find({ userId: { $in: adminUserIds }, status: 'active' });

        let adminEarning = 0;
        adminTxs.forEach(tx => {
          const now = new Date();
          const startDate = new Date(tx.startDate);
          const endDate = new Date(tx.endDate);

          if (now >= startDate && now <= endDate) {
            const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            adminEarning += tx.dailyIncome * daysElapsed;
          } else if (now > endDate) {
            adminEarning += tx.totalExpectedIncome;
          }
        });

        return {
          adminId: admin._id,
          adminName: admin.name,
          earnings: adminEarning,
          userCount: adminUsers.length,
        };
      }));

      res.json({
        type: 'super_admin',
        totalCurrentEarnings,
        byGroup: Object.values(groupEarnings),
        byAdmin: adminEarnings,
      });
    } else {
      // Admin regular: ver ganancias de sus usuarios
      const adminUsers = await User.find({ parentAdminId: adminId });
      const adminUserIds = adminUsers.map(u => u._id);
      const transactions = await Transaction.find({ userId: { $in: adminUserIds }, status: 'active' }).populate('userId').populate('productId').populate('groupId');

      let totalCurrentEarnings = 0;
      const userEarnings = {};
      const groupEarnings = {};

      transactions.forEach(tx => {
        const now = new Date();
        const startDate = new Date(tx.startDate);
        const endDate = new Date(tx.endDate);

        let earnings = 0;
        if (now >= startDate && now <= endDate) {
          const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          earnings = tx.dailyIncome * daysElapsed;
        } else if (now > endDate) {
          earnings = tx.totalExpectedIncome;
        }

        totalCurrentEarnings += earnings;

        // Por usuario
        if (!userEarnings[tx.userId._id]) {
          userEarnings[tx.userId._id] = {
            userId: tx.userId._id,
            userName: tx.userId.name,
            userEmail: tx.userId.email,
            earnings: 0,
          };
        }
        userEarnings[tx.userId._id].earnings += earnings;

        // Por grupo
        if (tx.groupId) {
          if (!groupEarnings[tx.groupId._id]) {
            groupEarnings[tx.groupId._id] = {
              groupId: tx.groupId._id,
              groupName: tx.groupId.name,
              productName: tx.productId?.name || 'Unknown',
              earnings: 0,
            };
          }
          groupEarnings[tx.groupId._id].earnings += earnings;
        }
      });

      res.json({
        type: 'admin',
        totalCurrentEarnings,
        byUser: Object.values(userEarnings),
        byGroup: Object.values(groupEarnings),
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener lista de usuarios en grupos de productos (para super admin)
exports.getProductGroupUsers = async (req, res) => {
  try {
    const requester = await User.findById(req.user._id);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can view product group users' });
    }

    const groups = await Group.find().populate('adminId', 'name email').populate('productId', 'name productCode');

    const groupsWithUsers = await Promise.all(groups.map(async (group) => {
      const users = await User.find({ groupId: group._id }).select('_id name email totalInvested totalEarnings');
      
      // Calcular ganancias actuales de los usuarios en el grupo
      const transactions = await Transaction.find({ groupId: group._id, status: 'active' });
      let currentGroupEarnings = 0;

      transactions.forEach(tx => {
        const now = new Date();
        const startDate = new Date(tx.startDate);
        const endDate = new Date(tx.endDate);

        if (now >= startDate && now <= endDate) {
          const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
          currentGroupEarnings += tx.dailyIncome * daysElapsed;
        } else if (now > endDate) {
          currentGroupEarnings += tx.totalExpectedIncome;
        }
      });

      return {
        group: {
          _id: group._id,
          name: group.name,
          status: group.status,
          productName: group.productId?.name,
          productCode: group.productId?.productCode,
          admin: {
            _id: group.adminId._id,
            name: group.adminId.name,
            email: group.adminId.email,
          },
          currentEarnings: currentGroupEarnings,
        },
        users: users.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
        userCount: users.length,
      };
    }));

    res.json(groupsWithUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualizar producto (solo super_admin)
exports.updateProduct = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can update products' });
    }

    const { productId } = req.params;
    const { name, initialPrice, dailyIncomeRate, duration, type, icon, isActive } = req.body;

    const Product = require('../models/Product');
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validaciones mejoradas
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 3 || name.length > 200) {
        return res.status(400).json({ error: 'Product name must be a string between 3-200 characters' });
      }
      product.name = name.trim();
    }

    if (initialPrice !== undefined) {
      if (typeof initialPrice !== 'number' || initialPrice <= 0 || initialPrice > 10000000) {
        return res.status(400).json({ error: 'Initial price must be a number between $0.01 and $10,000,000' });
      }
      product.initialPrice = parseFloat(initialPrice);
    }

    if (dailyIncomeRate !== undefined) {
      if (typeof dailyIncomeRate !== 'number' || dailyIncomeRate < 0 || dailyIncomeRate > 1) {
        return res.status(400).json({ error: 'Daily income rate must be between 0% and 100%' });
      }
      product.dailyIncomeRate = parseFloat(dailyIncomeRate);
    }

    if (duration !== undefined) {
      if (typeof duration !== 'number' || duration <= 0 || duration > 3650) {
        return res.status(400).json({ error: 'Duration must be between 1 and 3650 days' });
      }
      product.duration = Math.floor(duration);
    }

    if (type !== undefined) {
      if (!['tradicional', 'limpia'].includes(type)) {
        return res.status(400).json({ error: 'Type must be "tradicional" or "limpia"' });
      }
      product.type = type;
    }

    if (icon !== undefined) {
      if (typeof icon === 'string' && icon.length <= 2) {
        product.icon = icon;
      }
    }

    if (isActive !== undefined) {
      product.isActive = Boolean(isActive);
    }

    // Recalcular ingresos totales si cambió algo
    product.totalIncome = parseFloat((product.initialPrice * (1 + product.dailyIncomeRate * product.duration)).toFixed(2));
    product.updatedBy = adminId;

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Togglear producto como favorito (solo super_admin)
exports.toggleFeaturedProduct = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can feature products' });
    }

    const { productId } = req.params;
    const Product = require('../models/Product');
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Limitar a máximo 6 productos destacados
    if (!product.isFeatured) {
      const featuredCount = await Product.countDocuments({ isFeatured: true, isDeleted: false });
      if (featuredCount >= 6) {
        return res.status(400).json({ error: 'Maximum 6 featured products allowed' });
      }
    }

    product.isFeatured = !product.isFeatured;
    product.updatedBy = adminId;
    await product.save();

    res.json({
      message: `Product ${product.isFeatured ? 'featured' : 'unfeatured'} successfully`,
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Eliminar producto (solo super_admin)
exports.deleteProduct = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can delete products' });
    }

    const { productId } = req.params;
    const Product = require('../models/Product');
    const Transaction = require('../models/Transaction');
    
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check for active transactions
    const activeTransactions = await Transaction.countDocuments({
      productId: productId,
      status: 'active'
    });

    if (activeTransactions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete product with active transactions',
        activeTransactionCount: activeTransactions
      });
    }

    if (product.isDeleted) {
      return res.status(400).json({ error: 'Product already deleted' });
    }

    product.isDeleted = true;
    product.updatedBy = adminId;
    await product.save();

    res.json({
      message: 'Product deleted successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Restaurar producto eliminado (soft delete - solo super_admin)
exports.restoreProduct = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can restore products' });
    }

    const { productId } = req.params;
    const Product = require('../models/Product');
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!product.isDeleted) {
      return res.status(400).json({ error: 'Product is not deleted' });
    }

    product.isDeleted = false;
    product.updatedBy = adminId;
    await product.save();

    res.json({
      message: 'Product restored successfully',
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener productos destacados (para Home/público)
exports.getFeaturedProducts = async (req, res) => {
  try {
    const Product = require('../models/Product');
    const products = await Product.find({ 
      isFeatured: true, 
      isDeleted: false, 
      isActive: true 
    })
    .sort({ createdAt: -1 })
    .limit(6);

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Obtener estadísticas de ganancias del admin/super_admin
exports.getAdminEarningsStats = async (req, res) => {
  try {
    const adminId = req.user._id;
    const requester = await User.findById(adminId);

    let stats = {
      totalCurrentEarnings: 0,
      byGroup: [],
      byUser: [],
      byAdmin: [],
    };

    if (requester.role === 'super_admin') {
      // Super admin ve todas las ganancias del sistema
      const allTransactions = await Transaction.find({ status: 'active' })
        .populate('userId', 'name email')
        .populate('productId', 'name productCode')
        .populate('groupId', 'name status');

      let totalEarnings = 0;
      const groupEarnings = {};
      const adminEarnings = {};

      allTransactions.forEach((tx) => {
        // Calcular ganancias actuales
        const now = new Date();
        const startDate = new Date(tx.startDate);
        const endDate = new Date(tx.endDate);
        let currentEarning = 0;

        if (now >= startDate) {
          if (now > endDate) {
            currentEarning = tx.totalExpectedIncome;
          } else {
            const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            currentEarning = Math.min(tx.dailyIncome * daysElapsed, tx.totalExpectedIncome);
          }
        }

        totalEarnings += currentEarning;

        // Agrupar por grupo
        if (tx.groupId) {
          if (!groupEarnings[tx.groupId._id]) {
            groupEarnings[tx.groupId._id] = {
              groupId: tx.groupId._id,
              groupName: tx.groupId.name,
              productName: tx.productId.name,
              earnings: 0,
              userCount: 0,
            };
          }
          groupEarnings[tx.groupId._id].earnings += currentEarning;
          groupEarnings[tx.groupId._id].userCount += 1;
        }

        // Agrupar por admin del usuario
        if (tx.userId?.parentAdminId) {
          if (!adminEarnings[tx.userId.parentAdminId]) {
            adminEarnings[tx.userId.parentAdminId] = {
              adminId: tx.userId.parentAdminId,
              adminName: '',
              earnings: 0,
              userCount: 0,
            };
          }
          adminEarnings[tx.userId.parentAdminId].earnings += currentEarning;
          adminEarnings[tx.userId.parentAdminId].userCount += 1;
        }
      });

      // Obtener nombres de admins
      const adminIds = Object.keys(adminEarnings);
      if (adminIds.length > 0) {
        const admins = await User.find({ _id: { $in: adminIds } }).select('name');
        admins.forEach((admin) => {
          if (adminEarnings[admin._id]) {
            adminEarnings[admin._id].adminName = admin.name;
          }
        });
      }

      stats = {
        totalCurrentEarnings: totalEarnings,
        byGroup: Object.values(groupEarnings),
        byAdmin: Object.values(adminEarnings),
      };
    } else {
      // Admin regular ve solo las ganancias de sus usuarios
      const myUsers = await User.find({ parentAdminId: adminId });
      const userIds = myUsers.map((u) => u._id);

      const myTransactions = await Transaction.find({
        userId: { $in: userIds },
        status: 'active',
      })
        .populate('userId', 'name email')
        .populate('productId', 'name productCode')
        .populate('groupId', 'name status');

      let totalEarnings = 0;
      const groupEarnings = {};
      const userEarnings = {};

      myTransactions.forEach((tx) => {
        // Calcular ganancias actuales
        const now = new Date();
        const startDate = new Date(tx.startDate);
        const endDate = new Date(tx.endDate);
        let currentEarning = 0;

        if (now >= startDate) {
          if (now > endDate) {
            currentEarning = tx.totalExpectedIncome;
          } else {
            const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
            currentEarning = Math.min(tx.dailyIncome * daysElapsed, tx.totalExpectedIncome);
          }
        }

        totalEarnings += currentEarning;

        // Agrupar por grupo
        if (tx.groupId) {
          if (!groupEarnings[tx.groupId._id]) {
            groupEarnings[tx.groupId._id] = {
              groupId: tx.groupId._id,
              groupName: tx.groupId.name,
              productName: tx.productId.name,
              earnings: 0,
              userCount: 0,
            };
          }
          groupEarnings[tx.groupId._id].earnings += currentEarning;
          groupEarnings[tx.groupId._id].userCount += 1;
        }

        // Agrupar por usuario
        if (tx.userId) {
          if (!userEarnings[tx.userId._id]) {
            userEarnings[tx.userId._id] = {
              userId: tx.userId._id,
              userName: tx.userId.name,
              userEmail: tx.userId.email,
              earnings: 0,
            };
          }
          userEarnings[tx.userId._id].earnings += currentEarning;
        }
      });

      stats = {
        totalCurrentEarnings: totalEarnings,
        byGroup: Object.values(groupEarnings),
        byUser: Object.values(userEarnings),
      };
    }

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtener usuarios en grupos de productos (para super admin)
exports.getProductGroupUsers = async (req, res) => {
  try {
    const requester = await User.findById(req.user._id);

    if (requester.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only super admin can view product group users' });
    }

    // Obtener todos los grupos de productos
    const groups = await Group.find()
      .populate('productId', 'name productCode')
      .populate('adminId', 'name email')
      .lean();

    // Para cada grupo, obtener los usuarios y sus transacciones
    const groupsWithUsers = await Promise.all(
      groups.map(async (group) => {
        // Obtener transacciones de este grupo
        const transactions = await Transaction.find({
          groupId: group._id,
          status: 'active',
        }).populate('userId', '_id name email');

        // Obtener usuarios únicos
        const userMap = {};
        let currentEarnings = 0;

        transactions.forEach((tx) => {
          if (tx.userId) {
            userMap[tx.userId._id] = {
              _id: tx.userId._id,
              name: tx.userId.name,
              email: tx.userId.email,
            };
          }

          // Calcular ganancias actuales
          const now = new Date();
          const startDate = new Date(tx.startDate);
          const endDate = new Date(tx.endDate);

          if (now >= startDate) {
            if (now > endDate) {
              currentEarnings += tx.totalExpectedIncome;
            } else {
              const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
              currentEarnings += Math.min(tx.dailyIncome * daysElapsed, tx.totalExpectedIncome);
            }
          }
        });

        return {
          group: {
            _id: group._id,
            name: group.name,
            productName: group.productId.name,
            productCode: group.productId.productCode,
            admin: group.adminId,
            status: group.status,
            currentEarnings,
          },
          users: Object.values(userMap),
          userCount: Object.keys(userMap).length,
        };
      })
    );

    res.json(groupsWithUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};