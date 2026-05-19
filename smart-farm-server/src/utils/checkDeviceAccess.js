const Device = require('../models/Device');

async function checkDeviceAccess(deviceId, user) {
  const device = await Device.findById(deviceId);
  if (!device) {
    const e = new Error('Device not found');
    e.code = 'NOT_FOUND';
    throw e;
  }
  if (user && user.role !== 'Admin' && device.ownerId.toString() !== user.id) {
    const e = new Error('Forbidden');
    e.code = 'FORBIDDEN';
    throw e;
  }
  return device;
}

module.exports = checkDeviceAccess;
