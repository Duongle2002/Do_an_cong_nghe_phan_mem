const mongoose = require('mongoose');

const AlertRuleSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    metric: { type: String, enum: ['temperature', 'humidity', 'soilMoisture', 'lux'], required: true },
    // min/max thresholds; if both set, triggers when outside [min, max]
    minThreshold: { type: Number, default: null },
    maxThreshold: { type: Number, default: null },
    enabled: { type: Boolean, default: true },
    // notification type
    notificationType: { type: String, enum: ['all', 'email', 'app'], default: 'app' },
    // cooldown in minutes; don't send alert again until this time passes
    cooldownMinutes: { type: Number, default: 1 },
    lastAlertTime: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index for unique rule per device+metric
AlertRuleSchema.index({ deviceId: 1, metric: 1 }, { unique: true });

module.exports = mongoose.model('AlertRule', AlertRuleSchema);
