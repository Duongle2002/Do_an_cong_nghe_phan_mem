const { body } = require('express-validator');
const Device = require('../models/Device');

const createDeviceValidators = [
  body('name').isString().notEmpty(),
  body('location').optional().isString(),
  body('ownerId').isString().notEmpty(),
  body('externalId').optional().isString(),
];

async function listDevices(req, res) {
  const query = req.user.role === 'Admin' ? {} : { ownerId: req.user.id };
  const devices = await Device.find(query).lean();
  res.json(devices);
}

async function createDevice(req, res) {
  const { name, location = '', ownerId, firmwareVersion = '', externalId } = req.body;
  if (req.user.role !== 'Admin' && ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const device = await Device.create({ name, location, ownerId, firmwareVersion, externalId });
  res.status(201).json(device);
}

async function getDevice(req, res) {
  const device = await Device.findById(req.params.id).lean();
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json(device);
}

async function updateDevice(req, res) {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const { name, location, status, firmwareVersion, externalId,
    autoPumpEnabled, autoPumpSoilBelow, autoFanEnabled, autoFanTempAbove,
    autoLightEnabled, autoLightLuxBelow,
    autoFanHysteresis, autoPumpHysteresis, autoLightHysteresis,
    minToggleIntervalSec,
    schedFanOn, schedFanOff, schedFanDays,
    schedLightOn, schedLightOff, schedLightDays,
    schedPumpOn, schedPumpOff, schedPumpDays,
  } = req.body;
  if (name) device.name = name;
  if (location) device.location = location;
  if (status) device.status = status;
  if (firmwareVersion) device.firmwareVersion = firmwareVersion;
  if (externalId) device.externalId = externalId;
  if (typeof autoPumpEnabled === 'boolean') device.autoPumpEnabled = autoPumpEnabled;
  if (typeof autoPumpSoilBelow === 'number') device.autoPumpSoilBelow = autoPumpSoilBelow;
  if (typeof autoFanEnabled === 'boolean') device.autoFanEnabled = autoFanEnabled;
  if (typeof autoFanTempAbove === 'number') device.autoFanTempAbove = autoFanTempAbove;
  if (typeof autoLightEnabled === 'boolean') device.autoLightEnabled = autoLightEnabled;
  if (typeof autoLightLuxBelow === 'number') device.autoLightLuxBelow = autoLightLuxBelow;
  if (typeof autoFanHysteresis === 'number') device.autoFanHysteresis = autoFanHysteresis;
  if (typeof autoPumpHysteresis === 'number') device.autoPumpHysteresis = autoPumpHysteresis;
  if (typeof autoLightHysteresis === 'number') device.autoLightHysteresis = autoLightHysteresis;
  if (typeof minToggleIntervalSec === 'number') device.minToggleIntervalSec = minToggleIntervalSec;
  if (typeof schedFanOn === 'string') device.schedFanOn = schedFanOn;
  if (typeof schedFanOff === 'string') device.schedFanOff = schedFanOff;
  if (typeof schedFanDays === 'string') device.schedFanDays = schedFanDays;
  if (typeof schedLightOn === 'string') device.schedLightOn = schedLightOn;
  if (typeof schedLightOff === 'string') device.schedLightOff = schedLightOff;
  if (typeof schedLightDays === 'string') device.schedLightDays = schedLightDays;
  if (typeof schedPumpOn === 'string') device.schedPumpOn = schedPumpOn;
  if (typeof schedPumpOff === 'string') device.schedPumpOff = schedPumpOff;
  if (typeof schedPumpDays === 'string') device.schedPumpDays = schedPumpDays;
  await device.save();
  res.json(device);
}

async function deleteDevice(req, res) {
  const device = await Device.findById(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (req.user.role !== 'Admin' && device.ownerId.toString() !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await device.deleteOne();
  res.json({ ok: true });
}

module.exports = { listDevices, createDevice, getDevice, updateDevice, deleteDevice, createDeviceValidators };
