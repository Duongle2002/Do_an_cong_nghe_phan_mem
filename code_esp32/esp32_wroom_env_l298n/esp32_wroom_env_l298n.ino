#include <Wire.h>
#include <BH1750.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_AHTX0.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_mac.h"  // thêm cho ESP32 core 3.0.0+
#include "../common/wifi_config_portal.h"
#include <Preferences.h>

// --- Cấu hình phần cứng ---
#define SOIL_PIN 34        // chân ADC cho cảm biến độ ẩm đất (ADC1)
#define SDA_PIN 21         // I2C SDA (ESP32 mặc định thường 21)
#define SCL_PIN 22         // I2C SCL (ESP32 mặc định thường 22)

// LED báo trạng thái WiFi (đèn xanh). Thay GPIO nếu board bạn dùng LED khác.
#ifndef WIFI_LED_PIN
#define WIFI_LED_PIN 2  // thường LED on-board là GPIO2 (có thể màu khác). Đổi thành chân nối LED xanh của bạn.
#endif

// Nút cứng để reset WiFi: nhấn giữ trong 6s để bắt đầu countdown 3..2..1 rồi xóa NVS và khởi động lại
#ifndef WIFI_RESET_BTN_PIN
#define WIFI_RESET_BTN_PIN 27 // thay đổi nếu chân khác trên board của bạn
#endif

const unsigned long WIFI_RESET_HOLD_MS = 6000UL;
unsigned long wifiResetPressStart = 0;
bool wifiResetTriggered = false;

// Khoảng thời gian chớp khi mất WiFi
const unsigned long WIFI_BLINK_INTERVAL_MS = 500;

// Đảo cực LED nếu phần cứng active-LOW
const bool WIFI_LED_ACTIVE_HIGH = true; // đặt false nếu LED sáng khi LOW
inline void setWifiLed(bool on) {
  digitalWrite(WIFI_LED_PIN, (WIFI_LED_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH)));
}

// --- Cấu hình mạng / MQTT ---
const char* WIFI_PORTAL_AP_SSID = "SmartFarm-WROOM-Setup";
const char* WIFI_PORTAL_AP_PASS = "12345678";
WifiConfigPortal wifiPortal("wroomwifi", WIFI_PORTAL_AP_SSID, WIFI_PORTAL_AP_PASS, "ESP32 WROOM Sensor");
const char* MQTT_SERVER = "broker.emqx.io"; // MQTT broker public
const uint16_t MQTT_PORT = 1883;
const char* MQTT_USER = ""; // để rỗng nếu không auth
const char* MQTT_PASSWD = "";

// Topic sẽ là: sensors/<deviceId>/data
String deviceId;

// --- Thông số cảm biến đất ---
const int SOIL_WET = 700;   // ví dụ: ướt
const int SOIL_DRY = 2500;  // ví dụ: khô

// --- Thời gian ---
const unsigned long PUBLISH_INTERVAL_MS = 10000UL; // gửi mỗi 10s

// --- Thư viện / đối tượng ---
BH1750 lightMeter;
Adafruit_AHTX0 aht;
Adafruit_BMP280 bmp; // I2C
WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastPublish = 0;
bool bmp_present = false;
bool wifiPortalInitialized = false;

// Biến hỗ trợ chớp LED WiFi
unsigned long lastWifiBlink = 0;
bool wifiLedOn = false;

// --- Hàm hỗ trợ ---
String getMacId() {
  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);  
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

void mqttReconnect() {
  if (mqttClient.connected()) return;
  String clientId = "esp32-wroom-" + deviceId;
  Serial.print("Connecting to MQTT as ");
  Serial.println(clientId);

  bool ok;
  if (strlen(MQTT_USER) > 0) {
    ok = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWD);
  } else {
    ok = mqttClient.connect(clientId.c_str());
  }

  if (ok) {
    Serial.println("MQTT connected");
  } else {
    Serial.print("MQTT connect failed, rc=");
    Serial.println(mqttClient.state());
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

void setup() {
  Serial.begin(115200);
  delay(100);

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
  if (WiFi.status() == WL_CONNECTED) mqttReconnect();

  // LED WiFi
  pinMode(WIFI_LED_PIN, OUTPUT);
  setWifiLed(false); // tắt lúc khởi động (sẽ bật/chớp nếu mất WiFi)

  // reset button
  pinMode(WIFI_RESET_BTN_PIN, INPUT_PULLUP);

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
    "{\"id\":\"%s\",\"node_type\":\"sensor\",\"temperature\":%s,\"humidity\":%s,"
    "\"pressure_hpa\":%s,\"lux\":%.1f,\"soil_pct\":%d,"
    "\"soil_raw\":%d,\"uptime_s\":%lu}",
    deviceId.c_str(),
    isnan(temperature) ? "null" : String(temperature,1).c_str(),
    isnan(humidity) ? "null" : String(humidity,1).c_str(),
    isnan(pressure_hpa) ? "null" : String(pressure_hpa,2).c_str(),
    lux, soilPct, soilRaw, uptime
  );

  String topic = String("sensors/") + deviceId + "/data";

  if (mqttClient.connected()) {
    bool ok = mqttClient.publish(topic.c_str(), payload);
    Serial.print("Published to "); Serial.print(topic); Serial.print(" : "); Serial.println(payload);
    Serial.print("Publish ok: "); Serial.println(ok ? "true" : "false");
  } else {
    Serial.println("MQTT not connected, skip publish");
  }
}

void loop() {
  wifiPortal.process();
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected()) mqttReconnect();
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
  // long-press reset button logic (hold LOW for WIFI_RESET_HOLD_MS)
  int resetRead = digitalRead(WIFI_RESET_BTN_PIN);
  if (resetRead == LOW) {
    if (wifiResetPressStart == 0) wifiResetPressStart = now;
    if (!wifiResetTriggered && (now - wifiResetPressStart >= WIFI_RESET_HOLD_MS)) {
      wifiResetTriggered = true;
      Serial.println("Reset button held: starting countdown to reset WiFi...");
      // countdown 3..1 with short LED blinks to indicate progress
      for (int c = 3; c >= 1; c--) {
        Serial.printf("Reset in %d...\n", c);
        // short blink
        setWifiLed(true);
        delay(200);
        setWifiLed(false);
        // remainder of ~800ms per step (match S3 timing)
        delay(600);
      }

      // final short indication then clear and restart
      Serial.println("Clearing stored WiFi and restarting...");
      setWifiLed(true);
      delay(300);
      setWifiLed(false);

      Preferences prefs;
      prefs.begin("wroomwifi", false);
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
  if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = now;
    if (!mqttClient.connected()) mqttReconnect();
    publishReadings();
  }
}
