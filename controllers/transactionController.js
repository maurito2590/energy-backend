const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const User = require('../models/User');
const Group = require('../models/Group');

exports.createTransaction = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    // No permitir que admins compren productos
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(403).json({ error: 'Los administradores no pueden comprar productos' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const dailyIncome = product.initialPrice * product.dailyIncomeRate;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + product.duration);

    // Buscar o crear grupo para este producto bajo el admin del usuario
    let productGroup = null;
    
    if (user.parentAdminId) {
      // Buscar grupo activo del admin para este producto con espacio disponible
      productGroup = await Group.findOne({
        adminId: user.parentAdminId,
        productId: productId,
        status: 'active',
        $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] },
      });

      // Si no existe grupo, crearlo
      if (!productGroup) {
        productGroup = new Group({
          adminId: user.parentAdminId,
          productId: productId,
          name: `${product.name} - ${new Date().toISOString().split('T')[0]}`,
          members: [],
          maxMembers: 50,
        });
        await productGroup.save();
      }
    }

    const transaction = new Transaction({
      userId,
      productId,
      groupId: productGroup ? productGroup._id : null,
      productCode: product.productCode,
      amount: product.initialPrice,
      dailyIncome,
      totalExpectedIncome: product.totalIncome,
      endDate,
      currentEarnings: 0,
    });

    await transaction.save();

    // Agregar usuario al grupo
    if (productGroup) {
      await Group.findByIdAndUpdate(productGroup._id, {
        $push: { members: userId },
        $inc: { totalInvested: product.initialPrice },
      });

      // Si el grupo está completo, cerrarlo
      const updatedGroup = await Group.findById(productGroup._id);
      if (updatedGroup.members.length >= updatedGroup.maxMembers) {
        updatedGroup.status = 'closed';
        await updatedGroup.save();
      }
    }

    // Update user totals
    const updatedUser = await User.findById(userId);
    updatedUser.totalInvested += product.initialPrice;
    await updatedUser.save();

    res.status(201).json({
      transaction,
      groupId: productGroup ? productGroup._id : null,
      message: 'Transaction created. Waiting for payment confirmation.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const transactions = await Transaction.find({ userId })
      .populate('productId')
      .sort({ createdAt: -1 });

    const transactionsWithEarnings = transactions.map((tx) => ({
      ...tx.toObject(),
      currentEarnings: tx.calculateCurrentEarnings(),
    }));

    res.json(transactionsWithEarnings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('productId');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      ...transaction.toObject(),
      currentEarnings: transaction.calculateCurrentEarnings(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTransactionStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (status === 'completed') {
      const currentEarnings = transaction.calculateCurrentEarnings();
      const user = await User.findById(transaction.userId);
      user.totalEarnings += currentEarnings;
      await user.save();
    }

    res.json({
      ...transaction.toObject(),
      currentEarnings: transaction.calculateCurrentEarnings(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user transactions for admin (admin can see their group members' transactions)
exports.getUserTransactionsForAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user._id;
    const admin = await User.findById(adminId);

    // Only admins can view user transactions
    if (admin.role !== 'admin' && admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // If regular admin, check if user belongs to their group
    if (admin.role === 'admin') {
      const userInGroup = await User.findOne({
        _id: userId,
        parentAdminId: adminId,
      });

      if (!userInGroup) {
        return res.status(403).json({ error: 'User not in your group' });
      }
    }

    const transactions = await Transaction.find({ userId: userId })
      .populate('productId', 'name productCode type')
      .sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    console.error('getUserTransactionsForAdmin error:', error);
    res.status(500).json({ error: error.message });
  }
};
