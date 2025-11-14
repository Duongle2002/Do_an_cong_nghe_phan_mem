const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    target: { type: String, enum: ['fan', 'light', 'pump', 'main'], default: 'main' },
    action: { type: String, enum: ['ON', 'OFF'], required: true },
    time: { type: Date, required: true },
    repeat: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
    active: { type: Boolean, default: true },
    lastRunAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Schedule', ScheduleSchema);
