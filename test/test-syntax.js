#!/usr/bin/env node

// Test de sintaxis de los archivos principales
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando sintaxis de archivos...\n');

const filesToCheck = [
  './config/database.js',
  './config/jwt.js',
  './config/email.js',
  './models/User.js',
  './models/Product.js',
  './models/Transaction.js',
  './models/Group.js',
  './models/Withdrawal.js',
  './controllers/authController.js',
  './controllers/productController.js',
  './controllers/transactionController.js',
  './controllers/withdrawalController.js',
  './controllers/adminController.js',
  './middleware/auth.js',
  './middleware/errorHandler.js',
  './routes/authRoutes.js',
  './routes/productRoutes.js',
  './routes/transactionRoutes.js',
  './routes/withdrawalRoutes.js',
  './routes/adminRoutes.js',
  './server.js',
];

let errors = 0;
let success = 0;

filesToCheck.forEach(file => {
  try {
    const filePath = path.join(__dirname, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Intentar cargar el módulo (esto verificará la sintaxis)
    require(filePath);
    console.log(`✅ ${file}`);
    success++;
  } catch (err) {
    console.error(`❌ ${file}`);
    console.error(`   Error: ${err.message}\n`);
    errors++;
  }
});

console.log(`\n📊 Resultados: ${success} OK, ${errors} Errores`);

if (errors === 0) {
  console.log('✨ Todos los archivos tienen sintaxis correcta!');
  process.exit(0);
} else {
  process.exit(1);
}
