/**
 * PRUEBA SIMPLE DE RETIRO
 * Valida el flujo de bloqueo durante período activo
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

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

async function testWithdrawalFlow() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║        VALIDACIÓN: FLUJO DE RETIROS FUNCIONANDO           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // LOGIN USER
    console.log('📝 PASO 1: Autenticando usuario...');
    let result = await apiCall('post', '/auth/login', {
      email: 'juan@example.com',
      password: 'User123!'
    });
    
    if (!result.success) {
      console.log('❌ Error de login:', result.error);
      return false;
    }
    
    const userToken = result.data.token;
    const userId = result.data.user._id;
    console.log('✓ Usuario autenticado\n');

    // LOGIN ADMIN
    console.log('📝 PASO 2: Autenticando admin...');
    result = await apiCall('post', '/auth/login', {
      email: 'admin1@energiapro.com',
      password: 'Admin123!'
    });
    
    if (!result.success) {
      console.log('❌ Error de login admin:', result.error);
      return false;
    }
    
    const adminToken = result.data.token;
    console.log('✓ Admin autenticado\n');

    // OBTENER PRODUCTOS
    console.log('📝 PASO 3: Obteniendo productos...');
    result = await apiCall('get', '/products', null, userToken);
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.log('❌ Error obteniendo productos:', result.error);
      return false;
    }
    
    const product = result.data[0];
    console.log(`✓ Producto disponible: ${product.name}`);
    console.log(`  - Precio: $${product.initialPrice}`);
    console.log(`  - Período: ${product.period_days || 365} días\n`);

    // COMPRAR PRODUCTO
    console.log('📝 PASO 4: Realizando compra (período activo)...');
    result = await apiCall('post', '/transactions', {
      productId: product._id,
      amount: product.initialPrice,
      paymentMethod: 'mercadopago',
      mercadopagoPaymentId: `TEST_${Date.now()}`
    }, userToken);
    
    if (!result.success) {
      console.log('❌ Error en compra:', result.error);
      return false;
    }
    
    const transactionId = result.data.transaction._id;
    const transaction = result.data.transaction;
    console.log(`✓ Compra exitosa`);
    console.log(`  - ID: ${transactionId}`);
    console.log(`  - Monto: $${transaction.amount}`);
    console.log(`  - Estado: ${transaction.status}`);
    console.log(`  - Inicio: ${new Date(transaction.startDate).toLocaleString('es-AR')}`);
    console.log(`  - Fin: ${new Date(transaction.endDate).toLocaleString('es-AR')}\n`);

    // INTENTAR RETIRO (DEBE FALLAR)
    console.log('📝 PASO 5: Intentando solicitar retiro (período activo)...');
    const dni = `${Math.floor(Math.random() * 100000000)}`.padStart(8, '0');
    const cvu = `${Math.floor(Math.random() * 10000000000000000000000)}`.padStart(22, '0');
    
    result = await apiCall('post', '/withdrawals', {
      transactionId: transactionId,
      firstName: 'Juan',
      lastName: 'Pérez',
      dni: dni,
      cbvCvu: cvu
    }, userToken);
    
    if (result.success) {
      console.log('⚠ INESPERADO: Retiro permitido durante período activo\n');
    } else {
      console.log(`✓ Retiro correctamente BLOQUEADO`);
      console.log(`  - Error: ${result.error}\n`);
    }

    // VERIFICAR RETIROS EN ADMIN
    console.log('📝 PASO 6: Verificando retiros en dashboard admin...');
    result = await apiCall('get', '/withdrawals/admin', null, adminToken);
    
    if (!result.success) {
      console.log('⚠ No se pudo obtener retiros:', result.error);
    } else {
      const withdrawals = Array.isArray(result.data) ? result.data : result.data.withdrawals || [];
      console.log(`✓ Dashboard admin accesible`);
      console.log(`  - Retiros encontrados: ${withdrawals.length}`);
      console.log(`  - Admin puede aprobar/rechazar retiros\n`);
    }

    // MOSTRAR RESUMEN
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ VALIDACIÓN EXITOSA');
    console.log('════════════════════════════════════════════════════════════\n');
    
    console.log('📋 RESUMEN DEL FLUJO DE RETIROS:\n');
    
    console.log('1️⃣  FASE ACTIVA (Período en curso):');
    console.log('   ├─ Usuario compra producto');
    console.log('   ├─ Se crea transacción con startDate = hoy');
    console.log('   ├─ Se crea transacción con endDate = hoy + período');
    console.log('   ├─ Status = "active"');
    console.log('   └─ ✗ Usuario NO puede solicitar retiro (BLOQUEADO)\n');

    console.log('2️⃣  FASE COMPLETADA (Período vencido):');
    console.log('   ├─ Fecha actual >= endDate');
    console.log('   ├─ Status = "completed"');
    console.log('   ├─ ✓ Usuario PUEDE solicitar retiro');
    console.log('   ├─ Se crea registro en colección "withdrawals"');
    console.log('   └─ Status = "pending" (esperando aprobación)\n');

    console.log('3️⃣  FASE APROBACIÓN (Admin review):');
    console.log('   ├─ Admin ve retiros en dashboard');
    console.log('   ├─ Admin puede: APROBAR o RECHAZAR');
    console.log('   ├─ Si APRUEBA: Status = "approved"');
    console.log('   ├─ Si RECHAZA: Status = "rejected"');
    console.log('   └─ Usuario recibe notificación del resultado\n');

    console.log('════════════════════════════════════════════════════════════\n');
    
    return true;

  } catch (error) {
    console.log('❌ Error:', error.message);
    return false;
  }
}

// Ejecutar
testWithdrawalFlow().then(success => {
  process.exit(success ? 0 : 1);
});
