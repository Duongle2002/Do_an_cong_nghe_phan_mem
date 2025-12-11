const { body } = require('express-validator');
const Device = require('../models/Device');
const SensorData = require('../models/SensorData');
const Schedule = require('../models/Schedule');
const Command = require('../models/Command');
const Alert = require('../models/Alert');

const createDeviceValidators = [
  body('name').isString().notEmpty(),
  body('location').optional().isString(),
  // ownerId will default to current user; Admin may override by providing ownerId
  body('ownerId').optional().isString(),
  body('externalId').optional().isString(),
];

async function listDevices(req, res) {
  const query = req.user.role === 'Admin' ? {} : { ownerId: req.user.id };
  const devices = await Device.find(query).lean();
  res.json(devices);
}

async function createDevice(req, res) {
  let { name, location = '', ownerId, firmwareVersion = '', externalId } = req.body;
  // Default ownerId to current user unless Admin overrides
  if (!ownerId) ownerId = req.user.id;
  if (req.user.role !== 'Admin' && ownerId !== req.user.id) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  // Prevent duplicate externalId
  if (externalId) {
    const existing = await Device.findOne({ externalId }).lean();
    if (existing) {
      return res.status(409).json({ message: 'externalId already in use' });
    }
  }
  try {
    const device = await Device.create({ name, location, ownerId, firmwareVersion, externalId });
    return res.status(201).json(device);
  } catch (e) {
    // Handle unique index violation defensively
    if (String(e.code) === '11000') {
      return res.status(409).json({ message: 'Duplicate key', error: e.message });
    }
    throw e;
  }
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
  if (externalId) {
    const existing = await Device.findOne({ externalId, _id: { $ne: device._id } }).lean();
    if (existing) return res.status(409).json({ message: 'externalId already in use' });
    device.externalId = externalId;
  }
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
  // Cascade clean-up (best-effort)
  try { await SensorData.deleteMany({ deviceId: device._id }); } catch (_) {}
  try { await Schedule.deleteMany({ deviceId: device._id }); } catch (_) {}
  try { await Command.deleteMany({ deviceId: device._id }); } catch (_) {}
  try { await Alert.deleteMany({ deviceId: device._id }); } catch (_) {}
  res.json({ ok: true });
}

// Get all devices
exports.getAllDevices = async (req, res) => {
  try {
    const devices = await Device.find();
    res.status(200).json(devices);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching devices', error });
  }
};

// Get a single device by ID
exports.getDeviceById = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.status(200).json(device);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching device', error });
  }
};

// Create a new device
exports.createDevice = async (req, res) => {
  try {
    const newDevice = new Device(req.body);
    await newDevice.save();
    res.status(201).json(newDevice);
  } catch (error) {
    res.status(500).json({ message: 'Error creating device', error });
  }
};

// Update a device by ID
exports.updateDevice = async (req, res) => {
  try {
    const updatedDevice = await Device.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedDevice) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.status(200).json(updatedDevice);
  } catch (error) {
    res.status(500).json({ message: 'Error updating device', error });
  }
};

// Delete a device by ID
exports.deleteDevice = async (req, res) => {
  try {
    const deletedDevice = await Device.findByIdAndDelete(req.params.id);
    if (!deletedDevice) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting device', error });
  }
};

module.exports = { listDevices, createDevice, getDevice, updateDevice, deleteDevice, createDeviceValidators };
