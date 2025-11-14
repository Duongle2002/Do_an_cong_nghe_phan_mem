const mongoose = require('mongoose');

const SensorDataSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    temperature: { type: Number },
    humidity: { type: Number },
    soilMoisture: { type: Number },
    lux: { type: Number },
    pH: { type: Number },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { minimize: true }
);

SensorDataSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('SensorData', SensorDataSchema);
