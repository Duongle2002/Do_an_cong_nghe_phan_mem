const Schedule = require('../models/Schedule');
const Device = require('../models/Device');

let timer;

function sameMinute(a, b) {
  return a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate() &&
    a.getUTCHours() === b.getUTCHours() &&
    a.getUTCMinutes() === b.getUTCMinutes();
}

function matches(now, when, repeat) {
  // Compare by local time components of 'when'
  const h = when.getHours();
  const m = when.getMinutes();
  if (now.getHours() !== h || now.getMinutes() !== m) return false;
  if (repeat === 'weekly') {
    return now.getDay() === when.getDay();
  }
  return true; // daily
}

async function tick(publishControl) {
  const now = new Date();
  const active = await Schedule.find({ active: true }).lean();
  for (const s of active) {
    try {
      const when = new Date(s.time);
      if (!matches(now, when, s.repeat)) continue;
      if (s.lastRunAt && sameMinute(now, new Date(s.lastRunAt))) continue; // already ran this minute

      const device = await Device.findById(s.deviceId).lean();
      if (!device) continue;
      const idForTopic = device.externalId || device._id.toString();

      publishControl(idForTopic, s.target || 'main', s.action || 'ON');
      await Schedule.findByIdAndUpdate(s._id, { lastRunAt: now }).catch(() => {});
    } catch (e) {
      // ignore
    }
  }
}

function initScheduler(publishControl, intervalMs = 30000) {
  if (timer) clearInterval(timer);
  if (typeof publishControl !== 'function') return;
  timer = setInterval(() => {
    tick(publishControl);
  }, intervalMs);
  console.log('Schedule runner started, interval', intervalMs, 'ms');
}

module.exports = { initScheduler };
