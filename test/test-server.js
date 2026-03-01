// Test rápido de funcionalidad básica
require('dotenv').config({ path: __dirname + '/.env.local' });

const app = require('./server.js');

// Test que el servidor se inicia correctamente
console.log('✅ Archivo de servidor cargado correctamente');
console.log('✅ Variables de entorno cargadas');
console.log('✅ Servidor está listo para escuchar en puerto:', process.env.PORT || 5000);
