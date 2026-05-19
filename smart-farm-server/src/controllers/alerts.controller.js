const { body, query } = require('express-validator');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const checkDeviceAccess = require('../utils/checkDeviceAccess');

const createValidators = [
  body('deviceId').isString().notEmpty(),
  body('type').isIn(['warning', 'error']),
  body('message').isString().notEmpty(),
  body('timestamp').optional().isISO8601(),
];

async function create(req, res) {
  const { deviceId, type, message, timestamp } = req.body;
  try {
    await checkDeviceAccess(deviceId, req.user);
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ message: 'Device not found' });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ message: 'Forbidden' });
    throw err;
  }
  const alert = await Alert.create({ deviceId, type, message, timestamp: timestamp || new Date() });
  res.status(201).json(alert);
}

const listValidators = [
  query('deviceId').optional().isString(),
  query('read').optional().isBoolean().toBoolean(),
];

async function list(req, res) {
  const q = {};
  if (req.query.deviceId) q.deviceId = req.query.deviceId;
  if (typeof req.query.read === 'boolean') q.read = req.query.read;
  const items = await Alert.find(q).sort({ timestamp: -1 }).lean();
  res.json(items);
}

async function markRead(req, res) {
  const alert = await Alert.findById(req.params.id);
  if (!alert) return res.status(404).json({ message: 'Alert not found' });
  alert.read = true;
  await alert.save();
  res.json(alert);
}

module.exports = { create, createValidators, list, listValidators, markRead };
