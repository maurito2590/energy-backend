#!/usr/bin/env node

/**
 * Script de Pruebas de Seguridad - EnergiaPro
 * Ejecuta pruebas para verificar que las vulnerabilidades fueron corregidas
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';
let token = '';

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
};

async function login() {
  try {
    log.info('Inicializando sesión de super_admin...');
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'superadmin@energiapro.com',
      password: 'SuperAdmin123!',
    });
    token = response.data.token;
    log.success('Autenticación exitosa');
    return true;
  } catch (error) {
    log.error(`Fallo de autenticación: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

async function testValidation(testName, payload, expectedStatus) {
  try {
    await axios.post(`${API_BASE_URL}/admin/products`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (expectedStatus === 201) {
      log.success(`${testName} - Producto creado`);
      return true;
    } else {
      log.error(`${testName} - Debería haber sido rechazado`);
      return false;
    }
  } catch (error) {
    const status = error.response?.status;
    if (status === expectedStatus) {
      log.success(`${testName} - Rechazado correctamente (${status})`);
      return true;
    } else {
      log.error(`${testName} - Status inesperado: ${status}, esperado: ${expectedStatus}`);
      return false;
    }
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('PRUEBAS DE SEGURIDAD - EnergiaPro');
  console.log('='.repeat(60) + '\n');

  if (!await login()) {
    process.exit(1);
  }

  let passed = 0;
  let total = 0;

  console.log('\n--- Test 1: Validación de Números Negativos ---');
  
  total++;
  if (await testValidation(
    'Precio negativo debe ser rechazado',
    {
      name: 'Producto Fraude',
      productCode: 'FRAUD-001',
      type: 'tradicional',
      initialPrice: -1000,
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 2: Validación de Tasa Diaria Extrema ---');
  
  total++;
  if (await testValidation(
    'Tasa > 100% debe ser rechazada',
    {
      name: 'Producto Imposible',
      productCode: 'IMPOSSIBLE-001',
      type: 'tradicional',
      initialPrice: 1000,
      dailyIncomeRate: 2.0, // 200% diario
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 3: Validación de Duración Extrema ---');
  
  total++;
  if (await testValidation(
    'Duración > 3650 días debe ser rechazada',
    {
      name: 'Producto a 100 años',
      productCode: 'FOREVER-001',
      type: 'tradicional',
      initialPrice: 1000,
      dailyIncomeRate: 0.05,
      duration: 36500, // 100 años
    },
    400
  )) passed++;

  console.log('\n--- Test 4: Validación de Tipos de Datos ---');
  
  total++;
  if (await testValidation(
    'Precio como string debe ser rechazado',
    {
      name: 'Producto Invalid',
      productCode: 'INVALID-001',
      type: 'tradicional',
      initialPrice: 'mil pesos',
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 5: Validación de Campos Requeridos ---');
  
  total++;
  if (await testValidation(
    'Producto sin nombre debe ser rechazado',
    {
      productCode: 'NONAME-001',
      type: 'tradicional',
      initialPrice: 1000,
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 6: Validación de Tipo Enum ---');
  
  total++;
  if (await testValidation(
    'Tipo inválido debe ser rechazado',
    {
      name: 'Producto Tipo Basura',
      productCode: 'GARBAGE-001',
      type: 'fraudulent',
      initialPrice: 1000,
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 7: Validación de Longitud de Strings ---');
  
  total++;
  if (await testValidation(
    'Nombre muy corto debe ser rechazado',
    {
      name: 'A',
      productCode: 'SHORT-001',
      type: 'tradicional',
      initialPrice: 1000,
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 8: Validación de Unicidad de productCode ---');
  
  // Primero crear un producto válido
  try {
    await axios.post(`${API_BASE_URL}/admin/products`, {
      name: 'Producto Único',
      productCode: 'UNIQUE-001',
      type: 'tradicional',
      initialPrice: 1000,
      dailyIncomeRate: 0.05,
      duration: 30,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
    log.success('Primer producto creado exitosamente');
  } catch (error) {
    log.error(`Fallo al crear primer producto: ${error.response?.data?.error}`);
  }

  // Intentar crear otro con el mismo código
  total++;
  if (await testValidation(
    'Código duplicado debe ser rechazado',
    {
      name: 'Producto Duplicado',
      productCode: 'UNIQUE-001',
      type: 'tradicional',
      initialPrice: 2000,
      dailyIncomeRate: 0.05,
      duration: 30,
    },
    400
  )) passed++;

  console.log('\n--- Test 9: Crear Producto Válido ---');
  
  total++;
  if (await testValidation(
    'Producto válido debe ser aceptado',
    {
      name: 'Panel Solar 500W',
      productCode: 'PS-500-' + Date.now(),
      type: 'limpia',
      initialPrice: 1500,
      dailyIncomeRate: 0.05,
      duration: 90,
    },
    201
  )) passed++;

  console.log('\n' + '='.repeat(60));
  console.log(`RESULTADOS: ${passed}/${total} pruebas pasadas`);
  console.log('='.repeat(60) + '\n');

  if (passed === total) {
    log.success('¡Todas las pruebas de seguridad pasaron!');
    process.exit(0);
  } else {
    log.error(`${total - passed} pruebas fallaron`);
    process.exit(1);
  }
}

// Ejecutar tests
runTests().catch((error) => {
  log.error(`Error fatal: ${error.message}`);
  process.exit(1);
});
