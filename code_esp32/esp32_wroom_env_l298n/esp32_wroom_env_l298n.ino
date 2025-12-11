#include <Wire.h>
#include <BH1750.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_AHTX0.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_system.h"
#include "esp_mac.h"  // thêm cho ESP32 core 3.0.0+

// --- Cấu hình phần cứng ---
#define SOIL_PIN 34        // chân ADC cho cảm biến độ ẩm đất (ADC1)
#define SDA_PIN 21         // I2C SDA (ESP32 mặc định thường 21)
#define SCL_PIN 22         // I2C SCL (ESP32 mặc định thường 22)

// Relay pins (thay theo nối dây của bạn)
#define RELAY_FAN_PIN 27
#define RELAY_LIGHT_PIN 26
#define RELAY_PUMP_PIN 33
const bool RELAY_ACTIVE_HIGH = true; // set true nếu relay bật khi HIGH, false nếu active LOW (đa số module relay dùng LOW)

// LED báo trạng thái WiFi (đèn xanh). Thay GPIO nếu board bạn dùng LED khác.
#ifndef WIFI_LED_PIN
#define WIFI_LED_PIN 2  // thường LED on-board là GPIO2 (có thể màu khác). Đổi thành chân nối LED xanh của bạn.
#endif

// Khoảng thời gian chớp khi mất WiFi
const unsigned long WIFI_BLINK_INTERVAL_MS = 500;

// Đảo cực LED nếu phần cứng active-LOW
const bool WIFI_LED_ACTIVE_HIGH = true; // đặt false nếu LED sáng khi LOW
inline void setWifiLed(bool on) {
  digitalWrite(WIFI_LED_PIN, (WIFI_LED_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH)));
}

// --- Cấu hình mạng / MQTT ---
const char* WIFI_SSID = "smart-farm";
// const char* WIFI_SSID = "duong";
const char* WIFI_PASS = "1234567890a";
// const char* MQTT_SERVER = "broker.emqx.io"; // thay bằng địa chỉ broker của bạn
const char* MQTT_SERVER = "192.168.2.1"; // thay bằng địa chỉ broker của bạn
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = ""; // để rỗng nếu không auth
const char* MQTT_PASSWD = "";

// Topic sẽ là: sensors/<deviceId>/data
String deviceId;

// --- Thông số cảm biến đất ---
const int SOIL_WET = 700;   // ví dụ: ướt
const int SOIL_DRY = 2500;  // ví dụ: khô

// --- Thời gian ---
const unsigned long PUBLISH_INTERVAL_MS = 1000UL; // gửi mỗi 10s

// --- Thư viện / đối tượng ---
BH1750 lightMeter;
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; // I2C
WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublish = 0;
bool bmp_present = false;

// Relay states
bool relayFanState = false;
bool relayLightState = false;
bool relayPumpState = false;

// Biến hỗ trợ chớp LED WiFi
unsigned long lastWifiBlink = 0;
bool wifiLedOn = false;

void setRelay(int pin, bool on) {
  if (RELAY_ACTIVE_HIGH) digitalWrite(pin, on ? HIGH : LOW);
  else digitalWrite(pin, on ? LOW : HIGH);
}

// Đặt relay về trạng thái OFF sớm nhất có thể để tránh kích khi khởi động
inline void relayOffBoot(int pin) {
  // Thủ thuật: set mức trước rồi chuyển sang OUTPUT để tránh nháy
  int offLevel = RELAY_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(pin, offLevel);
  pinMode(pin, OUTPUT);
}

// MQTT callback
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  msg.trim();
  msg.toUpperCase();
  Serial.print("MQTT msg on "); Serial.print(topic); Serial.print(": "); Serial.println(msg);

  String t = String(topic);
  if (t.endsWith("/control") || t.endsWith("/control/")) {
    // Hỗ trợ dạng gộp: "FAN ON" hoặc chỉ "FAN" => toggle
    if (msg.indexOf("FAN ON") >= 0) { relayFanState = true; setRelay(RELAY_FAN_PIN, true); }
    else if (msg.indexOf("FAN OFF") >= 0) { relayFanState = false; setRelay(RELAY_FAN_PIN, false); }
    else if (msg.indexOf("FAN") >= 0) { relayFanState = !relayFanState; setRelay(RELAY_FAN_PIN, relayFanState); }

    if (msg.indexOf("LIGHT ON") >= 0) { relayLightState = true; setRelay(RELAY_LIGHT_PIN, true); }
    else if (msg.indexOf("LIGHT OFF") >= 0) { relayLightState = false; setRelay(RELAY_LIGHT_PIN, false); }
    else if (msg.indexOf("LIGHT") >= 0) { relayLightState = !relayLightState; setRelay(RELAY_LIGHT_PIN, relayLightState); }

    if (msg.indexOf("PUMP ON") >= 0) { relayPumpState = true; setRelay(RELAY_PUMP_PIN, true); }
    else if (msg.indexOf("PUMP OFF") >= 0) { relayPumpState = false; setRelay(RELAY_PUMP_PIN, false); }
    else if (msg.indexOf("PUMP") >= 0) { relayPumpState = !relayPumpState; setRelay(RELAY_PUMP_PIN, relayPumpState); }
  }
  else if (t.endsWith("/fan")) {
    if (msg == "ON" || msg == "1") { relayFanState = true; setRelay(RELAY_FAN_PIN, true); }
    else if (msg == "OFF" || msg == "0") { relayFanState = false; setRelay(RELAY_FAN_PIN, false); }
  }
  else if (t.endsWith("/light")) {
    if (msg == "ON" || msg == "1") { relayLightState = true; setRelay(RELAY_LIGHT_PIN, true); }
    else if (msg == "OFF" || msg == "0") { relayLightState = false; setRelay(RELAY_LIGHT_PIN, false); }
  }
  else if (t.endsWith("/pump")) {
    if (msg == "ON" || msg == "1") { relayPumpState = true; setRelay(RELAY_PUMP_PIN, true); }
    else if (msg == "OFF" || msg == "0") { relayPumpState = false; setRelay(RELAY_PUMP_PIN, false); }
  }
}

// --- Hàm hỗ trợ ---
String getMacId() {
  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);  // ✅ dùng API mới cho ESP32 core 3.x
  char buf[32];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

int readSoilRaw() {
  int raw = analogRead(SOIL_PIN);
  return raw;
}

int soilPercentFromRaw(int raw) {
  raw = constrain(raw, SOIL_WET, SOIL_DRY);
  int pct = map(raw, SOIL_WET, SOIL_DRY, 100, 0);
  pct = constrain(pct, 0, 100);
  return pct;
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Connecting to WiFi %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: "); Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect WiFi");
  }
}

void mqttReconnect() {
  if (mqttClient.connected()) return;
  Serial.print("Connecting to MQTT...");
  String clientId = "esp32-client-" + deviceId;
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWD)) {
    Serial.println("connected");
    String base = String("sensors/") + deviceId + "/control";
    mqttClient.subscribe(base.c_str());
    mqttClient.subscribe((base + "/fan").c_str());
    mqttClient.subscribe((base + "/light").c_str());
    mqttClient.subscribe((base + "/pump").c_str());
    Serial.print("Subscribed control topics: "); Serial.println(base);
  } else {
    Serial.print("failed, rc=");
    Serial.print(mqttClient.state());
    Serial.println(" try again in 5s");
    delay(5000);
  }
}

void setup() {
  Serial.begin(115200);
  delay(100);

  // Đưa relay về OFF NGAY LẬP TỨC trước khi làm việc khác (WiFi/sensor)
  relayOffBoot(RELAY_FAN_PIN);
  relayOffBoot(RELAY_LIGHT_PIN);
  relayOffBoot(RELAY_PUMP_PIN);

  Wire.begin(SDA_PIN, SCL_PIN);

  if (aht.begin()) {
    Serial.println("AHT sensor initialised");
  } else {
    Serial.println("Could not find AHT sensor");
  }

  if (bmp.begin(0x76)) {
    bmp_present = true;
    Serial.println("BMP280 initialised at 0x76");
  } else if (bmp.begin(0x77)) {
    bmp_present = true;
    Serial.println("BMP280 initialised at 0x77");
  } else {
    bmp_present = false;
    Serial.println("Could not find BMP280 sensor");
  }

  if (lightMeter.begin()) {
    Serial.println("BH1750 initialised");
  } else {
    Serial.println("Could not find BH1750 sensor");
  }

  analogSetPinAttenuation(SOIL_PIN, ADC_11db);

  deviceId = "esp32-" + getMacId();
  Serial.print("Device ID: "); Serial.println(deviceId);

  connectWiFi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  // Relay đã ở OFF từ đầu, không cần set lại để tránh rung.

  // LED WiFi
  pinMode(WIFI_LED_PIN, OUTPUT);
  setWifiLed(false); // tắt lúc khởi động (sẽ bật/chớp nếu mất WiFi)

  lastPublish = millis();
}

void publishReadings() {
  float lux = 0.0;
  float lux_read = lightMeter.readLightLevel();
  if (lux_read > 0) lux = lux_read;

  float temperature = NAN;
  float humidity = NAN;
  float pressure_hpa = NAN;

  sensors_event_t humidityEvent, tempEvent;
  if (aht.getEvent(&humidityEvent, &tempEvent)) {
    humidity = humidityEvent.relative_humidity;
    temperature = tempEvent.temperature;
  }

  if (bmp_present) {
    float pressure_pa = bmp.readPressure();
    if (pressure_pa > 0) pressure_hpa = pressure_pa / 100.0f;
  }

  int soilRaw = readSoilRaw();
  int soilPct = soilPercentFromRaw(soilRaw);
  unsigned long uptime = millis() / 1000UL;

  char payload[512];
  int len = snprintf(payload, sizeof(payload),
    "{\"id\":\"%s\",\"temperature\":%s,\"humidity\":%s,"
    "\"pressure_hpa\":%s,\"lux\":%.1f,\"soil_pct\":%d,"
    "\"soil_raw\":%d,\"relay_fan\":%s,\"relay_light\":%s,"
    "\"relay_pump\":%s,\"uptime_s\":%lu}",
    deviceId.c_str(),
    isnan(temperature) ? "null" : String(temperature,1).c_str(),
    isnan(humidity) ? "null" : String(humidity,1).c_str(),
    isnan(pressure_hpa) ? "null" : String(pressure_hpa,2).c_str(),
    lux, soilPct, soilRaw,
    relayFanState ? "true" : "false",
    relayLightState ? "true" : "false",
    relayPumpState ? "true" : "false",
    uptime
  );

  String topic = String("sensors/") + deviceId + "/data";

  if (!mqttClient.connected()) mqttReconnect();
  if (mqttClient.connected()) {
    bool ok = mqttClient.publish(topic.c_str(), payload);
    Serial.print("Published to "); Serial.print(topic); Serial.print(" : "); Serial.println(payload);
    Serial.print("Publish ok: "); Serial.println(ok ? "true" : "false");
  } else {
    Serial.println("MQTT not connected, skip publish");
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqttClient.connected()) mqttReconnect();
  mqttClient.loop();

  // Quản lý LED báo WiFi:
  // - Nếu đã kết nối WiFi: tắt LED
  // - Nếu mất kết nối: chớp LED theo chu kỳ WIFI_BLINK_INTERVAL_MS
  if (WiFi.status() == WL_CONNECTED) {
    setWifiLed(false); // tắt đèn khi đã kết nối WiFi
  } else {
    unsigned long nowBlink = millis();
    if (nowBlink - lastWifiBlink >= WIFI_BLINK_INTERVAL_MS) {
      lastWifiBlink = nowBlink;
      wifiLedOn = !wifiLedOn;
      setWifiLed(wifiLedOn);
    }
  }

  unsigned long now = millis();
  if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = now;
    publishReadings();
  }
}
