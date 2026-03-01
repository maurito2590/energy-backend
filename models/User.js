const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'super_admin'],
      default: 'user',
    },
    // Campos para administradores
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Permite null pero no duplicados
    },
    parentAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null si es super_admin, sino referencia al admin padre
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null, // null si es admin, sino referencia al grupo
    },
    // Campo para registro con código referencia
    referralCodeUsed: String,
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: String,
    emailVerificationTokenExpires: Date,
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    totalInvested: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    withdrawnAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
