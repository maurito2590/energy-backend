const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    productCode: String,
    amount: {
      type: Number,
      required: true,
    },
    dailyIncome: {
      type: Number,
      required: true,
    },
    totalExpectedIncome: {
      type: Number,
      required: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: Date,
    currentEarnings: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    paymentMethod: {
      type: String,
      enum: ['mercadopago', 'bank_transfer', 'other'],
      default: 'mercadopago',
    },
    mercadopagoPaymentId: String,
    notes: String,
  },
  { timestamps: true }
);

// Calculate current earnings before every query
transactionSchema.methods.calculateCurrentEarnings = function () {
  if (this.status !== 'active') return this.currentEarnings;

  const now = new Date();
  const startDate = new Date(this.startDate);
  const endDate = new Date(this.endDate);

  if (now < startDate) return 0;
  if (now > endDate) return this.totalExpectedIncome;

  const daysElapsed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  const earnings = this.dailyIncome * daysElapsed;

  return Math.min(earnings, this.totalExpectedIncome);
};

module.exports = mongoose.model('Transaction', transactionSchema);
