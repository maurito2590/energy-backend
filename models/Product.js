const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    productCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: ['tradicional', 'limpia'],
      required: true,
    },
    initialPrice: {
      type: Number,
      required: true,
      min: 0.01,
      max: 10000000,
    },
    dailyIncomeRate: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      description: 'Daily income percentage (e.g., 0.033 = 3.3% daily)',
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
      max: 3650,
      description: 'Duration in days',
    },
    totalIncome: {
      type: Number,
      required: true,
      description: 'Total promised income for the period',
    },
    description: {
      type: String,
      maxlength: 1000,
    },
    icon: {
      type: String,
      maxlength: 2,
      default: '📦',
    },
    imageUrl: {
      type: String,
      default: null,
      description: 'URL de imagen del producto',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      description: 'Mostrar en carrusel de inicio',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      description: 'Soft delete - ocultar sin borrar',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Crear índice para búsquedas rápidas
productSchema.index({ productCode: 1 });
productSchema.index({ type: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isDeleted: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ createdAt: -1 });

// Middleware para excluir productos eliminados en queries
productSchema.query.notDeleted = function() {
  return this.where({ isDeleted: false });
};

module.exports = mongoose.model('Product', productSchema);
