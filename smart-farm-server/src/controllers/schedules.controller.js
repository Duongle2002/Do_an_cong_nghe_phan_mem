const { body } = require('express-validator');
const Schedule = require('../models/Schedule');
const Device = require('../models/Device');

const createValidators = [
  body('deviceId').isString().notEmpty(),
  body('target').optional().isIn(['fan', 'light', 'pump', 'main']),
  body('action').isIn(['ON', 'OFF']),
  body('time').isISO8601(),
  body('repeat').optional().isIn(['daily', 'weekly']),
  body('active').optional().isBoolean(),
];

async function create(req, res) {
  const { deviceId, target = 'main', action, time, repeat = 'daily', active = true } = req.body;
  const device = await Device.findById(deviceId);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const s = await Schedule.create({ deviceId, userId: req.user.id, target, action, time: new Date(time), repeat, active });
  res.status(201).json(s);
}

async function list(req, res) {
  const base = req.user.role === 'Admin' ? {} : { userId: req.user.id };
  const q = { ...base };
  if (req.query.deviceId) q.deviceId = req.query.deviceId;
  const items = await Schedule.find(q).sort({ createdAt: -1 }).lean();
  res.json(items);
}

async function update(req, res) {
  const s = await Schedule.findById(req.params.id);
  if (!s) return res.status(404).json({ message: 'Schedule not found' });
  if (req.user.role !== 'Admin' && s.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
  const { target, action, time, repeat, active } = req.body;
  if (target) s.target = target;
  if (action) s.action = action;
  if (time) s.time = new Date(time);
  if (repeat) s.repeat = repeat;
  if (typeof active === 'boolean') s.active = active;
  await s.save();
  res.json(s);
}

async function remove(req, res) {
  const s = await Schedule.findById(req.params.id);
  if (!s) return res.status(404).json({ message: 'Schedule not found' });
  if (req.user.role !== 'Admin' && s.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
  await s.deleteOne();
  res.json({ ok: true });
}

module.exports = { create, createValidators, list, update, remove };
