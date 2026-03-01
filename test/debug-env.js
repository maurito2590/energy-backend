console.log('Current directory:', __dirname);
console.log('Process.env before dotenv:', process.env.MONGODB_URI);

require('dotenv').config({ path: __dirname + '/.env.local' });

console.log('Process.env after dotenv:', process.env.MONGODB_URI);
console.log('\nAll env variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI:', process.env.MONGODB_URI);
