const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    // Datos filiatorios del usuario
    firstName: String,
    lastName: String,
    dni: String,
    cbvCvu: String,
    status: {
      type: String,
      enum: ['pending', 'finalized', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: String,
    processedDate: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
