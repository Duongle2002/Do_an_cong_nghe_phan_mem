# SmartFarm – ESP32 multi-board architecture

This folder contains three Arduino sketches for a split-hardware design:

- ESP32-C3 mini: reads pH sensor and controls a pump via relay
- ESP32-WROOM: reads temperature/humidity (DHT) and soil moisture, drives fan + light through L298N with PWM
- ESP32-S3 N16R8: runs an embedded MQTT broker and automation controller; optionally bridges to your Node.js MQTT broker

Required Arduino libraries:
- PubSubClient (by Nick O'Leary)
- ArduinoJson (by Benoit Blanchon)
- DHT sensor library (by Adafruit) + Adafruit Unified Sensor (for the WROOM sketch)
- TinyMqtt (by h2zero) for the ESP32-S3 broker
- WiFiManager (by tzapu) for captive portal configuration on ESP32-S3
- Adafruit GFX + Adafruit SSD1306 (for the 0.96" I2C OLED on ESP32-S3)

Directory structure:
- `esp32_c3_ph_pump/esp32_c3_ph_pump.ino`
- `esp32_wroom_env_l298n/esp32_wroom_env_l298n.ino`
- `esp32_s3_mqtt_broker_controller/esp32_s3_mqtt_broker_controller.ino`

MQTT topics and payloads:
- Data: `smartfarm/sensor`
  - Example payloads:
    - C3: `{ "deviceId": "esp32c3-ph", "pH": 6.85, "pump": 0 }`
    - WROOM: `{ "deviceId": "esp32wroom-env", "temperature": 30.2, "humidity": 65.5, "soilMoisture": 48, "fanDuty": 120, "lightDuty": 0 }`
- Control: `smartfarm/control`
  - Commands:
    - Pump: `{ "deviceId": "esp32c3-ph" | "*" | "pump", "action": "ON_PUMP"|"OFF_PUMP" }`
    - Fan: `{ "deviceId": "esp32wroom-env" | "*" | "env", "action": "ON_FAN"|"OFF_FAN"|"SET_FAN", "value": 0..255 }`
    - Light: `{ "deviceId": "esp32wroom-env" | "*" | "env", "action": "ON_LIGHT"|"OFF_LIGHT"|"SET_LIGHT", "value": 0..255 }`
- Alert: `smartfarm/alert`
  - Example: `{ "deviceId": "esp32c3-ph", "alert": "pH out of range: 8.1" }`

Pin suggestions (adjust to your wiring):
- ESP32-C3 SuperMini
  - pH sensor analog: GPIO1 (ADC1_CH1)
  - Pump relay: GPIO7
  - Lưu ý: tránh dùng các chân boot-strap cho điều khiển/ADC để không ảnh hưởng chế độ boot.
- ESP32-WROOM
  - DHT22: GPIO4
  - Soil moisture (analog): GPIO34
  - L298N Fan: IN1 GPIO27, IN2 GPIO26, ENA PWM GPIO14
  - L298N Light: IN3 GPIO25, IN4 GPIO33, ENB PWM GPIO32
- ESP32-S3: no pins required (broker only)
  - If using OLED I2C 0.96" (SSD1306): SDA=GPIO8, SCL=GPIO9 (editable via macros `OLED_SDA`/`OLED_SCL`), address 0x3C

AP+STA topology (recommended):
- ESP32-S3 acts as both AP and STA.
  - AP SSID: `MySmartFarm_Network` (configurable), typically gives AP IP `192.168.4.1`.
  - STA connects to your home router for Internet and Node.js access.
- ESP32-C3 and ESP32-WROOM connect to the S3 AP and use the AP IP as MQTT broker.
- S3 bridges sensor/control with your external MQTT broker when STA is online.

Setup steps:
1) Flash ESP32-S3 first. On boot, it opens a configuration portal if STA isn't configured:
  - Connect your phone/PC to WiFi `SmartFarm_Config` (password `12345678`).
  - Open the captive portal, enter your home WiFi (STA), AP SSID/password for child devices, and bridge host/port.
  - Settings are saved to NVS; S3 then runs AP+STA and starts the MQTT broker.
2) In C3 and WROOM sketches, set:
  - `WIFI_SSID`/`WIFI_PASSWORD` to S3’s AP credentials
  - `MQTT_BROKER_IP` to S3 AP IP (default often `192.168.4.1`)
3) Flash C3 and WROOM; verify both get IPs in the AP and publish to `smartfarm/sensor`.
4) Node.js server subscribes to `smartfarm/sensor` and publishes on `smartfarm/control` as before.

OLED screen on S3:
- Wiring: VCC->3V3, GND->GND, SDA->GPIO8, SCL->GPIO9 (or adjust in sketch).
- The S3 screen shows: AP/STA IPs, latest T/H/Soil/pH, current Fan/Light/Pump duty/state, and seconds since last update.

Calibration notes:
- pH: adjust `PH_SLOPE` and `PH_INTERCEPT` using two-point calibration with pH7.00 and pH4.00 buffer solutions.
- Soil moisture: tune the conversion from ADC to % depending on your sensor and wiring.

Troubleshooting:
- If devices don't receive control commands, ensure all subscribe to `smartfarm/control` and their `deviceId` filtering matches.
- If Node.js isn't receiving data, verify the S3 bridge config and broker reachability from the server.

PH module (6-pin) wiring notes:
- Many pH modules expose: V+, GND, AO/PO (analog), DO (digital comparator output), and trimmers/test points.
- For ESP32 ADC measurements, connect only V+, GND, and AO/PO to an ADC pin (GPIO1 in SuperMini suggestion).
- Ensure AO voltage never exceeds 3.3V. If the board outputs near 5V, you MUST add a resistor divider (e.g., 10k:20k) to bring it under 3.3V.
- In code, ADC attenuation is set to 11dB for better headroom (`analogSetPinAttenuation(..., ADC_11db)`).
