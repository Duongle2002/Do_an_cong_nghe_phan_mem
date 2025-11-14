const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');
  await mongoose.connect(uri, {
    autoIndex: true,
  });
  isConnected = true;
  console.log('MongoDB connected');
}

module.exports = { connectDB };
