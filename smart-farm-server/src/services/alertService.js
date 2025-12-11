const AlertRule = require('../models/AlertRule');
const Alert = require('../models/Alert');
const Device = require('../models/Device');
const User = require('../models/User');
const emailService = require('./emailService');

/**
 * Check if sensor data triggers any alert rules
 * Creates Alert if rule triggered and cooldown passed
 * Sends email notification if configured
 */
async function checkAlertRules(deviceId, sensorData) {
  try {
    const device = await Device.findById(deviceId).lean();
    if (!device) {
      console.log(`[Alert] Device not found: ${deviceId}`);
      return;
    }

    const rules = await AlertRule.find({ deviceId, enabled: true });
    console.log(`[Alert] Device: ${device.name}, Sensor data:`, sensorData, `Rules count: ${rules.length}`);

    const now = new Date();

    for (const rule of rules) {
      const value = sensorData[rule.metric];
      console.log(`[Alert] Rule: ${rule.metric}, Value: ${value}, Min: ${rule.minThreshold}, Max: ${rule.maxThreshold}, Enabled: ${rule.enabled}`);
      
      if (value === undefined || value === null) {
        console.log(`[Alert] Skipping ${rule.metric}: value is null/undefined`);
        continue;
      }

      let triggered = false;
      if (rule.minThreshold !== null && rule.maxThreshold !== null) {
        // Outside range [min, max]
        triggered = value < rule.minThreshold || value > rule.maxThreshold;
        console.log(`[Alert] Range check [${rule.minThreshold}, ${rule.maxThreshold}]: ${value} → triggered=${triggered}`);
      } else if (rule.minThreshold !== null) {
        // Below or equal minimum
        triggered = value <= rule.minThreshold;
        console.log(`[Alert] Min check ${rule.minThreshold}: ${value} → triggered=${triggered}`);
      } else if (rule.maxThreshold !== null) {
        // Above or equal maximum
        triggered = value >= rule.maxThreshold;
        console.log(`[Alert] Max check ${rule.maxThreshold}: ${value} → triggered=${triggered}`);
      }

      if (triggered) {
        // Check cooldown
        const lastAlert = rule.lastAlertTime;
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        const timeSinceLastAlert = lastAlert ? (now - lastAlert) : null;
        const shouldAlert = !lastAlert || timeSinceLastAlert > cooldownMs;
        
        console.log(`[Alert] Triggered! LastAlert: ${lastAlert}, Cooldown: ${cooldownMs}ms, TimeSince: ${timeSinceLastAlert}ms, ShouldAlert: ${shouldAlert}`);

        if (shouldAlert) {
          const message = `${rule.metric} is ${value.toFixed(2)} (threshold: ${rule.minThreshold ?? '—'} - ${rule.maxThreshold ?? '—'})`;
          const alert = await Alert.create({
            deviceId,
            type: 'warning',
            message,
            timestamp: now,
            read: false,
          });
          console.log(`[Alert] Created alert: ${alert._id}`);

          // Update last alert time
          rule.lastAlertTime = now;
          await rule.save();
          console.log(`[Alert] Updated rule lastAlertTime`);

          // Send email notification if enabled
          if (rule.notificationType === 'email' || rule.notificationType === 'all') {
            const owner = await User.findById(device.ownerId).lean();
            if (owner && owner.email) {
              console.log(`[Alert] Sending email to ${owner.email}`);
              emailService.sendAlertEmail(
                owner.email,
                device.name,
                message,
                'warning'
              ).catch(err => console.error('Email send failed:', err));
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error checking alert rules:', err);
  }
}

module.exports = { checkAlertRules };
