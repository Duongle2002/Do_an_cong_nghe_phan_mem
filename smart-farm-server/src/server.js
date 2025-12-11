require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { initMqtt } = require('./integrations/mqtt');
const { initScheduler } = require('./services/scheduler');
const { initPresenceWatcher } = require('./services/presence');

const PORT = process.env.PORT || 4000;
const { ensureDeviceIndexes } = require('./utils/indexMaintenance');

(async () => {
  try {
    await connectDB();
    // Ensure collection indexes are aligned; drop legacy/bad indexes
    await ensureDeviceIndexes();
    // Initialize MQTT (optional if MQTT_URL not set)
  const mqttApi = initMqtt(app); // pass app so mqtt can push SSE events
    // Start schedule runner if MQTT available
    if (mqttApi && typeof mqttApi.publishControl === 'function') {
      initScheduler(mqttApi.publishControl);
    }
    // Start presence watcher: mark devices offline after inactivity
    const timeoutSec = Number(process.env.OFFLINE_TIMEOUT_SEC || 90);
    initPresenceWatcher(app, 30000, timeoutSec * 1000);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Smart Farm API listening on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
