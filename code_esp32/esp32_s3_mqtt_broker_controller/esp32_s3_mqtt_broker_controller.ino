/*
  esp32_s3_tinyml_controller.ino
  - ESP32-S3 sketch that connects to WiFi and MQTT
  - Subscribes to sensors/+/data and parses incoming JSON
  - Runs a tiny on-device inference model to decide fan/light/pump actions
  - Displays sensor values and AI decisions on a 0.96" SSD1306 I2C OLED
  - Has 3 buttons for manual override of fan/light/pump

  Required libraries (install in Arduino IDE Library Manager):
  - PubSubClient
  - Adafruit SSD1306
  - ArduinoJson

  TFLite Micro model:
  - Place a compiled model at LittleFS path /model.tflite
  - Expected contract: 4 input features, 3 output probabilities
*/

#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_GFX.h>
#include "../common/wifi_config_portal.h"
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <TensorFlowLite_ESP32.h>
#include "model.h"
#include <Preferences.h>

#include <tensorflow/lite/micro/all_ops_resolver.h>
#include <tensorflow/lite/micro/micro_error_reporter.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>

#ifndef TFLITE_SCHEMA_VERSION
#define TFLITE_SCHEMA_VERSION 3
#endif

// --------- CONFIG ---------
const char* WIFI_PORTAL_AP_SSID = "SmartFarm-S3-Setup";
const char* WIFI_PORTAL_AP_PASS = "12345678";
WifiConfigPortal wifiPortal("s3wifi", WIFI_PORTAL_AP_SSID, WIFI_PORTAL_AP_PASS, "ESP32-S3 Controller");
const char* MQTT_SERVER = "broker.emqx.io";
// const char* MQTT_SERVER = "192.168.2.1"; // thay bằng địa chỉ broker của bạn
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = "";
const char* MQTT_PASSWD = "";

// I2C pins (change for your board if needed)
#define SDA_PIN 8
#define SCL_PIN 9
// Buttons (change pins to fit your board)
#define BTN_FAN_PIN   7
#define BTN_LIGHT_PIN 5
#define BTN_PUMP_PIN  6
// Long-press WiFi reset button (hold to clear saved WiFi and restart)
#ifndef WIFI_RESET_BTN_PIN
#define WIFI_RESET_BTN_PIN 37
#endif
// Relay pins on the ESP32-S3 controller board. Change these to match your wiring.
#define RELAY_FAN_PIN   16
#define RELAY_LIGHT_PIN 17
#define RELAY_PUMP_PIN  18
// If your device reports relay states inverted compared to physical (or relay is active-LOW),
// set this to true to flip displayed ON/OFF labels on the S3 display only.
const bool RELAY_DISPLAY_INVERT = true;

// TinyML-style inference and control guard rails
const bool AUTO_CONTROL_ENABLED = true;
const unsigned long CONTROL_MIN_GAP_MS = 15000UL;
const unsigned long MANUAL_OVERRIDE_MS = 5UL * 60UL * 1000UL;
const char* TFLITE_MODEL_PATH = "/model.tflite";

// TinyML thresholds and overrides
const float THRESH_ON = 0.55f;        // probability needed to turn ON when currently OFF
const float THRESH_OFF = 0.40f;       // probability threshold to keep ON
const bool ENABLE_LUX_OVERRIDE = true; // if true, force light ON when lux <= LUX_OVERRIDE_LUX
const float LUX_OVERRIDE_LUX = 5.0f;   // lux threshold (<=) considered 'dark'


const bool RELAY_ACTIVE_HIGH = true;

// Expected model contract:
// inputs[0] = [temperature, humidity, soilMoisture, lux]
// outputs[0] = [fan_prob, light_prob, pump_prob]
constexpr int kInputFeatureCount = 4;
constexpr int kOutputCount = 3;
constexpr int kTensorArenaSize = 24 * 1024;

// OLED config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);



// debounce
const unsigned long DEBOUNCE_MS = 50;
unsigned long lastBtnTimeFan = 0, lastBtnTimeLight = 0, lastBtnTimePump = 0;
int lastBtnStateFan = HIGH, lastBtnStateLight = HIGH, lastBtnStatePump = HIGH;

// MQTT
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// Last seen deviceId and values
String lastDeviceId = "";
unsigned long lastMsgMillis = 0;
String controllerId = "";
bool wifiPortalInitialized = false;

struct SensorState {
  float temperature = NAN;
  float humidity = NAN;
  float pressure_hpa = NAN;
  float lux = NAN;
  int soil_pct = -1;
  int soil_raw = -1;
  bool relay_fan = false;
  bool relay_light = false;
  bool relay_pump = false;
} current;

struct RelayPrediction {
  bool valid = false;
  bool on = false;
  float probability = 0.0f;
};

struct ControlDecision {
  RelayPrediction fan;
  RelayPrediction light;
  RelayPrediction pump;
};

ControlDecision lastDecision;
bool hasTelemetry = false;
unsigned long manualOverrideUntilFan = 0;
unsigned long manualOverrideUntilLight = 0;
unsigned long manualOverrideUntilPump = 0;
unsigned long lastAutoPublishFan = 0;
unsigned long lastAutoPublishLight = 0;
unsigned long lastAutoPublishPump = 0;

// TensorFlow Lite Micro runtime
namespace {
  tflite::MicroErrorReporter microErrorReporter;
  tflite::ErrorReporter* errorReporter = &microErrorReporter;
  const tflite::Model* tfliteModel = nullptr;
  tflite::AllOpsResolver opResolver;
  tflite::MicroInterpreter* interpreter = nullptr;
  alignas(16) uint8_t tensorArena[kTensorArenaSize];
}

bool tfliteReady = false;
float modelInputs[kInputFeatureCount] = {0};
float modelOutputs[kOutputCount] = {0};

// OLED password entry state
enum DisplayState { MODE_NORMAL, MODE_PASS_EDIT };
DisplayState displayState = MODE_NORMAL;
char passBuf[33];
int passLen = 0;
int passCursor = 0;
const char* passCharset = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*()-_=+";

// marquee state for long strings on OLED
unsigned long marqueeLastAP = 0, marqueeLastKey = 0, marqueeLastSaved = 0;
int marqueeOffsetAP = 0, marqueeOffsetKey = 0, marqueeOffsetSaved = 0;
const unsigned long MARQUEE_INTERVAL_MS = 150;

// helper to draw marquee for a string at given y, using offset and timing state
void drawMarqueeLine(const String &txt, int16_t y, int &offset, unsigned long &lastUpdate, int16_t xStart = 0) {
  // ensure consistent metrics
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(txt, xStart, y, &x1, &y1, &w, &h);
  int16_t avail = SCREEN_WIDTH - xStart;

  // clear a slightly larger vertical area to avoid leftover pixels from previous frames
  int16_t top = y1 - 2;
  if (top < 0) top = 0;
  int16_t clearH = h + 4;
  if (top + clearH > SCREEN_HEIGHT) clearH = SCREEN_HEIGHT - top;
  display.fillRect(xStart, top, avail, clearH, SSD1306_BLACK);

  // if fits in remaining width, print at xStart
  if (w <= (uint16_t)avail) {
    display.setCursor(xStart, y);
    display.print(txt);
    return;
  }

  unsigned long now = millis();
  if (now - lastUpdate >= MARQUEE_INTERVAL_MS) {
    lastUpdate = now;
    offset++;
    if (offset > (int)(w + 8)) offset = 0;
  }

  // draw two copies for continuous scroll starting at xStart
  int x = xStart - offset;
  display.setCursor(x, y);
  display.print(txt);
  display.setCursor(x + w + 8, y);
  display.print(txt);
}

// print truncated text at xStart, append "..." if it doesn't fit
void printTruncated(const String &txt, int16_t xStart, int16_t y, int16_t maxWidth) {
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  int16_t x1, y1; uint16_t w, h;
  display.getTextBounds(txt, xStart, y, &x1, &y1, &w, &h);
  if ((int)w <= maxWidth) {
    display.setCursor(xStart, y);
    display.print(txt);
    return;
  }
  // need to truncate
  String s = txt;
  // append ellipsis length
  const String ell = "...";
  // binary shrink: shorten until fits
  while (s.length() > 0) {
    s.remove(s.length()-1);
    String cand = s + ell;
    display.getTextBounds(cand, xStart, y, &x1, &y1, &w, &h);
    if ((int)w <= maxWidth) {
      display.setCursor(xStart, y);
      display.print(cand);
      return;
    }
  }
  // fallback: print ellipses
  display.setCursor(xStart, y);
  display.print(ell);
}


// timing
unsigned long lastDisplayUpdate = 0;
const unsigned long DISPLAY_INTERVAL_MS = 1000;

// long-press reset
const unsigned long WIFI_RESET_HOLD_MS = 10000UL;
unsigned long wifiResetPressStart = 0;
bool wifiResetTriggered = false;

// Forward
void connectWiFi();
void mqttReconnect();
bool loadTinyMlModel();
bool runTinyMlInference();
void evaluateTinyMLAndControl();
void updateDisplay();
void handleButtons();

static void setRelay(int pin, bool on) {
  digitalWrite(pin, RELAY_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH));
}

static void relayOffBoot(int pin) {
  const int offLevel = RELAY_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(pin, offLevel);
  pinMode(pin, OUTPUT);
}

static void applyRelayState(bool &stateRef, int pin, bool on) {
  stateRef = on;
  setRelay(pin, on);
}

static String currentControlTopicId();

static const char* onOffText(bool value) {
  return value ? "ON" : "OFF";
}

static void printRelayDebug(const char *reason) {
  Serial.printf(
    "Relay debug [%s] fan=%s light=%s pump=%s | AI fan=%.3f light=%.3f pump=%.3f | source=%s\n",
    reason,
    onOffText(current.relay_fan),
    onOffText(current.relay_light),
    onOffText(current.relay_pump),
    lastDecision.fan.valid ? lastDecision.fan.probability : -1.0f,
    lastDecision.light.valid ? lastDecision.light.probability : -1.0f,
    lastDecision.pump.valid ? lastDecision.pump.probability : -1.0f,
    currentControlTopicId().c_str()
  );
}

static String currentControlTopicId() {
  return lastDeviceId.length() > 0 ? lastDeviceId : controllerId;
}

static void publishRelayState(const char *reason) {
  String topicId = currentControlTopicId();
  if (topicId.length() == 0) return;

  StaticJsonDocument<512> doc;
  doc["id"] = topicId;
  doc["controller_id"] = controllerId;
  doc["reason"] = reason;
  if (!isnan(current.temperature)) doc["temperature"] = current.temperature;
  if (!isnan(current.humidity)) doc["humidity"] = current.humidity;
  if (!isnan(current.pressure_hpa)) doc["pressure_hpa"] = current.pressure_hpa;
  if (!isnan(current.lux)) doc["lux"] = current.lux;
  if (current.soil_pct >= 0) doc["soil_pct"] = current.soil_pct;
  if (current.soil_raw >= 0) doc["soil_raw"] = current.soil_raw;
  doc["relay_fan"] = current.relay_fan;
  doc["relay_light"] = current.relay_light;
  doc["relay_pump"] = current.relay_pump;
  if (lastDecision.fan.valid) doc["fan_probability"] = lastDecision.fan.probability;
  if (lastDecision.light.valid) doc["light_probability"] = lastDecision.light.probability;
  if (lastDecision.pump.valid) doc["pump_probability"] = lastDecision.pump.probability;

  char payload[512];
  size_t len = serializeJson(doc, payload, sizeof(payload));
  if (len == 0) return;

  String topic = String("controllers/") + topicId + "/state";
  if (!mqttClient.connected()) mqttReconnect();
  if (mqttClient.connected()) {
    mqttClient.publish(topic.c_str(), payload);
    Serial.printf("Published state to %s\n", topic.c_str());
  }
  printRelayDebug(reason);
}

static void setRelayByName(const String &name, bool on, const char *reason) {
  if (name == "fan") {
    if (current.relay_fan != on) {
      Serial.printf("Relay change [%s] fan: %s -> %s\n", reason, onOffText(current.relay_fan), onOffText(on));
      applyRelayState(current.relay_fan, RELAY_FAN_PIN, on);
      publishRelayState(reason);
    }
  } else if (name == "light") {
    if (current.relay_light != on) {
      Serial.printf("Relay change [%s] light: %s -> %s\n", reason, onOffText(current.relay_light), onOffText(on));
      applyRelayState(current.relay_light, RELAY_LIGHT_PIN, on);
      publishRelayState(reason);
    }
  } else if (name == "pump") {
    if (current.relay_pump != on) {
      Serial.printf("Relay change [%s] pump: %s -> %s\n", reason, onOffText(current.relay_pump), onOffText(on));
      applyRelayState(current.relay_pump, RELAY_PUMP_PIN, on);
      publishRelayState(reason);
    }
  }
}

static float clamp01(float value) {
  if (value < 0.0f) return 0.0f;
  if (value > 1.0f) return 1.0f;
  return value;
}

static float normalizeRange(float value, float minValue, float maxValue) {
  if (isnan(value) || maxValue <= minValue) return 0.5f;
  return clamp01((value - minValue) / (maxValue - minValue));
}

static int8_t quantizeInt8(float value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  if (scale <= 0.0f) return 0;
  int q = (int)lroundf(value / scale) + zeroPoint;
  if (q < -128) q = -128;
  if (q > 127) q = 127;
  return (int8_t)q;
}

static uint8_t quantizeUInt8(float value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  if (scale <= 0.0f) return 0;
  int q = (int)lroundf(value / scale) + zeroPoint;
  if (q < 0) q = 0;
  if (q > 255) q = 255;
  return (uint8_t)q;
}

static float dequantizeValue(int32_t value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  return ((float)value - (float)zeroPoint) * scale;
}

static void publishIfNeeded(const char *subtopic, bool desiredOn, bool &currentState, unsigned long &lastPublishMs, unsigned long manualOverrideUntil) {
  if (!AUTO_CONTROL_ENABLED) return;
  if (lastDeviceId.length() == 0) return;
  if (millis() < manualOverrideUntil) return;
  if (desiredOn == currentState) return;

  unsigned long now = millis();
  if (now - lastPublishMs < CONTROL_MIN_GAP_MS) return;

  setRelayByName(subtopic, desiredOn, "auto");
  lastPublishMs = now;
}

bool loadTinyMlModel() {
  if (tfliteReady) return true;

  tfliteModel = tflite::GetModel(model_tflite);
  if (tfliteModel->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("TFLite model schema version mismatch");
    return false;
  }

  static tflite::MicroInterpreter staticInterpreter(
    tfliteModel,
    opResolver,
    tensorArena,
    kTensorArenaSize,
    errorReporter
  );
  interpreter = &staticInterpreter;

  TfLiteStatus allocateStatus = interpreter->AllocateTensors();
  if (allocateStatus != kTfLiteOk) {
    Serial.println("AllocateTensors failed");
    return false;
  }

  TfLiteTensor* input = interpreter->input(0);
  if (!input) {
    Serial.println("Missing input tensor");
    return false;
  }

  TfLiteTensor* output = interpreter->output(0);
  if (!output) {
    Serial.println("Missing output tensor");
    return false;
  }

  tfliteReady = true;
  Serial.println("TFLite model loaded successfully");
  return true;
}

bool runTinyMlInference() {
  if (!tfliteReady || !interpreter) return false;

  TfLiteTensor* input = interpreter->input(0);
  TfLiteTensor* output = interpreter->output(0);
  if (!input || !output) return false;

  const float temp = isnan(current.temperature) ? 25.0f : current.temperature;
  const float humid = isnan(current.humidity) ? 50.0f : current.humidity;
  const float soil = current.soil_pct >= 0 ? (float)current.soil_pct : 50.0f;
  const float lux = isnan(current.lux) ? 1000.0f : current.lux;

  // Keep the same feature order used during training.
  modelInputs[0] = normalizeRange(temp, 0.0f, 50.0f);
  modelInputs[1] = normalizeRange(humid, 0.0f, 100.0f);
  modelInputs[2] = normalizeRange(soil, 0.0f, 100.0f);
  modelInputs[3] = normalizeRange(lux, 0.0f, 5000.0f);

  const int inputCount = input->dims->data[input->dims->size - 1];
  if (inputCount < kInputFeatureCount) {
    Serial.println("Input tensor has fewer features than expected");
    return false;
  }

  for (int i = 0; i < kInputFeatureCount; i++) {
    switch (input->type) {
      case kTfLiteFloat32:
        input->data.f[i] = modelInputs[i];
        break;
      case kTfLiteInt8:
        input->data.int8[i] = quantizeInt8(modelInputs[i], input);
        break;
      case kTfLiteUInt8:
        input->data.uint8[i] = quantizeUInt8(modelInputs[i], input);
        break;
      default:
        Serial.println("Unsupported input tensor type");
        return false;
    }
  }

  if (interpreter->Invoke() != kTfLiteOk) {
    Serial.println("TFLite Invoke failed");
    return false;
  }

  const int availableOutputs = output->dims->data[output->dims->size - 1];
  const int copyCount = availableOutputs < kOutputCount ? availableOutputs : kOutputCount;
  for (int i = 0; i < copyCount; i++) {
    switch (output->type) {
      case kTfLiteFloat32:
        modelOutputs[i] = output->data.f[i];
        break;
      case kTfLiteInt8:
        modelOutputs[i] = dequantizeValue(output->data.int8[i], output);
        break;
      case kTfLiteUInt8:
        modelOutputs[i] = dequantizeValue(output->data.uint8[i], output);
        break;
      default:
        Serial.println("Unsupported output tensor type");
        return false;
    }
  }
  for (int i = copyCount; i < kOutputCount; i++) {
    modelOutputs[i] = 0.0f;
  }

  return true;
}

void evaluateTinyMLAndControl() {
  if (!hasTelemetry || lastDeviceId.length() == 0) return;
  if (!tfliteReady && !loadTinyMlModel()) {
    Serial.println("TinyML not ready, auto control skipped");
    return;
  }
  if (!runTinyMlInference()) return;

  lastDecision.fan.valid = true;
  lastDecision.fan.probability = modelOutputs[0];
  lastDecision.fan.on = current.relay_fan ? (lastDecision.fan.probability >= THRESH_OFF) : (lastDecision.fan.probability >= THRESH_ON);

  lastDecision.light.valid = true;
  lastDecision.light.probability = modelOutputs[1];
  lastDecision.light.on = current.relay_light ? (lastDecision.light.probability >= THRESH_OFF) : (lastDecision.light.probability >= THRESH_ON);

  lastDecision.pump.valid = true;
  lastDecision.pump.probability = modelOutputs[2];
  lastDecision.pump.on = current.relay_pump ? (lastDecision.pump.probability >= THRESH_OFF) : (lastDecision.pump.probability >= THRESH_ON);

  // Lux override: if it's very dark and override enabled, turn light ON (unless manually overridden)
  if (ENABLE_LUX_OVERRIDE && !isnan(current.lux)) {
    if (current.lux <= LUX_OVERRIDE_LUX && millis() >= manualOverrideUntilLight) {
      lastDecision.light.on = true;
    }
  }

  Serial.printf(
    "AI decision fan=%.3f->%s light=%.3f->%s pump=%.3f->%s\n",
    lastDecision.fan.probability,
    onOffText(lastDecision.fan.on),
    lastDecision.light.probability,
    onOffText(lastDecision.light.on),
    lastDecision.pump.probability,
    onOffText(lastDecision.pump.on)
  );

  publishIfNeeded("fan", lastDecision.fan.on, current.relay_fan, lastAutoPublishFan, manualOverrideUntilFan);
  publishIfNeeded("light", lastDecision.light.on, current.relay_light, lastAutoPublishLight, manualOverrideUntilLight);
  publishIfNeeded("pump", lastDecision.pump.on, current.relay_pump, lastAutoPublishPump, manualOverrideUntilPump);
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // copy to string
  String s;
  s.reserve(length+1);
  for (unsigned int i=0;i<length;i++) s += (char)payload[i];
  Serial.print("MQTT recv "); Serial.print(topic); Serial.print(" : "); Serial.println(s);

  // topic patterns:
  //   sensors/<deviceId>/data
  //   controllers/<deviceId>/control[/fan|light|pump]
  String t = String(topic);
  // parse deviceId
  int p1 = t.indexOf('/');
  int p2 = t.indexOf('/', p1+1);
  if (p1>=0 && p2>p1) {
    String base = t.substring(0,p1); // should be "sensors"
    String dev = t.substring(p1+1, p2);
    String tail = t.substring(p2+1);
    if (base == "sensors" && tail == "data") {
      if (lastDeviceId != dev) {
        manualOverrideUntilFan = 0;
        manualOverrideUntilLight = 0;
        manualOverrideUntilPump = 0;
      }
      lastDeviceId = dev;
      lastMsgMillis = millis();
      // parse JSON payload
      StaticJsonDocument<256> doc;
      DeserializationError err = deserializeJson(doc, s);
      if (err) {
        Serial.print("JSON parse error: "); Serial.println(err.c_str());
        return;
      }
      // extract, handle nulls
      if (doc["temperature"].is<float>()) current.temperature = doc["temperature"].isNull() ? NAN : doc["temperature"].as<float>();
      if (doc["humidity"].is<float>()) current.humidity = doc["humidity"].isNull() ? NAN : doc["humidity"].as<float>();
      if (doc["pressure_hpa"].is<float>()) current.pressure_hpa = doc["pressure_hpa"].isNull() ? NAN : doc["pressure_hpa"].as<float>();
      if (doc["lux"].is<float>()) current.lux = doc["lux"].isNull() ? NAN : doc["lux"].as<float>();
      if (doc["soil_pct"].is<int>()) current.soil_pct = doc["soil_pct"].isNull() ? -1 : doc["soil_pct"].as<int>();
      if (doc["soil_raw"].is<int>()) current.soil_raw = doc["soil_raw"].isNull() ? -1 : doc["soil_raw"].as<int>();
      if (doc["relay_fan"].is<bool>()) current.relay_fan = doc["relay_fan"].as<bool>();
      if (doc["relay_light"].is<bool>()) current.relay_light = doc["relay_light"].as<bool>();
      if (doc["relay_pump"].is<bool>()) current.relay_pump = doc["relay_pump"].as<bool>();

      hasTelemetry = true;
      evaluateTinyMLAndControl();
      publishRelayState("telemetry");

      // update display next cycle
      return;
    }

    if (base == "controllers" && (tail == "control" || tail.startsWith("control/"))) {
      controllerId = dev;
      if (lastDeviceId.length() == 0) lastDeviceId = dev;

      String msg;
      for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
      msg.trim();
      msg.toUpperCase();

      String target = "";
      if (tail.startsWith("control/")) {
        target = tail.substring(String("control/").length());
      }

      auto handleTarget = [&](const String &name) {
        if (name.length() == 0) return false;
        if (msg == "ON" || msg == "1") {
          setRelayByName(name, true, "command");
          return true;
        }
        if (msg == "OFF" || msg == "0") {
          setRelayByName(name, false, "command");
          return true;
        }
        return false;
      };

      if (target.length() > 0) {
        handleTarget(target);
      } else {
        if (msg.indexOf("FAN ON") >= 0) setRelayByName("fan", true, "command");
        else if (msg.indexOf("FAN OFF") >= 0) setRelayByName("fan", false, "command");
        else if (msg.indexOf("FAN") >= 0) setRelayByName("fan", !current.relay_fan, "command");

        if (msg.indexOf("LIGHT ON") >= 0) setRelayByName("light", true, "command");
        else if (msg.indexOf("LIGHT OFF") >= 0) setRelayByName("light", false, "command");
        else if (msg.indexOf("LIGHT") >= 0) setRelayByName("light", !current.relay_light, "command");

        if (msg.indexOf("PUMP ON") >= 0) setRelayByName("pump", true, "command");
        else if (msg.indexOf("PUMP OFF") >= 0) setRelayByName("pump", false, "command");
        else if (msg.indexOf("PUMP") >= 0) setRelayByName("pump", !current.relay_pump, "command");
      }

      publishRelayState("command");
      return;
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(50);

  controllerId = "esp32s3-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  relayOffBoot(RELAY_FAN_PIN);
  relayOffBoot(RELAY_LIGHT_PIN);
  relayOffBoot(RELAY_PUMP_PIN);

  // I2C
  Wire.begin(SDA_PIN, SCL_PIN);

  // OLED init
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { // common addr 0x3C
    Serial.println("SSD1306 allocation failed");
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("ESP32-S3 TinyML");
  display.println("MQTT controller");
  display.display();

  // Buttons
  pinMode(BTN_FAN_PIN, INPUT_PULLUP);
  pinMode(BTN_LIGHT_PIN, INPUT_PULLUP);
  pinMode(BTN_PUMP_PIN, INPUT_PULLUP);
  // Reset button
  pinMode(WIFI_RESET_BTN_PIN, INPUT_PULLUP);

  // WiFi + MQTT
  connectWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);

  // subscribe to all sensor data topics
  if (!mqttClient.connected()) mqttReconnect();
  if (mqttClient.connected()) {
    mqttClient.subscribe("sensors/+/data");
    mqttClient.subscribe("controllers/+/control");
    mqttClient.subscribe("controllers/+/control/+");
    Serial.println("Subscribed to sensors/+/data");
    Serial.println("Subscribed to controllers/+/control");
  }

  // initial display
  lastDisplayUpdate = 0;
}

void loop() {
  wifiPortal.process();
  // long-press reset button logic (hold LOW for WIFI_RESET_HOLD_MS)
  unsigned long nowLoop = millis();
  int resetRead = digitalRead(WIFI_RESET_BTN_PIN);
  if (resetRead == LOW) {
    if (wifiResetPressStart == 0) wifiResetPressStart = nowLoop;
    // if held for 6s show countdown then reset
    const unsigned long WARN_MS = 6000UL;
    if (!wifiResetTriggered && (nowLoop - wifiResetPressStart >= WARN_MS)) {
      wifiResetTriggered = true;
      Serial.println("Reset button held: starting countdown to reset WiFi...");
      // countdown 3..1 on OLED
      for (int c = 3; c >= 1; c--) {
        display.clearDisplay();
        display.setTextSize(1);
        display.setCursor(0, (SCREEN_HEIGHT/2)-8);
        display.printf("Reset WiFi in %d", c);
        display.display();
        delay(800);
      }

      // perform clear and restart
      Serial.println("Clearing stored WiFi and restarting...");
      display.clearDisplay();
      display.setCursor(0, (SCREEN_HEIGHT/2)-4);
      display.println("Resetting WiFi...");
      display.display();
      delay(300);

      Preferences prefs;
      prefs.begin("s3wifi", false);
      prefs.putString("wifi_ssid", "");
      prefs.putString("wifi_pass", "");
      prefs.end();
      delay(200);
      ESP.restart();
    }
  } else {
    wifiResetPressStart = 0;
    wifiResetTriggered = false;
  }
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected()) mqttReconnect();
  mqttClient.loop();

  handleButtons();

  unsigned long now = millis();
  if (now - lastDisplayUpdate >= DISPLAY_INTERVAL_MS) {
    lastDisplayUpdate = now;
    updateDisplay();
  }
}

void connectWiFi() {
  if (wifiPortalInitialized) return;
  wifiPortalInitialized = true;
  WiFi.persistent(true);
  WiFi.setAutoReconnect(true);
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("Starting WiFi config portal or reconnecting saved WiFi...");
  wifiPortal.begin();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  }
}

void mqttReconnect() {
  if (mqttClient.connected()) return;
  Serial.print("Connecting to MQTT...");
  String clientId = "esp32s3-display-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWD)) {
    Serial.println("connected");
    mqttClient.subscribe("sensors/+/data");
    mqttClient.subscribe("controllers/+/control");
    mqttClient.subscribe("controllers/+/control/+");
    Serial.println("Subscribed to sensors/+/data");
    Serial.println("Subscribed to controllers/+/control");
  } else {
    Serial.print("failed, rc="); Serial.print(mqttClient.state()); Serial.println(" try again in 5s");
    delay(5000);
  }
}

void updateDisplay() {
  display.clearDisplay();
  display.setCursor(0,0);
  display.setTextSize(1);
  display.setTextWrap(true);

  // draw wifi signal bars at top-right
  auto drawWifiBars = [&]() {
    int bars = 0;
    if (WiFi.status() == WL_CONNECTED) {
      int rssi = WiFi.RSSI();
      if (rssi > -50) bars = 4;
      else if (rssi > -60) bars = 3;
      else if (rssi > -70) bars = 2;
      else if (rssi > -80) bars = 1;
      else bars = 0;
    } else {
      bars = 0;
    }
    const int bw = 3; // bar width
    const int spacing = 1;
    for (int i = 0; i < 4; i++) {
      int h = (i + 1) * 3;
      int x = SCREEN_WIDTH - ((4 - i) * (bw + spacing));
      int y = 2 + (12 - h);
      if (i < bars) display.fillRect(x, y, bw, h, SSD1306_WHITE);
      else display.drawRect(x, y, bw, h, SSD1306_WHITE);
    }
  };
  drawWifiBars();
  bool dispFan = RELAY_DISPLAY_INVERT ? !current.relay_fan : current.relay_fan;
  bool dispLight = RELAY_DISPLAY_INVERT ? !current.relay_light : current.relay_light;
  bool dispPump = RELAY_DISPLAY_INVERT ? !current.relay_pump : current.relay_pump;

  // if not connected, show portal/connect instructions
  if (WiFi.status() != WL_CONNECTED) {
    display.setCursor(0, 12);
    display.setTextSize(1);
    if (displayState == MODE_PASS_EDIT) {
      // password edit UI
      display.println("Enter WiFi password:");
      display.println();
      // masked password
      String masked;
      for (int i = 0; i < passLen; i++) masked += (i == passCursor ? '_' : '*');
      if (passLen == 0) masked = "(empty)";
      display.println(masked);
      display.println();
      display.println("FAN:char  LIGHT:next  PUMP:save");
      display.display();
      return;
    }

    // Explicitly position lines to avoid overlap with marquee drawing.
    display.setTextSize(1);
    display.setCursor(0, 12);
    display.println("WiFi: NOT CONNECTED");

    // AP label + marquee (uses its own x positioning)
    display.setCursor(0, 24);
    display.print("AP:");
    printTruncated(String(WIFI_PORTAL_AP_SSID), 28, 24, SCREEN_WIDTH - 28);

    // Key label + marquee
    display.setCursor(0, 36);
    display.print("Key:");
    printTruncated(String(WIFI_PORTAL_AP_PASS), 28, 36, SCREEN_WIDTH - 28);

    // Link (show portal IP)
    display.setCursor(0, 50);
    display.print("Link: "); display.println(wifiPortal.ip());

    display.display();
    return;
  }

  // connected: show telemetry and states
  display.print("T:");
  if (!isnan(current.temperature)) display.print(current.temperature, 1); else display.print("--");
  display.print(" H:");
  if (!isnan(current.humidity)) display.print(current.humidity, 1); else display.print("--");
  display.println();

  display.print("L:");
  if (!isnan(current.lux)) display.print((int)current.lux); else display.print("--");
  display.print(" S:");
  if (current.soil_pct >= 0) display.print(current.soil_pct); else display.print("--");
  display.print("%");
  display.print("/");
  display.println(current.soil_raw >= 0 ? current.soil_raw : 0);

  display.print("Act F:"); display.print(dispFan ? "ON" : "OFF");
  display.print(" L:"); display.print(dispLight ? "ON" : "OFF");
  display.println();

  display.print("Act P:"); display.print(dispPump ? "ON" : "OFF");
  display.print(" AI F:");
  if (lastDecision.fan.valid) display.print(lastDecision.fan.on ? "ON" : "OFF"); else display.print("--");
  display.print(" L:");
  if (lastDecision.light.valid) display.print(lastDecision.light.on ? "ON" : "OFF"); else display.print("--");
  display.println();

  display.print("AI P:");
  if (lastDecision.pump.valid) display.print(lastDecision.pump.on ? "ON" : "OFF"); else display.print("--");
  display.print(" M:");
  display.print(tfliteReady ? "OK" : "NO");
  display.print(" ");
  if (lastMsgMillis == 0) display.print("No data");
  else {
    unsigned long age = (millis() - lastMsgMillis) / 1000;
    display.print("Last:");
    display.print(age);
    display.print("s");
  }

  display.display();
}

void handleButtons() {
  int sFan = digitalRead(BTN_FAN_PIN);
  int sLight = digitalRead(BTN_LIGHT_PIN);
  int sPump = digitalRead(BTN_PUMP_PIN);
  unsigned long now = millis();

  // fan
  if (sFan != lastBtnStateFan && (now - lastBtnTimeFan) > DEBOUNCE_MS) {
    lastBtnTimeFan = now;
    lastBtnStateFan = sFan;
    if (sFan == LOW) { // pressed (INPUT_PULLUP)
      if (displayState == MODE_PASS_EDIT) {
        // cycle character at cursor
        char cur = passCursor < passLen ? passBuf[passCursor] : '\0';
        const char* cs = passCharset;
        int idx = 0;
        if (cur != '\0') {
          const char* p = strchr(cs, cur);
          if (p) idx = (p - cs + 1) % strlen(cs);
        }
        char next = cs[idx];
        if (passCursor < passLen) passBuf[passCursor] = next; else { passBuf[passLen++] = next; passBuf[passLen] = '\0'; }
      } else {
        // toggle and send
        bool wantOn = !current.relay_fan;
        manualOverrideUntilFan = millis() + MANUAL_OVERRIDE_MS;
        setRelayByName("fan", wantOn, "button");
      }
    }
  }
  // light
  if (sLight != lastBtnStateLight && (now - lastBtnTimeLight) > DEBOUNCE_MS) {
    lastBtnTimeLight = now;
    lastBtnStateLight = sLight;
    if (sLight == LOW) {
      if (displayState == MODE_PASS_EDIT) {
        // move cursor right
        if (passCursor < 31) passCursor++;
        if (passCursor > passLen) { passLen = passCursor; passBuf[passLen] = '\0'; }
      } else if (WiFi.status() != WL_CONNECTED && wifiPortal.ssid().length() > 0) {
        // enter password edit mode for saved SSID
        displayState = MODE_PASS_EDIT;
        String spass = wifiPortal.password();
        passLen = 0; passCursor = 0;
        if (spass.length() > 0) {
          int copyLen = spass.length() < 32 ? spass.length() : 32;
          for (int j = 0; j < copyLen; j++) passBuf[j] = spass.charAt(j);
          passLen = copyLen;
          passBuf[passLen] = '\0';
        } else {
          passLen = 0; passBuf[0] = '\0';
        }
      } else {
        bool wantOn = !current.relay_light;
        manualOverrideUntilLight = millis() + MANUAL_OVERRIDE_MS;
        setRelayByName("light", wantOn, "button");
      }
    }
  }
  // pump
  if (sPump != lastBtnStatePump && (now - lastBtnTimePump) > DEBOUNCE_MS) {
    lastBtnTimePump = now;
    lastBtnStatePump = sPump;
    if (sPump == LOW) {
      if (displayState == MODE_PASS_EDIT) {
        // submit password
        passBuf[passLen] = '\0';
        Preferences prefs;
        prefs.begin("s3wifi", false);
        prefs.putString("wifi_pass", String(passBuf));
        prefs.end();
        Serial.println("Password saved to NVS");
        displayState = MODE_NORMAL;
      } else {
        bool wantOn = !current.relay_pump;
        manualOverrideUntilPump = millis() + MANUAL_OVERRIDE_MS;
        setRelayByName("pump", wantOn, "button");
      }
    }
  }
}
