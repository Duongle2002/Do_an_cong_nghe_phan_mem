const { query, body } = require('express-validator');
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');
const { checkAlertRules } = require('../services/alertService');

const ingestValidators = [
  body('deviceId').isString().notEmpty(),
  body('temperature').optional().isFloat(),
  body('humidity').optional().isFloat(),
  body('soilMoisture').optional().isFloat(),
  body('pH').optional().isFloat(),
  body('lux').optional().isFloat(),
  body('timestamp').optional().isISO8601(),
];

async function ingest(req, res) {
  const { deviceId, temperature, humidity, soilMoisture, pH, lux, timestamp } = req.body;
  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user && req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const data = await SensorData.create({ deviceId, temperature, humidity, soilMoisture, pH, lux, timestamp: timestamp || new Date() });
  
  // Check alert rules asynchronously (don't block response)
  checkAlertRules(deviceId, { temperature, humidity, soilMoisture, lux }).catch(err => console.error('Alert check failed:', err));
  
  res.status(201).json(data);
}

const listValidators = [
  query('deviceId').isString().notEmpty(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
];

async function list(req, res) {
  const { deviceId, from, to } = req.query;
  const limit = parseInt(req.query.limit || '100', 10);

  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user && req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const q = { deviceId };
  if (from || to) {
    q.timestamp = {};
    if (from) q.timestamp.$gte = new Date(from);
    if (to) q.timestamp.$lte = new Date(to);
  }
  const items = await SensorData.find(q).sort({ timestamp: -1 }).limit(limit).lean();
  res.json(items);
}

module.exports = { ingest, ingestValidators, list, listValidators };
