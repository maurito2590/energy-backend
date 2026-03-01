#!/usr/bin/env node

const http = require('http');

// Realizar prueba de conexión
const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Response:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.log('Response (raw):', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  process.exit(1);
});

const body = JSON.stringify({
  email: 'superadmin@energiapro.com',
  password: 'SuperAdmin123!'
});

req.write(body);
req.end();
