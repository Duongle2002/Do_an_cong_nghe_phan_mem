const mqtt = require('mqtt');
const Device = require('../models/Device');
const SensorData = require('../models/SensorData');
const Command = require('../models/Command');
const Schedule = require('../models/Schedule');
const { checkAlertRules } = require('../services/alertService');

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
    // Follow ESP topics: support both old and new redesigned Smart Farm topics
    const topics = [
      'sensors/+/data', 'sensors/+/status', 'controllers/+/state', 'devices/+/cmd/ack',
      'farm/+/telemetry', 'farm/+/state', 'farm/+/ai_state'
    ];
    client.subscribe(topics, { qos: Number(process.env.MQTT_QOS || 1) }, (err) => {
      if (err) console.error('MQTT subscribe error', err);
    });
  });

  client.on('reconnect', () => console.log('MQTT reconnecting...'));
  client.on('error', (err) => console.error('MQTT error', err.message));

  client.on('message', async (topic, payload) => {
    console.log('MQTT received:', topic, payload.toString());
    try {
      const parts = topic.split('/');
      const msg = payload.toString();

      // 1. TELEMETRY TOPIC (Old: sensors/{deviceId}/data, New: farm/{deviceId}/telemetry)
      const isOldTelemetry = (parts[0] === 'sensors' && parts[2] === 'data');
      const isNewTelemetry = (parts[0] === 'farm' && parts[2] === 'telemetry');
      
      if (isOldTelemetry || isNewTelemetry) {
        const externalId = parts[1];
        let data;
        try { data = JSON.parse(msg); } catch (_) { console.warn('Telemetry JSON parse failed for externalId', externalId); return; }

        let device = await Device.findOne({ externalId });
        if (!device) {
          const ownerForAuto = process.env.AUTO_PROVISION_OWNER_ID;
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

        // Support both soil_pct and soil in payload
        const soilMoisture = typeof data.soil_pct === 'number' ? data.soil_pct : (typeof data.soil === 'number' ? data.soil : (typeof data.soilMoisture === 'number' ? data.soilMoisture : undefined));

        const doc = {
          deviceId: device._id,
          temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
          humidity: typeof data.humidity === 'number' ? data.humidity : undefined,
          soilMoisture: soilMoisture,
          pH: typeof data.pH === 'number' ? data.pH : undefined,
          lux: typeof data.lux === 'number' ? data.lux : undefined,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
        };
        try {
          await SensorData.create(doc);
          checkAlertRules(device._id, doc).catch(err => console.error('Alert check failed:', err));
        } catch (e) {
          console.error('Failed to persist telemetry for', externalId, e.message);
          return;
        }
        
        const stateUpdates = { status: 'online', lastSeenAt: new Date() };
        
        // Support both data.relay_fan and data.fan in payload
        const fanVal = typeof data.relay_fan === 'boolean' ? data.relay_fan : (typeof data.fan === 'boolean' ? data.fan : undefined);
        const lightVal = typeof data.relay_light === 'boolean' ? data.relay_light : (typeof data.light === 'boolean' ? data.light : undefined);
        const pumpVal = typeof data.relay_pump === 'boolean' ? data.relay_pump : (typeof data.pump === 'boolean' ? data.pump : undefined);

        if (fanVal !== undefined) stateUpdates.lastFanState = fanVal ? 'ON' : 'OFF';
        if (lightVal !== undefined) stateUpdates.lastLightState = lightVal ? 'ON' : 'OFF';
        if (pumpVal !== undefined) stateUpdates.lastPumpState = pumpVal ? 'ON' : 'OFF';
        
        try {
          const delta = {};
          if (typeof stateUpdates.lastFanState === 'string' && stateUpdates.lastFanState !== device.lastFanState) delta.lastFanToggleAt = new Date();
          if (typeof stateUpdates.lastLightState === 'string' && stateUpdates.lastLightState !== device.lastLightState) delta.lastLightToggleAt = new Date();
          if (typeof stateUpdates.lastPumpState === 'string' && stateUpdates.lastPumpState !== device.lastPumpState) delta.lastPumpToggleAt = new Date();
          await Device.findByIdAndUpdate(device._id, { $set: stateUpdates, $currentDate: delta }).catch(() => {});
          
          if (typeof stateUpdates.lastFanState === 'string') device.lastFanState = stateUpdates.lastFanState;
          if (typeof stateUpdates.lastLightState === 'string') device.lastLightState = stateUpdates.lastLightState;
          if (typeof stateUpdates.lastPumpState === 'string') device.lastPumpState = stateUpdates.lastPumpState;
        } catch(__) {
          Device.findByIdAndUpdate(device._id, stateUpdates).catch(() => {});
        }

        if (appRef && appRef.locals && typeof appRef.locals.pushDeviceStatus === 'function') {
          if (device.status !== 'online') {
            appRef.locals.pushDeviceStatus(externalId, 'online');
          }
        }

        if (appRef && appRef.locals && typeof appRef.locals.pushTelemetry === 'function') {
          // Find the paired S3 controller device to obtain its actual relay states if this is a WROOM node
          let s3Controller = null;
          if (externalId && (externalId.startsWith('esp32-') || externalId.startsWith('wroom-'))) {
            s3Controller = await Device.findOne({ pairedSensorId: externalId }).lean();
          }

          const currentFan = s3Controller ? s3Controller.lastFanState : (stateUpdates.lastFanState || device.lastFanState);
          const currentLight = s3Controller ? s3Controller.lastLightState : (stateUpdates.lastLightState || device.lastLightState);
          const currentPump = s3Controller ? s3Controller.lastPumpState : (stateUpdates.lastPumpState || device.lastPumpState);

          const pushPayload = {
            externalId,
            temperature: doc.temperature,
            humidity: doc.humidity,
            soilMoisture: doc.soilMoisture,
            lux: doc.lux,
            relayFan: currentFan || 'OFF',
            relayLight: currentLight || 'OFF',
            relayPump: currentPump || 'OFF',
            status: 'online',
            ts: doc.timestamp,
            opMode: s3Controller ? s3Controller.opMode : undefined
          };
          appRef.locals.pushTelemetry(externalId, pushPayload);
        }

        // Rule-based automation (skipped for TinyML devices to allow on-device AI control)
        try {
          const isTinyMLDevice = externalId && (externalId.startsWith('esp32-') || externalId.startsWith('wroom-'));
          if (isTinyMLDevice) {
            // TinyML devices handle their own automation logic on-device
            return;
          }

          const now = new Date();
          const minGapMs = (device.minToggleIntervalSec || 0) * 1000;
          const devIdForTopic = device.externalId || device._id.toString();

          const canToggle = (lastAt) => {
            if (!lastAt) return true;
            return now - new Date(lastAt) >= minGapMs;
          };

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
        } catch (_){ }
        return;
      }

      // 2. STATUS TOPIC (sensors/{deviceId}/status)
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

      // 3. STATE TOPIC (Old: controllers/{deviceId}/state, New: farm/{deviceId}/state)
      const isOldState = (parts[0] === 'controllers' && parts[2] === 'state');
      const isNewState = (parts[0] === 'farm' && parts[2] === 'state');

      if (isOldState || isNewState) {
        const externalId = parts[1];
        let data;
        try { data = JSON.parse(msg); } catch (_) { console.warn('Controller JSON parse failed for externalId', externalId); return; }

        let device = await Device.findOne({ externalId });
        if (!device) {
          const ownerForAuto = process.env.AUTO_PROVISION_OWNER_ID;
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
              console.log('Auto-provisioned device for controller externalId', externalId);
            } catch (e) {
              console.warn('Auto-provision failed for controller externalId', externalId, e.message);
            }
          }
        }

        if (!device) {
          console.warn('Controller state ignored: no device mapped for externalId', externalId);
          return;
        }

        const stateUpdates = { status: 'online', lastSeenAt: new Date() };
        
        const fanVal = typeof data.relay_fan === 'boolean' ? data.relay_fan : (typeof data.fan === 'boolean' ? data.fan : undefined);
        const lightVal = typeof data.relay_light === 'boolean' ? data.relay_light : (typeof data.light === 'boolean' ? data.light : undefined);
        const pumpVal = typeof data.relay_pump === 'boolean' ? data.relay_pump : (typeof data.pump === 'boolean' ? data.pump : undefined);

        if (fanVal !== undefined) stateUpdates.lastFanState = fanVal ? 'ON' : 'OFF';
        if (lightVal !== undefined) stateUpdates.lastLightState = lightVal ? 'ON' : 'OFF';
        if (pumpVal !== undefined) stateUpdates.lastPumpState = pumpVal ? 'ON' : 'OFF';
        if (typeof data.opMode === 'string') stateUpdates.opMode = data.opMode;

        try {
          const delta = {};
          if (typeof stateUpdates.lastFanState === 'string' && stateUpdates.lastFanState !== device.lastFanState) delta.lastFanToggleAt = new Date();
          if (typeof stateUpdates.lastLightState === 'string' && stateUpdates.lastLightState !== device.lastLightState) delta.lastLightToggleAt = new Date();
          if (typeof stateUpdates.lastPumpState === 'string' && stateUpdates.lastPumpState !== device.lastPumpState) delta.lastPumpToggleAt = new Date();
          await Device.findByIdAndUpdate(device._id, { $set: stateUpdates, $currentDate: delta }).catch(() => {});
          if (typeof stateUpdates.lastFanState === 'string') device.lastFanState = stateUpdates.lastFanState;
          if (typeof stateUpdates.lastLightState === 'string') device.lastLightState = stateUpdates.lastLightState;
          if (typeof stateUpdates.lastPumpState === 'string') device.lastPumpState = stateUpdates.lastPumpState;
        } catch (__){
          Device.findByIdAndUpdate(device._id, stateUpdates).catch(() => {});
        }

        if (appRef && appRef.locals && typeof appRef.locals.pushDeviceStatus === 'function') {
          if (device.status !== 'online') {
            appRef.locals.pushDeviceStatus(externalId, 'online');
          }
        }

        if (appRef && appRef.locals && typeof appRef.locals.pushTelemetry === 'function') {
          const currentFan = stateUpdates.lastFanState || device.lastFanState || 'OFF';
          const currentLight = stateUpdates.lastLightState || device.lastLightState || 'OFF';
          const currentPump = stateUpdates.lastPumpState || device.lastPumpState || 'OFF';

          let s3Ctrl = null;
          if (externalId && (externalId.startsWith('esp32-') || externalId.startsWith('wroom-'))) {
            s3Ctrl = await Device.findOne({ pairedSensorId: externalId }).lean();
          }
          const opModeVal = s3Ctrl ? s3Ctrl.opMode : (data.opMode || device.opMode);

          const pushPayload = {
            externalId,
            temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
            humidity: typeof data.humidity === 'number' ? data.humidity : undefined,
            soilMoisture: typeof data.soil_pct === 'number' ? data.soil_pct : (typeof data.soil === 'number' ? data.soil : undefined),
            lux: typeof data.lux === 'number' ? data.lux : undefined,
            relayFan: currentFan,
            relayLight: currentLight,
            relayPump: currentPump,
            status: 'online',
            ts: data.timestamp ? new Date(data.timestamp) : new Date(),
            opMode: opModeVal
          };
          appRef.locals.pushTelemetry(externalId, pushPayload);

          // Also push to paired WROOM sensor node stream so the Overview tab updates instantly
          if (device.pairedSensorId) {
            appRef.locals.pushTelemetry(device.pairedSensorId, {
              ...pushPayload,
              externalId: device.pairedSensorId
            });
          }
        }
        return;

      }

      // 4. COMMAND ACK (devices/{deviceId}/cmd/ack)
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

      // 5. AI STATE TOPIC (farm/{deviceId}/ai_state)
      if (parts[0] === 'farm' && parts[2] === 'ai_state') {
        const externalId = parts[1]; // WROOM node ID
        let data;
        try { data = JSON.parse(msg); } catch (_) { return; }

        // Find the paired S3 controller device
        const s3Controller = await Device.findOne({ pairedSensorId: externalId });
        if (!s3Controller) {
          // If no paired S3 controller is found, forward it directly to farm/WROOM_ID/state
          client.publish(`farm/${externalId}/state`, msg);
          return;
        }

        let allowedPump = data.pump;

        // Enforce 3-Tier safety window logic in AUTO mode:
        if (s3Controller.opMode === 'auto') {
          // If safety windows are defined, enforce them. Otherwise, let AI run normally.
          if (s3Controller.safetyWindows && s3Controller.safetyWindows.length > 0) {
            // Get current local time in HH:MM format (align with Asia/Ho_Chi_Minh timezone)
            const now = new Date();
            const currentHHMM = now.toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'Asia/Ho_Chi_Minh'
            });
            
            const insideSafetyWindow = s3Controller.safetyWindows.some(w => {
              if (w.start <= w.end) {
                return currentHHMM >= w.start && currentHHMM <= w.end;
              } else {
                return currentHHMM >= w.start || currentHHMM <= w.end;
              }
            });
            
            if (!insideSafetyWindow) {
              allowedPump = false; // Forced lockout outside the safety window
            }
          }
        } else if (s3Controller.opMode === 'scheduled' || s3Controller.opMode === 'manual') {
          // If S3 is in Manual or Scheduled mode, we block WROOM's automatic commands from updating relays
          // by setting allowed states to matching S3's current states
          data.fan = s3Controller.lastFanState === 'ON';
          data.light = s3Controller.lastLightState === 'ON';
          allowedPump = s3Controller.lastPumpState === 'ON';
        }

        const allowedState = {
          id: data.id,
          fan: data.fan,
          light: data.light,
          pump: allowedPump,
          relay_fan: data.fan,
          relay_light: data.light,
          relay_pump: allowedPump
        };

        client.publish(`farm/${externalId}/state`, JSON.stringify(allowedState));
        return;
      }
    } catch (e) {
      console.error('MQTT message handler error', e);
    }
  });

  api.publishControl = (deviceId, target, action, cmd) => {
    if (!client || !client.connected) return;
    
    // 1. Publish to the new Smart Farm topic structure: farm/<deviceId>/control/<target>
    const newTopic = `farm/${deviceId}/control/${target}`;
    client.publish(newTopic, action, { qos: 1, retain: false });
    console.log(`[MQTT] Published command to ${newTopic}: ${action}`);

    // 2. Keep compatibility with the old topic controllers/<deviceId>/control[/<target>]
    const oldBase = `controllers/${deviceId}/control`;
    const oldTopic = target && target !== 'main' ? `${oldBase}/${target}` : oldBase;
    client.publish(oldTopic, action, { qos: Number(process.env.MQTT_QOS || 1), retain: false });
  };

  api.publishConfig = (deviceId, configObj) => {
    if (!client || !client.connected) return;
    
    // Publish retained message containing configuration to S3 controller
    const topic = `farm/${deviceId}/config`;
    const payload = JSON.stringify(configObj);
    client.publish(topic, payload, { qos: 1, retain: true });
    console.log(`[MQTT] Published retained S3 config update to ${topic}: ${payload}`);
  };

  return api;
}

module.exports = { initMqtt, mqtt: api };
