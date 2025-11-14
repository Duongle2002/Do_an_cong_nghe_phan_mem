const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, default: '', trim: true },
    status: { type: String, enum: ['online', 'offline'], default: 'offline', index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    firmwareVersion: { type: String, default: '' },
    // External identifier reported by device over MQTT (e.g., esp32-7C87CE30CCCC)
    externalId: { type: String, unique: true, sparse: true, index: true },
    // Simple automation thresholds
    autoPumpEnabled: { type: Boolean, default: false },
    autoPumpSoilBelow: { type: Number }, // percentage
    autoFanEnabled: { type: Boolean, default: false },
    autoFanTempAbove: { type: Number }, // Celsius
  autoLightEnabled: { type: Boolean, default: false },
  autoLightLuxBelow: { type: Number }, // lux threshold
  // Hysteresis values
  autoFanHysteresis: { type: Number }, // °C
  autoPumpHysteresis: { type: Number }, // %
  autoLightHysteresis: { type: Number }, // lux
  // Minimum interval between toggles to avoid flapping (seconds)
  minToggleIntervalSec: { type: Number, default: 0 },
  // Last toggle timestamps
  lastFanToggleAt: { type: Date },
  lastPumpToggleAt: { type: Date },
  lastLightToggleAt: { type: Date },
  lastFanState: { type: String, enum: ['ON','OFF'] },
  lastPumpState: { type: String, enum: ['ON','OFF'] },
  lastLightState: { type: String, enum: ['ON','OFF'] },
  // Presence tracking
  lastSeenAt: { type: Date },
  // Simple daily schedule (single slot per target)
  schedFanOn: { type: String }, // HH:MM
  schedFanOff: { type: String },
  schedFanDays: { type: String }, // comma separated 0-6
  schedLightOn: { type: String },
  schedLightOff: { type: String },
  schedLightDays: { type: String },
  schedPumpOn: { type: String },
  schedPumpOff: { type: String },
  schedPumpDays: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { minimize: true }
);

module.exports = mongoose.model('Device', DeviceSchema);
