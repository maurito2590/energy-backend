require('dotenv').config({ path: __dirname + '/.env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Product = require('./models/Product');
const Group = require('./models/Group');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ MongoDB connected');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Product.deleteMany({});
    await Group.deleteMany({});

    // Create super admin
    const superAdmin = new User({
      name: 'Super Admin EnergiaPro',
      email: 'superadmin@energiapro.com',
      password: 'SuperAdmin123!',
      role: 'super_admin',
      isEmailVerified: true,
      status: 'active',
    });

    // Create regular admins
    const admin1 = new User({
      name: 'Admin Región 1',
      email: 'admin1@energiapro.com',
      password: 'Admin123!',
      role: 'admin',
      referralCode: 'ADMIN001',
      isEmailVerified: true,
      status: 'active',
    });

    const admin2 = new User({
      name: 'Admin Región 2',
      email: 'admin2@energiapro.com',
      password: 'Admin123!',
      role: 'admin',
      referralCode: 'ADMIN002',
      isEmailVerified: true,
      status: 'active',
    });

    // Create test users
    const testUser1 = new User({
      name: 'Juan Pérez',
      email: 'juan@example.com',
      password: 'User123!',
      role: 'user',
      parentAdminId: admin1._id,
      isEmailVerified: true,
      status: 'active',
    });

    const testUser2 = new User({
      name: 'María García',
      email: 'maria@example.com',
      password: 'User123!',
      role: 'user',
      parentAdminId: admin1._id,
      isEmailVerified: true,
      status: 'active',
    });

    const testUser3 = new User({
      name: 'Carlos López',
      email: 'carlos@example.com',
      password: 'User123!',
      role: 'user',
      parentAdminId: admin2._id,
      isEmailVerified: true,
      status: 'active',
    });

    await superAdmin.save();
    await admin1.save();
    await admin2.save();
    await testUser1.save();
    await testUser2.save();
    await testUser3.save();

    // Create groups
    const group1 = new Group({
      adminId: admin1._id,
      name: 'Grupo Región 1 - Enero',
      members: [testUser1._id, testUser2._id],
      maxMembers: 50,
    });

    const group2 = new Group({
      adminId: admin2._id,
      name: 'Grupo Región 2 - Enero',
      members: [testUser3._id],
      maxMembers: 50,
    });

    await group1.save();
    await group2.save();

    // Update users with group assignments
    await User.findByIdAndUpdate(testUser1._id, { groupId: group1._id });
    await User.findByIdAndUpdate(testUser2._id, { groupId: group1._id });
    await User.findByIdAndUpdate(testUser3._id, { groupId: group2._id });

    // Create products
    const products = [
      // Tradicional
      {
        productCode: 'BT001',
        name: 'Planta Térmica - Pequeño',
        type: 'tradicional',
        initialPrice: 5000,
        dailyIncomeRate: 0.0031,
        duration: 365,
        totalIncome: 5657.5,
        icon: '⚡',
        isActive: true,
        createdBy: superAdmin._id,
      },
      {
        productCode: 'BT005',
        name: 'Planta Térmica - Mediano',
        type: 'tradicional',
        initialPrice: 10000,
        dailyIncomeRate: 0.0032,
        duration: 365,
        totalIncome: 11680,
        icon: '⚡',
        isActive: true,
        createdBy: superAdmin._id,
      },
      {
        productCode: 'BT010',
        name: 'Planta Térmica - Grande',
        type: 'tradicional',
        initialPrice: 20000,
        dailyIncomeRate: 0.0034,
        duration: 365,
        totalIncome: 24820,
        icon: '⚡',
        isActive: true,
        createdBy: superAdmin._id,
      },

      // Limpia
      {
        productCode: 'BP001',
        name: 'Panel Solar - Pequeño',
        type: 'limpia',
        initialPrice: 6000,
        dailyIncomeRate: 0.0033,
        duration: 365,
        totalIncome: 7227,
        icon: '☀️',
        isActive: true,
        createdBy: superAdmin._id,
      },
      {
        productCode: 'BP005',
        name: 'Turbina Eólica - Mediana',
        type: 'limpia',
        initialPrice: 12000,
        dailyIncomeRate: 0.00347,
        duration: 365,
        totalIncome: 15184,
        icon: '💨',
        isActive: true,
        createdBy: superAdmin._id,
      },
      {
        productCode: 'BP010',
        name: 'Parque Solar Completo',
        type: 'limpia',
        initialPrice: 25000,
        dailyIncomeRate: 0.0035,
        duration: 365,
        totalIncome: 31937.5,
        icon: '☀️',
        isActive: true,
        createdBy: superAdmin._id,
      },
    ];

    await Product.insertMany(products);

    console.log('✓ Database seeded successfully!');
    console.log('\n--- TEST CREDENTIALS ---');
    console.log('\nSUPER ADMIN:');
    console.log('Email: superadmin@energiapro.com');
    console.log('Password: SuperAdmin123!');
    console.log('\nADMIN 1:');
    console.log('Email: admin1@energiapro.com');
    console.log('Password: Admin123!');
    console.log('Referral Code: ADMIN001');
    console.log('\nADMIN 2:');
    console.log('Email: admin2@energiapro.com');
    console.log('Password: Admin123!');
    console.log('Referral Code: ADMIN002');
    console.log('\nTEST USER 1 (under Admin 1):');
    console.log('Email: juan@example.com');
    console.log('Password: User123!');
    console.log('\nTEST USER 2 (under Admin 1):');
    console.log('Email: maria@example.com');
    console.log('Password: User123!');
    console.log('\nTEST USER 3 (under Admin 2):');
    console.log('Email: carlos@example.com');
    console.log('Password: User123!');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

connectDB().then(() => seedData());
