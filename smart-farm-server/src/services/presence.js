const Device = require('../models/Device');

let timer;

function initPresenceWatcher(app, intervalMs = 30000, timeoutMs = 90000) {
  if (timer) clearInterval(timer);
  timer = setInterval(async () => {
    const cutoff = new Date(Date.now() - timeoutMs);
    try {
      const stale = await Device.find({ status: 'online', $or: [ { lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: cutoff } } ] }).lean();
      for (const d of stale) {
        await Device.findByIdAndUpdate(d._id, { status: 'offline' }).catch(() => {});
        if (app && app.locals && typeof app.locals.pushDeviceStatus === 'function') {
          app.locals.pushDeviceStatus(d.externalId, 'offline');
        }
      }
    } catch (e) {
      // ignore errors to keep loop running
    }
  }, intervalMs);
  console.log('Presence watcher started, interval', intervalMs, 'ms, timeout', timeoutMs, 'ms');
}

module.exports = { initPresenceWatcher };
