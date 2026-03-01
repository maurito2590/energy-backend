const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null, // null para grupos de usuarios, productId para grupos de compras
    },
    name: {
      type: String,
      required: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    maxMembers: {
      type: Number,
      default: 50,
    },
    totalInvested: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Índice para búsquedas rápidas
groupSchema.index({ adminId: 1 });
groupSchema.index({ 'members': 1 });

module.exports = mongoose.model('Group', groupSchema);
