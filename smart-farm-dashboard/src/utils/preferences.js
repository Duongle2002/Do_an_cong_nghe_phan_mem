export function getTempUnit() {
  return localStorage.getItem('pref_temp_unit') || 'C';
}

export function convertTemp(celsius) {
  if (celsius === undefined || celsius === null) return null;
  const unit = getTempUnit();
  if (unit === 'F') {
    return Number((celsius * 1.8 + 32).toFixed(1));
  }
  return Number(Number(celsius).toFixed(1));
}

export function formatTemp(celsius, decimals = 1) {
  if (celsius === undefined || celsius === null) return '—';
  const unit = getTempUnit();
  const converted = convertTemp(celsius);
  return `${converted.toFixed(decimals)} °${unit}`;
}

export function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

export function triggerPushNotification(device, metricKey, title, body) {
  if (localStorage.getItem('pref_alert_notify') === 'false') return;
  
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  if (!window.lastNotificationTimes) {
    window.lastNotificationTimes = {};
  }
  const key = `${device._id}_${metricKey}`;
  const now = Date.now();
  const cooldown = 3 * 60 * 1000; // 3 minutes cooldown

  if (now - (window.lastNotificationTimes[key] || 0) > cooldown) {
    new Notification(title, { body, icon: '/favicon.ico' });
    window.lastNotificationTimes[key] = now;
  }
}

export function checkSensorThresholds(device, payload) {
  if (!device || !payload) return;
  
  const temp = payload.temperature;
  const soil = payload.soilMoisture ?? payload.soil_pct;
  const lux = payload.lux;

  // Temperature
  if (temp !== undefined && temp !== null && device.autoFanTempAbove !== undefined && device.autoFanTempAbove !== null && device.autoFanTempAbove !== '') {
    const limit = Number(device.autoFanTempAbove);
    if (temp > limit) {
      triggerPushNotification(
        device,
        'temperature',
        `🚨 Cảnh báo nhiệt độ: ${device.name}`,
        `Nhiệt độ hiện tại ${temp.toFixed(1)}°C vượt quá ngưỡng an toàn ${limit}°C!`
      );
    }
  }

  // Soil Moisture
  if (soil !== undefined && soil !== null && device.autoPumpSoilBelow !== undefined && device.autoPumpSoilBelow !== null && device.autoPumpSoilBelow !== '') {
    const limit = Number(device.autoPumpSoilBelow);
    if (soil < limit) {
      triggerPushNotification(
        device,
        'soilMoisture',
        `🚨 Cảnh báo độ ẩm đất: ${device.name}`,
        `Độ ẩm đất hiện tại ${soil}% dưới ngưỡng an toàn ${limit}%!`
      );
    }
  }

  // Light
  if (lux !== undefined && lux !== null && device.autoLightLuxBelow !== undefined && device.autoLightLuxBelow !== null && device.autoLightLuxBelow !== '') {
    const limit = Number(device.autoLightLuxBelow);
    if (lux < limit) {
      triggerPushNotification(
        device,
        'lux',
        `🚨 Cảnh báo ánh sáng: ${device.name}`,
        `Cường độ sáng hiện tại ${lux} lux dưới ngưỡng an toàn ${limit} lux!`
      );
    }
  }
}
