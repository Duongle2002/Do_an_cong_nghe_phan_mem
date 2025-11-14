const { body, query } = require('express-validator');
const Command = require('../models/Command');
const Device = require('../models/Device');
const { mqtt } = require('../integrations/mqtt');

const createValidators = [
  body('deviceId').isString().notEmpty(),
  body('target').isIn(['fan', 'light', 'pump', 'main']),
  body('action').isIn(['ON', 'OFF']),
];

async function create(req, res) {
  const { deviceId, target, action } = req.body;
  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const cmd = await Command.create({ deviceId, userId: req.user.id, target, action, status: 'pending' });
  // Publish to MQTT for ESP32 (sensors/<externalId>/control/<target>)
  try {
    const idForTopic = device.externalId || deviceId;
    mqtt.publishControl(idForTopic, target, action, cmd);
  } catch (_) {}
  res.status(201).json(cmd);
}

const listValidators = [
  query('deviceId').isString().notEmpty(),
  query('status').optional().isIn(['pending', 'executed', 'queued']),
];

async function list(req, res) {
  const { deviceId, status } = req.query;
  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const q = { deviceId };
  if (status) q.status = status;
  const cmds = await Command.find(q).sort({ createdAt: -1 }).lean();
  res.json(cmds);
}

const nextValidators = [
  query('deviceId').isString().notEmpty(),
];

async function nextForDevice(req, res) {
  // For device polling: get next pending/queued command
  const { deviceId } = req.query;
  const cmd = await Command.findOne({ deviceId, status: { $in: ['pending', 'queued'] } }).sort({ createdAt: 1 });
  if (!cmd) return res.json(null);
  res.json({ id: cmd._id, action: cmd.action });
}

const updateStatusValidators = [
  body('status').isIn(['pending', 'executed', 'queued']),
  body('executedAt').optional().isISO8601(),
];

async function updateStatus(req, res) {
  const cmd = await Command.findById(req.params.id);
  if (!cmd) return res.status(404).json({ message: 'Command not found' });
  // Only owner or admin can modify
  const device = await Device.findById(cmd.deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { status, executedAt } = req.body;
  cmd.status = status;
  if (executedAt) cmd.executedAt = new Date(executedAt);
  await cmd.save();
  res.json(cmd);
}

module.exports = { create, createValidators, list, listValidators, nextForDevice, nextValidators, updateStatus, updateStatusValidators };
