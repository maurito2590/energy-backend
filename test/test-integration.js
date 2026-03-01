/**
 * INTEGRATION TESTS - EnergiaPro Backend
 * Pruebas exhaustivas de login, CRUD y funcionalidades principales
 */

const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

/**
 * Credenciales de prueba (del seed.js)
 */
const TEST_USERS = {
  superAdmin: {
    email: 'superadmin@energiapro.com',
    password: 'SuperAdmin123!',
    role: 'super_admin'
  },
  admin1: {
    email: 'admin1@energiapro.com',
    password: 'Admin123!',
    role: 'admin'
  },
  user1: {
    email: 'juan@example.com',
    password: 'User123!',
    role: 'user'
  }
};

let tokens = {};

/**
 * Helper para hacer requests con token
 */
const apiCall = async (method, endpoint, data = null, token = null) => {
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
};

/**
 * TEST 1: LOGIN - Todos los roles
 */
async function testLogin() {
  console.log('\n========== TEST 1: LOGIN ==========');
  
  for (const [key, user] of Object.entries(TEST_USERS)) {
    console.log(`\n▶ Testing ${key} (${user.role})...`);
    
    const result = await apiCall('post', '/auth/login', {
      email: user.email,
      password: user.password
    });
    
    if (result.success && result.data.token) {
      tokens[key] = result.data.token;
      console.log(`✓ Login exitoso. Token: ${result.data.token.substring(0, 20)}...`);
    } else {
      console.log(`✗ Login fallido: ${result.error}`);
      return false;
    }
  }
  
  return true;
}

/**
 * TEST 2: CRUD PRODUCTOS (super_admin)
 */
async function testProductsCRUD() {
  console.log('\n========== TEST 2: CRUD PRODUCTOS ==========');
  
  const token = tokens.superAdmin;
  if (!token) {
    console.log('✗ No hay token de super_admin');
    return false;
  }
  
  // CREATE
  console.log('\n▶ CREATE: Crear nuevo producto...');
  const uniqueCode = `TEST-SOLAR-${Date.now()}`;
  const createResult = await apiCall('post', '/admin/products', {
    name: 'Test Product Solar',
    productCode: uniqueCode,
    type: 'limpia',
    initialPrice: 10000,
    dailyIncomeRate: 0.005,
    duration: 90,
    icon: '☀️'
  }, token);
  
  let productId;
  if (createResult.success && createResult.data.product?._id) {
    productId = createResult.data.product._id;
    console.log(`✓ Producto creado: ${productId}`);
  } else {
    console.log(`✗ Error al crear: ${createResult.error}`);
    return false;
  }
  
  // READ
  console.log('\n▶ READ: Obtener productos...');
  const readResult = await apiCall('get', '/admin/products', null, token);
  if (readResult.success && Array.isArray(readResult.data)) {
    console.log(`✓ Se obtuvieron ${readResult.data.length} productos`);
  } else {
    console.log(`✗ Error al leer: ${readResult.error}`);
    return false;
  }
  
  // UPDATE
  console.log('\n▶ UPDATE: Actualizar producto...');
  const updateResult = await apiCall('patch', `/admin/products/${productId}`, {
    name: 'Test Product Solar - Updated',
    dailyIncomeRate: 0.006
  }, token);
  
  if (updateResult.success) {
    console.log(`✓ Producto actualizado`);
  } else {
    console.log(`✗ Error al actualizar: ${updateResult.error}`);
    return false;
  }
  
  // DELETE
  console.log('\n▶ DELETE: Borrar producto...');
  const deleteResult = await apiCall('delete', `/admin/products/${productId}`, null, token);
  if (deleteResult.success) {
    console.log(`✓ Producto borrado`);
  } else {
    console.log(`✗ Error al borrar: ${deleteResult.error}`);
    return false;
  }
  
  return true;
}

/**
 * TEST 3: ADMIN CRUD (super_admin)
 */
async function testAdminsCRUD() {
  console.log('\n========== TEST 3: CRUD ADMINISTRADORES ==========');
  
  const token = tokens.superAdmin;
  if (!token) {
    console.log('✗ No hay token de super_admin');
    return false;
  }
  
  // CREATE
  console.log('\n▶ CREATE: Crear nuevo admin...');
  const createResult = await apiCall('post', '/admin/admins', {
    name: 'Admin Test',
    email: `admintest${Date.now()}@test.com`,
    password: 'TestAdmin123!'
  }, token);
  
  let adminId;
  if (createResult.success && (createResult.data.admin?.id || createResult.data.admin?._id)) {
    adminId = createResult.data.admin.id || createResult.data.admin._id;
    console.log(`✓ Admin creado: ${adminId}`);
  } else {
    console.log(`✗ Error al crear: ${createResult.error}`);
    console.log('Response:', JSON.stringify(createResult.data));
    return false;
  }
  
  // READ ALL
  console.log('\n▶ READ: Obtener todos los admins...');
  const readResult = await apiCall('get', '/admin/admins', null, token);
  if (readResult.success && Array.isArray(readResult.data)) {
    console.log(`✓ Se obtuvieron ${readResult.data.length} administradores`);
  } else {
    console.log(`✗ Error al leer: ${readResult.error}`);
    return false;
  }
  
  // DELETE
  console.log('\n▶ DELETE: Borrar admin...');
  const deleteResult = await apiCall('delete', `/admin/admins/${adminId}`, null, token);
  if (deleteResult.success) {
    console.log(`✓ Admin borrado`);
  } else {
    console.log(`✗ Error al borrar: ${deleteResult.error}`);
    return false;
  }
  
  return true;
}

/**
 * TEST 4: ACCESO DE USUARIOS
 */
async function testUsersAccess() {
  console.log('\n========== TEST 4: ACCESO Y PERMISOS ==========');
  
  const adminToken = tokens.admin1;
  const userToken = tokens.user1;
  
  // Usuario intenta acceder a admin dashboard (debe fallar)
  console.log('\n▶ Usuario intenta acceder a /admin/dashboard...');
  const result = await apiCall('get', '/admin/dashboard', null, userToken);
  if (!result.success && result.status === 403) {
    console.log(`✓ Acceso denegado correctamente (403)`);
  } else {
    console.log(`✗ Debería haber sido denegado pero no fue`);
    return false;
  }
  
  // Admin accede a sus usuarios
  console.log('\n▶ Admin1 accede a su dashboard...');
  const adminResult = await apiCall('get', '/admin/dashboard', null, adminToken);
  if (adminResult.success) {
    console.log(`✓ Admin accedió correctamente`);
  } else {
    console.log(`✗ Error: ${adminResult.error}`);
    return false;
  }
  
  return true;
}

/**
 * TEST 5: TRANSACCIONES Y RETIROS
 */
async function testWithdrawals() {
  console.log('\n========== TEST 5: RETIROS ==========');
  
  const adminToken = tokens.superAdmin;
  
  // Obtener retiros pendientes
  console.log('\n▶ Super admin obtiene retiros pendientes...');
  const result = await apiCall('get', '/withdrawals/admin?status=pending', null, adminToken);
  
  if (result.success && Array.isArray(result.data)) {
    console.log(`✓ Se obtuvieron ${result.data.length} retiros pendientes`);
    return true;
  } else {
    console.log(`✗ Error: ${result.error}`);
    return false;
  }
}

/**
 * TEST 6: PROFILE Y DATOS
 */
async function testProfile() {
  console.log('\n========== TEST 6: PROFILE ==========');
  
  const userToken = tokens.user1;
  
  console.log('\n▶ Usuario obtiene su perfil...');
  const result = await apiCall('get', '/auth/profile', null, userToken);
  
  if (result.success && result.data.user) {
    console.log(`✓ Perfil obtenido: ${result.data.user.name}`);
    console.log(`  - Email: ${result.data.user.email}`);
    console.log(`  - Role: ${result.data.user.role}`);
    return true;
  } else {
    console.log(`✗ Error: ${result.error}`);
    return false;
  }
}

/**
 * Ejecutar todos los tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     ENERGIAPRO - INTEGRATION TESTS                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const results = [];
  
  // Ejecutar tests en orden
  results.push({ name: 'Login', passed: await testLogin() });
  results.push({ name: 'CRUD Productos', passed: await testProductsCRUD() });
  results.push({ name: 'CRUD Admins', passed: await testAdminsCRUD() });
  results.push({ name: 'Acceso y Permisos', passed: await testUsersAccess() });
  results.push({ name: 'Retiros', passed: await testWithdrawals() });
  results.push({ name: 'Profile', passed: await testProfile() });
  
  // Resumen
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     RESULTADOS                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  results.forEach(test => {
    const status = test.passed ? '✓ PASSED' : '✗ FAILED';
    console.log(`${status}: ${test.name}`);
  });
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  console.log(`\nTotal: ${passedCount}/${totalCount} tests passed\n`);
  
  return passedCount === totalCount;
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { runAllTests };
