const mongoose = require('mongoose');

const CommandSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Multi-target control for a device: fan/light/pump or generic
    target: { type: String, enum: ['fan', 'light', 'pump', 'main'], default: 'main', index: true },
    action: { type: String, enum: ['ON', 'OFF'], required: true },
    status: { type: String, enum: ['pending', 'executed', 'queued'], default: 'pending', index: true },
    createdAt: { type: Date, default: Date.now },
    executedAt: { type: Date },
  },
  { minimize: true }
);

module.exports = mongoose.model('Command', CommandSchema);
