const User = require('../models/User');
const Group = require('../models/Group');
const { generateToken } = require('../config/jwt');
const { sendEmail } = require('../config/email');
const crypto = require('crypto');

exports.register = async (req, res) => {
  try {
    const { name, email, password, passwordConfirm, referralCode } = req.body;

    if (!name || !email || !password || !passwordConfirm) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Determinar admin asignado
    let parentAdminId = null;
    let groupId = null;

    if (referralCode) {
      // Buscar admin por código referencia
      const referralAdmin = await User.findOne({ referralCode });
      if (!referralAdmin) {
        return res.status(400).json({ error: 'Invalid referral code' });
      }
      parentAdminId = referralAdmin._id;
    } else {
      // Asignar admin con menos miembros (si existen admins)
      const admins = await User.find({ role: 'admin' });
      if (admins.length > 0) {
        // Contar miembros por admin
        const adminStats = await Promise.all(
          admins.map(async (admin) => ({
            adminId: admin._id,
            memberCount: await User.countDocuments({ parentAdminId: admin._id }),
          }))
        );
        // Encontrar el admin con menos miembros
        const minAdmin = adminStats.reduce((prev, current) =>
          prev.memberCount < current.memberCount ? prev : current
        );
        parentAdminId = minAdmin.adminId;
      }
    }

    // Crear o encontrar grupo para el nuevo usuario
    if (parentAdminId) {
      // Buscar grupo activo del admin con espacio disponible
      let group = await Group.findOne({
        adminId: parentAdminId,
        status: 'active',
        $expr: { $lt: [{ $size: '$members' }, '$maxMembers'] },
      });

      if (!group) {
        // Si no hay grupo con espacio, crear uno nuevo
        group = new Group({
          adminId: parentAdminId,
          name: `Group ${new Date().toISOString().split('T')[0]} - ${new Date().getTime()}`,
          members: [],
          maxMembers: 50,
        });
        await group.save();
      }
      groupId = group._id;
    }

    const user = new User({
      name,
      email,
      password,
      emailVerificationToken,
      emailVerificationTokenExpires,
      parentAdminId,
      groupId,
      referralCodeUsed: referralCode || null,
    });

    await user.save();

    // Agregar usuario al grupo
    if (groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $push: { members: user._id },
      });
    }

    const verificationLink = `${process.env.CLIENT_URL}/verify-email/${emailVerificationToken}`;
    await sendEmail(
      email,
      'Verify your EnergiaPro email',
      `<p>Hello ${name},</p>
       <p>Click the link below to verify your email:</p>
       <a href="${verificationLink}">${verificationLink}</a>
       <p>This link expires in 24 hours.</p>`
    );

    res.status(201).json({
      message: 'User registered. Please verify your email.',
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Please verify your email first' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        totalInvested: user.totalInvested,
        totalEarnings: user.totalEarnings,
        withdrawnAmount: user.withdrawnAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetToken = passwordResetToken;
    user.passwordResetTokenExpires = passwordResetTokenExpires;
    await user.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${passwordResetToken}`;
    await sendEmail(
      email,
      'Reset your EnergiaPro password',
      `<p>Click the link below to reset your password:</p>
       <a href="${resetLink}">${resetLink}</a>
       <p>This link expires in 1 hour.</p>`
    );

    res.json({ message: 'Password reset link sent to email' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, passwordConfirm } = req.body;

    if (password !== passwordConfirm) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        totalInvested: user.totalInvested,
        totalEarnings: user.totalEarnings,
        withdrawnAmount: user.withdrawnAmount,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
