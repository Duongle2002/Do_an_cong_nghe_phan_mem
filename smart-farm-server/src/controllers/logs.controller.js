const { query } = require('express-validator');
const SystemLog = require('../models/SystemLog');

async function list(req, res) {
  const items = await SystemLog.find().sort({ createdAt: -1 }).limit(500).lean();
  res.json(items);
}

module.exports = { list };
