/*
  esp32_s3_mqtt_display.ino
  - ESP32-S3 sketch that connects to WiFi and MQTT
  - Subscribes to sensors/+/data and parses incoming JSON
  - Displays values on a 0.96" SSD1306 I2C OLED
  - Has 3 buttons to toggle fan/light/pump on the last-seen deviceId

  Required libraries (install in Arduino IDE Library Manager):
  - PubSubClient
  - Adafruit SSD1306
  - ArduinoJson
*/

#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// --------- CONFIG ---------
const char* WIFI_SSID = "smart-farm";
const char* WIFI_PASS = "1234567890a";
const char* MQTT_SERVER = "192.168.2.1";
// const char* MQTT_SERVER = "broker.emqx.io"; // thay bằng địa chỉ broker của bạn
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = "";
const char* MQTT_PASSWD = "";

// I2C pins (change for your board if needed)
#define SDA_PIN 8
#define SCL_PIN 9

// If your device reports relay states inverted compared to physical (or relay is active-LOW),
// set this to true to flip displayed ON/OFF labels on the S3 display only.
const bool RELAY_DISPLAY_INVERT = true;

// OLED config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Buttons (change pins to fit your board)
#define BTN_FAN_PIN   4
#define BTN_LIGHT_PIN 5
#define BTN_PUMP_PIN  13

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

// timing
unsigned long lastDisplayUpdate = 0;
const unsigned long DISPLAY_INTERVAL_MS = 1000;

// Forward
void connectWiFi();
void mqttReconnect();
void updateDisplay();
void handleButtons();

// Helper to publish control command to device
void publishControl(const String &deviceId, const char *subtopic, const char *msg) {
  if (deviceId.length() == 0) return;
  String topic = String("sensors/") + deviceId + "/control/" + subtopic;
  if (!mqttClient.connected()) mqttReconnect();
  if (mqttClient.connected()) {
    mqttClient.publish(topic.c_str(), msg);
    Serial.printf("Sent %s to %s\n", msg, topic.c_str());
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // copy to string
  String s;
  s.reserve(length+1);
  for (unsigned int i=0;i<length;i++) s += (char)payload[i];
  Serial.print("MQTT recv "); Serial.print(topic); Serial.print(" : "); Serial.println(s);

  // topic pattern: sensors/<deviceId>/data
  String t = String(topic);
  // parse deviceId
  int p1 = t.indexOf('/');
  int p2 = t.indexOf('/', p1+1);
  if (p1>=0 && p2>p1) {
    String base = t.substring(0,p1); // should be "sensors"
    String dev = t.substring(p1+1, p2);
    String tail = t.substring(p2+1);
    if (base == "sensors" && tail == "data") {
      lastDeviceId = dev;
      lastMsgMillis = millis();
      // parse JSON payload
      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, s);
      if (err) {
        Serial.print("JSON parse error: "); Serial.println(err.c_str());
        return;
      }
      // extract, handle nulls
      if (doc.containsKey("temperature")) current.temperature = doc["temperature"].isNull() ? NAN : doc["temperature"].as<float>();
      if (doc.containsKey("humidity")) current.humidity = doc["humidity"].isNull() ? NAN : doc["humidity"].as<float>();
      if (doc.containsKey("pressure_hpa")) current.pressure_hpa = doc["pressure_hpa"].isNull() ? NAN : doc["pressure_hpa"].as<float>();
      if (doc.containsKey("lux")) current.lux = doc["lux"].isNull() ? NAN : doc["lux"].as<float>();
      if (doc.containsKey("soil_pct")) current.soil_pct = doc["soil_pct"].isNull() ? -1 : doc["soil_pct"].as<int>();
      if (doc.containsKey("soil_raw")) current.soil_raw = doc["soil_raw"].isNull() ? -1 : doc["soil_raw"].as<int>();
      if (doc.containsKey("relay_fan")) current.relay_fan = doc["relay_fan"].as<bool>();
      if (doc.containsKey("relay_light")) current.relay_light = doc["relay_light"].as<bool>();
      if (doc.containsKey("relay_pump")) current.relay_pump = doc["relay_pump"].as<bool>();

      // update display next cycle
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(50);

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
  display.println("ESP32-S3 MQTT Display");
  display.display();

  // Buttons
  pinMode(BTN_FAN_PIN, INPUT_PULLUP);
  pinMode(BTN_LIGHT_PIN, INPUT_PULLUP);
  pinMode(BTN_PUMP_PIN, INPUT_PULLUP);

  // WiFi + MQTT
  connectWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);

  // subscribe to all sensor data topics
  if (!mqttClient.connected()) mqttReconnect();
  if (mqttClient.connected()) {
    mqttClient.subscribe("sensors/+/data");
    Serial.println("Subscribed to sensors/+/data");
  }

  // initial display
  lastDisplayUpdate = 0;
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqttClient.connected()) mqttReconnect();
  mqttClient.loop();

  handleButtons();

  unsigned long now = millis();
  if (now - lastDisplayUpdate >= DISPLAY_INTERVAL_MS) {
    lastDisplayUpdate = now;
    updateDisplay();
  }
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting WiFi %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(200);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else Serial.println("\nWiFi failed");
}

void mqttReconnect() {
  if (mqttClient.connected()) return;
  Serial.print("Connecting to MQTT...");
  String clientId = "esp32s3-display-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWD)) {
    Serial.println("connected");
    mqttClient.subscribe("sensors/+/data");
    Serial.println("Subscribed to sensors/+/data");
  } else {
    Serial.print("failed, rc="); Serial.print(mqttClient.state()); Serial.println(" try again in 5s");
    delay(5000);
  }
}

void updateDisplay() {
  display.clearDisplay();
  display.setCursor(0,0);
  display.setTextSize(1);
  // Device id is not shown by request

  display.print("Temp: ");
  if (!isnan(current.temperature)) display.print(current.temperature,1); else display.print("--");
  display.println(" C");

  display.print("Hum:  ");
  if (!isnan(current.humidity)) display.print(current.humidity,1); else display.print("--");
  display.println(" %");

  // display.print("Pres: ");
  // if (!isnan(current.pressure_hpa)) display.print(current.pressure_hpa,1); else display.print("--");
  // display.println(" hPa");

  display.print("Lux:  ");
  if (!isnan(current.lux)) display.print((int)current.lux); else display.print("--");
  display.println();

  display.print("Soil: ");
  if (current.soil_pct>=0) display.print(current.soil_pct); else display.print("--");
  display.print("% ");
  display.print(current.soil_raw>=0 ? current.soil_raw : 0);
  display.println();

  bool dispFan = RELAY_DISPLAY_INVERT ? !current.relay_fan : current.relay_fan;
  bool dispLight = RELAY_DISPLAY_INVERT ? !current.relay_light : current.relay_light;
  bool dispPump = RELAY_DISPLAY_INVERT ? !current.relay_pump : current.relay_pump;
  display.print("Fan:"); display.print(dispFan?"ON":"OFF");
  display.print(" Light:"); display.print(dispLight?"ON":"OFF");
  display.print(" Pump:"); display.print(dispPump?"ON":"OFF");

  // freshness
  display.setCursor(0,54);
  display.setTextSize(1);
  if (lastMsgMillis==0) display.println("No data yet");
  else {
    unsigned long age = (millis() - lastMsgMillis) / 1000;
    display.print("Last: "); display.print(age); display.println("s");
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
      // toggle and send
      bool wantOn = !current.relay_fan;
      publishControl(lastDeviceId, "fan", wantOn?"ON":"OFF");
      // optimistic update
      current.relay_fan = wantOn;
    }
  }
  // light
  if (sLight != lastBtnStateLight && (now - lastBtnTimeLight) > DEBOUNCE_MS) {
    lastBtnTimeLight = now;
    lastBtnStateLight = sLight;
    if (sLight == LOW) {
      bool wantOn = !current.relay_light;
      publishControl(lastDeviceId, "light", wantOn?"ON":"OFF");
      current.relay_light = wantOn;
    }
  }
  // pump
  if (sPump != lastBtnStatePump && (now - lastBtnTimePump) > DEBOUNCE_MS) {
    lastBtnTimePump = now;
    lastBtnStatePump = sPump;
    if (sPump == LOW) {
      bool wantOn = !current.relay_pump;
      publishControl(lastDeviceId, "pump", wantOn?"ON":"OFF");
      current.relay_pump = wantOn;
    }
  }
}
