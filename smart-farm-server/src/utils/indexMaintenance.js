const Device = require('../models/Device');

async function ensureDeviceIndexes() {
  try {
    const coll = Device.collection;
    const indexes = await coll.indexes();
    const bad = indexes.find((i) => i.name === 'deviceId_1');
    if (bad) {
      try {
        await coll.dropIndex('deviceId_1');
        console.log('Dropped unexpected index deviceId_1 on devices');
      } catch (e) {
        console.warn('Failed to drop deviceId_1 index on devices:', e.message);
      }
    }
    // Align indexes to schema definition
    try {
      await Device.syncIndexes();
    } catch (e) {
      console.warn('Device.syncIndexes failed:', e.message);
    }
  } catch (e) {
    console.warn('ensureDeviceIndexes encountered error:', e.message);
  }
}

module.exports = { ensureDeviceIndexes };
