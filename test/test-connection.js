require('dotenv').config({ path: __dirname + '/.env.local' });
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...\n');
console.log('URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('\n✓ Successfully connected to MongoDB!');
    console.log('Database:', mongoose.connection.db.databaseName);
    process.exit(0);
  })
  .catch((error) => {
    console.log('\n✗ Connection failed!');
    console.log('Error:', error.message);
    process.exit(1);
  });
