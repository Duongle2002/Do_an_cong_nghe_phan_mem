const mongoose = require('mongoose');

const EmailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true },
    subject: { type: String, required: true },
    type: { type: String, enum: ['test', 'alert'], required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    error: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EmailLog', EmailLogSchema);
