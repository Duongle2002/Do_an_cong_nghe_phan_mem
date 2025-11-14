const mongoose = require('mongoose');

const SystemLogSchema = new mongoose.Schema(
  {
    actor: { type: String, enum: ['User', 'Admin', 'Device'], required: true },
    action: { type: String, required: true },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemLog', SystemLogSchema);
