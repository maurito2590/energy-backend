const Withdrawal = require('../models/Withdrawal');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getAdminUserIds } = require('../utils/adminHelpers');

exports.createWithdrawal = async (req, res) => {
  try {
    const { transactionId, firstName, lastName, dni, cbvCvu } = req.body;
    const userId = req.user._id;

    // Validate transaction exists and belongs to user
    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.userId.toString() !== userId.toString()) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    // Check if transaction period has ended
    const now = new Date();
    if (now <= new Date(transaction.endDate)) {
      return res.status(400).json({ error: 'El período de inversión aún no ha finalizado' });
    }

    // Check if withdrawal already exists for this transaction
    const existingWithdrawal = await Withdrawal.findOne({ 
      transactionId,
      status: { $ne: 'rejected' }
    });
    if (existingWithdrawal) {
      return res.status(400).json({ error: 'Ya existe una solicitud de retiro para esta inversión' });
    }

    const withdrawal = new Withdrawal({
      userId,
      transactionId,
      amount: transaction.amount,
      firstName,
      lastName,
      dni,
      cbvCvu,
      status: 'pending',
    });

    await withdrawal.save();

    res.status(201).json({
      withdrawal,
      message: 'Solicitud de retiro creada. Pendiente de aprobación del administrador.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserWithdrawals = async (req, res) => {
  try {
    const userId = req.user._id;
    const withdrawals = await Withdrawal.find({ userId })
      .populate('transactionId')
      .sort({ createdAt: -1 });
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAdminWithdrawals = async (req, res) => {
  try {
    const adminId = req.user._id;
    const { status } = req.query;
    
    const query = { status: { $ne: 'rejected' } };
    if (status) query.status = status;

    let withdrawals;
    if (req.user.role === 'super_admin') {
      withdrawals = await Withdrawal.find(query)
        .populate('userId', 'name email')
        .populate({
          path: 'transactionId',
          select: 'amount productCode',
        })
        .sort({ createdAt: -1 });
    } else {
      // Get users under this admin using helper
      const userIds = await getAdminUserIds(adminId);
      
      withdrawals = await Withdrawal.find({ 
        ...query,
        userId: { $in: userIds }
      })
        .populate('userId', 'name email')
        .populate({
          path: 'transactionId',
          select: 'amount productCode',
        })
        .sort({ createdAt: -1 });
    }

    res.json(withdrawals);
  } catch (error) {
    console.error('getAdminWithdrawals error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const withdrawal = await Withdrawal.findById(id);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Retiro no encontrado' });
    }

    withdrawal.status = 'finalized';
    withdrawal.approvedBy = req.user._id;
    withdrawal.processedDate = new Date();
    await withdrawal.save();

    // Update transaction status
    const transaction = await Transaction.findByIdAndUpdate(
      withdrawal.transactionId,
      { status: 'completed' },
      { new: true }
    );

    res.json({
      withdrawal,
      message: 'Retiro aprobado y finalizado.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.rejectWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const withdrawal = await Withdrawal.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        rejectionReason: reason,
        approvedBy: req.user._id,
        processedDate: new Date(),
      },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(404).json({ error: 'Retiro no encontrado' });
    }

    res.json({
      withdrawal,
      message: 'Retiro rechazado.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
