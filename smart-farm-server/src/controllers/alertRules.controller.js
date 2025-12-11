const { body, query, param } = require('express-validator');
const AlertRule = require('../models/AlertRule');
const Device = require('../models/Device');

const createValidators = [
  body('deviceId').isString().notEmpty(),
  body('metric').isIn(['temperature', 'humidity', 'soilMoisture', 'lux']),
  body('minThreshold').optional().isFloat(),
  body('maxThreshold').optional().isFloat(),
  body('enabled').optional().isBoolean().toBoolean(),
  body('notificationType').optional().isIn(['all', 'email', 'app']),
  body('cooldownMinutes').optional().isInt({ min: 0, max: 1440 }),
];

async function create(req, res) {
  const { deviceId, metric, minThreshold, maxThreshold, enabled, notificationType, cooldownMinutes } = req.body;

  // Verify device exists and belongs to user
  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Check if rule already exists for this device+metric
  const existing = await AlertRule.findOne({ deviceId, metric });
  if (existing) return res.status(409).json({ message: 'Alert rule already exists for this metric on this device' });

  try {
    const rule = await AlertRule.create({
      deviceId,
      metric,
      minThreshold: minThreshold ?? null,
      maxThreshold: maxThreshold ?? null,
      enabled: enabled ?? true,
      notificationType: notificationType ?? 'app',
      cooldownMinutes: cooldownMinutes ?? 5,
    });
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

const updateValidators = [
  param('id').isString().notEmpty(),
  body('minThreshold').optional().isFloat(),
  body('maxThreshold').optional().isFloat(),
  body('enabled').optional().isBoolean().toBoolean(),
  body('notificationType').optional().isIn(['all', 'email', 'app']),
  body('cooldownMinutes').optional().isInt({ min: 0, max: 1440 }),
];

async function update(req, res) {
  const rule = await AlertRule.findById(req.params.id);
  if (!rule) return res.status(404).json({ message: 'Alert rule not found' });

  const device = await Device.findById(rule.deviceId);
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  Object.assign(rule, req.body);
  try {
    await rule.save();
    res.json(rule);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
}

const listValidators = [
  query('deviceId').optional().isString(),
];

async function list(req, res) {
  const q = {};
  if (req.query.deviceId) q.deviceId = req.query.deviceId;
  const rules = await AlertRule.find(q).lean();
  res.json(rules);
}

async function deleteRule(req, res) {
  const rule = await AlertRule.findById(req.params.id);
  if (!rule) return res.status(404).json({ message: 'Alert rule not found' });

  const device = await Device.findById(rule.deviceId);
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  await AlertRule.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { create, createValidators, update, updateValidators, list, listValidators, deleteRule };
