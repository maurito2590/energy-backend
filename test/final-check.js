// Verificación final de integridad del backend
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificación final del backend EnergiaPro\n');

// Verificar archivos críticos
const criticalFiles = {
  'Config': [
    '.env.local',
    'config/database.js',
    'config/jwt.js',
    'config/email.js'
  ],
  'Models': [
    'models/User.js',
    'models/Product.js',
    'models/Transaction.js',
    'models/Group.js',
    'models/Withdrawal.js'
  ],
  'Controllers': [
    'controllers/authController.js',
    'controllers/productController.js',
    'controllers/transactionController.js',
    'controllers/withdrawalController.js',
    'controllers/adminController.js'
  ],
  'Routes': [
    'routes/authRoutes.js',
    'routes/productRoutes.js',
    'routes/transactionRoutes.js',
    'routes/withdrawalRoutes.js',
    'routes/adminRoutes.js'
  ],
  'Middleware': [
    'middleware/auth.js',
    'middleware/errorHandler.js'
  ],
  'Main': [
    'server.js',
    'package.json'
  ]
};

let totalFiles = 0;
let foundFiles = 0;

for (const [category, files] of Object.entries(criticalFiles)) {
  console.log(`📁 ${category}`);
  
  files.forEach(file => {
    totalFiles++;
    const filePath = path.join(__dirname, file);
    
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const size = (stat.size / 1024).toFixed(2);
      console.log(`  ✅ ${file} (${size}KB)`);
      foundFiles++;
    } else {
      console.log(`  ❌ ${file} (FALTA)`);
    }
  });
  console.log();
}

console.log(`\n📊 RESUMEN`);
console.log(`Total esperado: ${totalFiles}`);
console.log(`Encontrado: ${foundFiles}`);
console.log(`Estado: ${foundFiles === totalFiles ? '✅ LISTO' : '⚠️  INCOMPLETO'}`);

if (foundFiles === totalFiles) {
  console.log('\n✨ ¡Backend listo para usar!');
  process.exit(0);
} else {
  console.log('\n⚠️  Faltan algunos archivos');
  process.exit(1);
}
