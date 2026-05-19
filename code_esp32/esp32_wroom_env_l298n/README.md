# SmartFarm 2-layer ESP32 architecture

This folder now reflects the split design:

- ESP32-WROOM acts as the sensor node only.
- ESP32-S3 handles TinyML decisions and relay control locally.
- Server / Flutter stay above the hardware layer and consume MQTT/HTTP from the Node.js backend.
- Both ESP32 boards now expose a first-boot WiFi setup portal and save credentials in NVS.

## Sketches

- [esp32_wroom_env_l298n.ino](esp32_wroom_env_l298n.ino) publishes telemetry only.
- [esp32_s3_mqtt_broker_controller.ino](esp32_s3_mqtt_broker_controller/esp32_s3_mqtt_broker_controller.ino) subscribes to telemetry, runs heuristic control, and drives relays.

## MQTT flow

- Sensor telemetry: `sensors/<sensorId>/data`
- Control commands to the S3: `controllers/<sensorId>/control[/fan|light|pump]`
- Relay state from the S3: `controllers/<sensorId>/state`

Example sensor payload:

```json
{
  "id": "esp32-ABCDEF123456",
  "node_type": "sensor",
  "temperature": 30.2,
  "humidity": 65.5,
  "pressure_hpa": 1008.4,
  "lux": 420.0,
  "soil_pct": 48,
  "soil_raw": 1820,
  "uptime_s": 1234
}
```

Example controller state payload:

```json
{
  "id": "esp32-ABCDEF123456",
  "controller_id": "esp32s3-1234ABCD",
  "reason": "auto",
  "relay_fan": true,
  "relay_light": false,
  "relay_pump": true
}
```

## Wiring hints

- ESP32-WROOM sensor node
  - BH1750: SDA GPIO21, SCL GPIO22
  - AHTX0 / BMP280: same I2C bus
  - Soil moisture: GPIO34
- ESP32-S3 controller node
  - OLED: SDA GPIO8, SCL GPIO9
  - Relays: edit `RELAY_FAN_PIN`, `RELAY_LIGHT_PIN`, `RELAY_PUMP_PIN` in the sketch to match your wiring
  - Buttons: fan GPIO4, light GPIO5, pump GPIO13

## Deployment order

1. Flash the ESP32-WROOM first and confirm it publishes `sensors/<sensorId>/data`.
2. Flash the ESP32-S3 and confirm it receives the sensor telemetry, then drives the relay outputs locally.
3. Keep the Node.js server connected to the same MQTT broker. It already exposes HTTP APIs for the Flutter app and now understands the controller namespace too.

## Notes

- The WROOM sketch is intentionally telemetry-only, so it boots faster and stays simpler.
- The S3 sketch keeps AI inference and actuator control together, which makes the control loop more resilient if the sensor node temporarily drops offline.
