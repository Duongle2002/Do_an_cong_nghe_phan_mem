const mqtt = require('mqtt');
const Device = require('../models/Device');
const SensorData = require('../models/SensorData');
const Command = require('../models/Command');

let api = { publishControl: () => {} };
let appRef; // to emit SSE
let client;

function initMqtt(app) {
  appRef = app;
  const url = process.env.MQTT_URL;
  if (!url) {
    console.log('MQTT disabled: MQTT_URL not set');
    return api;
  }

  const clientId = `${process.env.MQTT_CLIENT_ID_PREFIX || 'smartfarm-srv'}-${Math.random().toString(16).slice(2)}`;
  client = mqtt.connect(url, {
    clientId,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clean: true,
    reconnectPeriod: 2000,
  });

  client.on('connect', () => {
    console.log('MQTT connected');
    // Follow ESP topics: telemetry published by devices on sensors/<id>/data
    client.subscribe(['sensors/+/data', 'sensors/+/status', 'devices/+/cmd/ack'], { qos: Number(process.env.MQTT_QOS || 1) }, (err) => {
      if (err) console.error('MQTT subscribe error', err);
    });
  });

  client.on('reconnect', () => console.log('MQTT reconnecting...'));
  client.on('error', (err) => console.error('MQTT error', err.message));

  client.on('message', async (topic, payload) => {
    try {
      const parts = topic.split('/');
      const msg = payload.toString();

      // sensors/{deviceId}/data: ESP telemetry format
      if (parts[0] === 'sensors' && parts[2] === 'data') {
        const externalId = parts[1];
        let data;
        try { data = JSON.parse(msg); } catch (_) { console.warn('Telemetry JSON parse failed for externalId', externalId); return; }

        // Find mapped device by externalId (not lean so we can use _id directly); optionally auto-provision
        let device = await Device.findOne({ externalId });
        if (!device) {
          const ownerForAuto = process.env.AUTO_PROVISION_OWNER_ID; // set this to a valid User _id to enable auto-provision
          if (ownerForAuto) {
            try {
              device = await Device.create({
                name: externalId,
                externalId,
                ownerId: ownerForAuto,
                location: '',
                firmwareVersion: '',
                status: 'online',
              });
              console.log('Auto-provisioned device for externalId', externalId);
            } catch (e) {
              console.warn('Auto-provision failed for externalId', externalId, e.message);
            }
          }
        }

        if (!device) {
          console.warn('Telemetry ignored: no device mapped for externalId', externalId);
          return;
        }

        const doc = {
          deviceId: device._id,
          temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
          humidity: typeof data.humidity === 'number' ? data.humidity : undefined,
          soilMoisture: typeof data.soil_pct === 'number' ? data.soil_pct : (typeof data.soilMoisture === 'number' ? data.soilMoisture : undefined),
          // pH optional future field
          pH: typeof data.pH === 'number' ? data.pH : undefined,
          lux: typeof data.lux === 'number' ? data.lux : undefined,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        };
        try {
          await SensorData.create(doc);
        } catch (e) {
          console.error('Failed to persist telemetry for', externalId, e.message);
          return;
        }
        // Mark device online (non-blocking)
  const stateUpdates = { status: 'online', lastSeenAt: new Date() };
        // Reflect relay states from telemetry if present
        if (typeof data.relay_fan === 'boolean') stateUpdates.lastFanState = data.relay_fan ? 'ON' : 'OFF';
        if (typeof data.relay_light === 'boolean') stateUpdates.lastLightState = data.relay_light ? 'ON' : 'OFF';
        if (typeof data.relay_pump === 'boolean') stateUpdates.lastPumpState = data.relay_pump ? 'ON' : 'OFF';
        // Toggle timestamps if state changed
        try {
          const delta = {};
          if (typeof stateUpdates.lastFanState === 'string' && stateUpdates.lastFanState !== device.lastFanState) delta.lastFanToggleAt = new Date();
          if (typeof stateUpdates.lastLightState === 'string' && stateUpdates.lastLightState !== device.lastLightState) delta.lastLightToggleAt = new Date();
          if (typeof stateUpdates.lastPumpState === 'string' && stateUpdates.lastPumpState !== device.lastPumpState) delta.lastPumpToggleAt = new Date();
          await Device.findByIdAndUpdate(device._id, { $set: stateUpdates, $currentDate: delta }).catch(() => {});
          // Update in-memory snapshot to minimize redundant automation publishes in this cycle
          if (typeof stateUpdates.lastFanState === 'string') device.lastFanState = stateUpdates.lastFanState;
          if (typeof stateUpdates.lastLightState === 'string') device.lastLightState = stateUpdates.lastLightState;
          if (typeof stateUpdates.lastPumpState === 'string') device.lastPumpState = stateUpdates.lastPumpState;
        } catch(__) {
          Device.findByIdAndUpdate(device._id, stateUpdates).catch(() => {});
        }

        // Push SSE event (trim payload for client)
        // If previously offline, broadcast explicit status online
        if (appRef && appRef.locals && typeof appRef.locals.pushDeviceStatus === 'function') {
          if (device.status !== 'online') {
            appRef.locals.pushDeviceStatus(externalId, 'online');
          }
        }

        if (appRef && appRef.locals && typeof appRef.locals.pushTelemetry === 'function') {
          const pushPayload = {
            externalId,
            temperature: doc.temperature,
            humidity: doc.humidity,
            soilMoisture: doc.soilMoisture,
            lux: doc.lux,
            relayFan: stateUpdates.lastFanState || device.lastFanState,
            relayLight: stateUpdates.lastLightState || device.lastLightState,
            relayPump: stateUpdates.lastPumpState || device.lastPumpState,
            status: 'online',
            ts: doc.timestamp
          };
          appRef.locals.pushTelemetry(externalId, pushPayload);
        }

        // Automation with hysteresis and min toggle interval
        try {
          const now = new Date();
          const minGapMs = (device.minToggleIntervalSec || 0) * 1000;
          const devIdForTopic = device.externalId || device._id.toString();

          // Helper to gate toggles
          const canToggle = (lastAt) => {
            if (!lastAt) return true;
            return now - new Date(lastAt) >= minGapMs;
          };

          // FAN control based on temperature
          if (device.autoFanEnabled && typeof doc.temperature === 'number' && typeof device.autoFanTempAbove === 'number') {
            const hyst = device.autoFanHysteresis || 0;
            const shouldOn = device.lastFanState !== 'ON' && doc.temperature >= device.autoFanTempAbove + hyst;
            const shouldOff = device.lastFanState === 'ON' && doc.temperature <= device.autoFanTempAbove - hyst;
            if (shouldOn && canToggle(device.lastFanToggleAt)) {
              api.publishControl(devIdForTopic, 'fan', 'ON');
              await Device.findByIdAndUpdate(device._id, { lastFanToggleAt: now, lastFanState: 'ON' }).catch(() => {});
            } else if (shouldOff && canToggle(device.lastFanToggleAt)) {
              api.publishControl(devIdForTopic, 'fan', 'OFF');
              await Device.findByIdAndUpdate(device._id, { lastFanToggleAt: now, lastFanState: 'OFF' }).catch(() => {});
            }
          }

          // PUMP control based on soil moisture (lower is drier)
          if (device.autoPumpEnabled && typeof doc.soilMoisture === 'number' && typeof device.autoPumpSoilBelow === 'number') {
            const hyst = device.autoPumpHysteresis || 0;
            const shouldOn = device.lastPumpState !== 'ON' && doc.soilMoisture <= device.autoPumpSoilBelow - hyst;
            const shouldOff = device.lastPumpState === 'ON' && doc.soilMoisture >= device.autoPumpSoilBelow + hyst;
            if (shouldOn && canToggle(device.lastPumpToggleAt)) {
              api.publishControl(devIdForTopic, 'pump', 'ON');
              await Device.findByIdAndUpdate(device._id, { lastPumpToggleAt: now, lastPumpState: 'ON' }).catch(() => {});
            } else if (shouldOff && canToggle(device.lastPumpToggleAt)) {
              api.publishControl(devIdForTopic, 'pump', 'OFF');
              await Device.findByIdAndUpdate(device._id, { lastPumpToggleAt: now, lastPumpState: 'OFF' }).catch(() => {});
            }
          }

          // LIGHT control based on lux (lower is darker)
          if (device.autoLightEnabled && typeof doc.lux === 'number' && typeof device.autoLightLuxBelow === 'number') {
            const hyst = device.autoLightHysteresis || 0;
            const shouldOn = device.lastLightState !== 'ON' && doc.lux <= device.autoLightLuxBelow - hyst;
            const shouldOff = device.lastLightState === 'ON' && doc.lux >= device.autoLightLuxBelow + hyst;
            if (shouldOn && canToggle(device.lastLightToggleAt)) {
              api.publishControl(devIdForTopic, 'light', 'ON');
              await Device.findByIdAndUpdate(device._id, { lastLightToggleAt: now, lastLightState: 'ON' }).catch(() => {});
            } else if (shouldOff && canToggle(device.lastLightToggleAt)) {
              api.publishControl(devIdForTopic, 'light', 'OFF');
              await Device.findByIdAndUpdate(device._id, { lastLightToggleAt: now, lastLightState: 'OFF' }).catch(() => {});
            }
          }
        } catch(_){ }
        return;
      }

      // sensors/{deviceId}/status -> online/offline (if device publishes)
      if (parts[0] === 'sensors' && parts[2] === 'status') {
        const externalId = parts[1];
        const state = msg.toLowerCase();
        const status = state.includes('online') ? 'online' : 'offline';
        const device = await Device.findOne({ externalId: externalId }).lean();
        if (device) {
          const update = status === 'online' ? { status, lastSeenAt: new Date() } : { status };
          await Device.findByIdAndUpdate(device._id, update).catch(() => {});
          if (appRef && appRef.locals && typeof appRef.locals.pushDeviceStatus === 'function') {
            appRef.locals.pushDeviceStatus(externalId, status);
          }
        }
        return;
      }

      // devices/{deviceId}/cmd/ack -> keep support for future acks
      if (parts[0] === 'devices' && parts[2] === 'cmd' && parts[3] === 'ack') {
        const deviceId = parts[1];
        let ack;
        try { ack = JSON.parse(msg); } catch { return; }
        if (ack?.id) {
          const update = {};
          if (ack.status) update.status = ack.status;
          if (ack.executedAt) update.executedAt = new Date(ack.executedAt);
          await Command.findByIdAndUpdate(ack.id, update).catch(() => {});
        }
        return;
      }
    } catch (e) {
      console.error('MQTT message handler error', e);
    }
  });

  api.publishControl = (deviceId, target, action, cmd) => {
    if (!client || !client.connected) return;
    // ESP expects sensors/<id>/control[/fan|/light|/pump]
    const base = `sensors/${deviceId}/control`;
    const topic = target && target !== 'main' ? `${base}/${target}` : base;
    const payload = action; // plain text: ON/OFF
    client.publish(topic, payload, { qos: Number(process.env.MQTT_QOS || 1), retain: false });
  };

  return api;
}

module.exports = { initMqtt, mqtt: api };
