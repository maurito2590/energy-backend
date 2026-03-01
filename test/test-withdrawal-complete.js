/**
 * PRUEBA COMPLETA DE RETIRO
 * Crea una transacción con fecha vencida y procesa el retiro
 */

const mongoose = require('mongoose');
const axios = require('axios');

const Transaction = require('./models/Transaction');
const Withdrawal = require('./models/Withdrawal');
const User = require('./models/User');

const API_BASE = 'http://localhost:5000/api';

let testData = {
  userToken: null,
  adminToken: null,
  userId: null,
  transactionId: null
};

async function apiCall(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  };
  if (data) config.data = data;
  
  try {
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return { 
      success: false, 
      status: error.response?.status,
      error: error.response?.data?.error || error.message 
    };
  }
}

async function testCompleteWithdrawalFlow() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      PRUEBA COMPLETA: RETIRO CON PERÍODO VENCIDO          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // PASO 1: LOGIN
    console.log('📝 PASO 1: LOGIN');
    console.log('▶ Autenticando usuario juan@example.com...');
    
    let result = await apiCall('post', '/auth/login', {
      email: 'juan@example.com',
      password: 'User123!'
    });
    
    if (!result.success) {
      console.log('✗ Error en login:', result.error);
      return false;
    }
    
    testData.userToken = result.data.token;
    testData.userId = result.data.user._id;
    console.log('✓ Login exitoso\n');

    // PASO 2: LOGIN ADMIN
    console.log('📝 PASO 2: LOGIN ADMIN');
    console.log('▶ Autenticando admin1@energiapro.com...');
    
    result = await apiCall('post', '/auth/login', {
      email: 'admin1@energiapro.com',
      password: 'Admin123!'
    });
    
    if (!result.success) {
      console.log('✗ Error en login admin:', result.error);
      return false;
    }
    
    testData.adminToken = result.data.token;
    console.log('✓ Login admin exitoso\n');

    // PASO 3: OBTENER PRODUCTO
    console.log('📝 PASO 3: OBTENER PRODUCTO');
    console.log('▶ Obteniendo producto para compra...');
    
    result = await apiCall('get', '/products', null, testData.userToken);
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.log('✗ Error obteniendo productos:', result.error);
      return false;
    }
    
    const product = result.data[0];
    console.log(`✓ Producto: ${product.name} ($${product.initialPrice})\n`);

    // Conectar a MongoDB para crear transacción con fecha vencida
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/energiapro';
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // PASO 4: CREAR TRANSACCIÓN CON PERÍODO VENCIDO
    console.log('📝 PASO 4: COMPRA DEL PRODUCTO (con período ya vencido)');
    console.log('▶ Realizando compra con endDate en el pasado...');
    
    const now = new Date();
    const pastDate = new Date(now.getTime() - 2000); // 2 segundos atrás
    
    // Crear transacción directamente en la BD con período vencido
    const User_Model = User;
    const user = await User_Model.findById(testData.userId);
    
    const transaction = new Transaction({
      userId: testData.userId,
      productId: product._id,
      amount: product.initialPrice,
      startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), // Hace 365 días
      endDate: pastDate, // Ya vencido
      daily_rate: product.daily_rate,
      status: 'completed',
      paymentMethod: 'mercadopago',
      mercadopagoPaymentId: `TEST_${Date.now()}`,
      expectedEarnings: product.expectedEarnings || 0
    });
    
    await transaction.save();
    testData.transactionId = transaction._id;
    
    result = {
      success: true,
      data: { transaction }
    };
    
    if (!result.success) {
      console.log('✗ Error en la compra:', result.error);
      await mongoose.disconnect().catch(() => {});
      return false;
    }
    
    console.log(`✓ Compra exitosa (con período ya vencido)`);
    console.log(`  - Transacción: ${testData.transactionId}`);
    console.log(`  - Monto: $${result.data.transaction.amount}\n`);

    // PASO 5: SOLICITAR RETIRO
    console.log('📝 PASO 5: SOLICITAR RETIRO');
    console.log('▶ Solicitando retiro con período ya vencido...');
    
    const dni = `${Math.floor(Math.random() * 100000000)}`.padStart(8, '0');
    const cvu = `${Math.floor(Math.random() * 10000000000000000000000)}`.padStart(22, '0');
    
    result = await apiCall('post', '/withdrawals', {
      transactionId: testData.transactionId,
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: dni,
      cbvCvu: cvu
    }, testData.userToken);
    
    if (!result.success) {
      console.log('✗ Error al solicitar retiro:', result.error);
      return false;
    }
    
    const withdrawal = result.data.withdrawal;
    console.log(`✓ Retiro solicitado`);
    console.log(`  - ID Retiro: ${withdrawal._id}`);
    console.log(`  - Monto: $${withdrawal.amount}`);
    console.log(`  - Estado: ${withdrawal.status}\n`);

    // PASO 6: ADMIN APRUEBA RETIRO
    console.log('📝 PASO 6: APROBACIÓN POR ADMIN');
    console.log('▶ Admin aprobando retiro...');
    
    result = await apiCall('patch', `/withdrawals/${withdrawal._id}/approve`, {}, testData.adminToken);
    
    if (!result.success) {
      console.log('✗ Error al aprobar retiro:', result.error);
      return false;
    }
    
    console.log(`✓ Retiro aprobado`);
    console.log(`  - Estado nuevo: ${result.data.withdrawal.status}\n`);

    // PASO 7: VERIFICAR RETIRO EN DASHBOARD ADMIN
    console.log('📝 PASO 7: VERIFICAR EN DASHBOARD');
    console.log('▶ Obteniendo retiros pendientes...');
    
    result = await apiCall('get', '/withdrawals/admin', null, testData.adminToken);
    
    if (!result.success) {
      console.log('⚠ No se pudo obtener retiros:', result.error);
    } else {
      const withdrawals = Array.isArray(result.data) ? result.data : result.data.withdrawals || [];
      console.log(`✓ Se obtuvieron ${withdrawals.length} retiros`);
      const approvedWd = withdrawals.find(w => w._id === withdrawal._id);
      if (approvedWd) {
        console.log(`  - Nuestro retiro está en estado: ${approvedWd.status}\n`);
      }
    }

    await mongoose.disconnect();
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ PRUEBA EXITOSA: FLUJO COMPLETO DE RETIRO FUNCIONANDO');
    console.log('════════════════════════════════════════════════════════════\n');
    
    return true;

  } catch (error) {
    console.log('❌ Error:', error.message);
    await mongoose.disconnect().catch(() => {});
    return false;
  }
}

// Ejecutar
testCompleteWithdrawalFlow().then(success => {
  process.exit(success ? 0 : 1);
});
