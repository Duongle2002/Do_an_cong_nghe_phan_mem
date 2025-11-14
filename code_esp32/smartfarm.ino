#include <WiFi.h>
#include <HTTPClient.h>
#include "DHT.h"
#include <WiFiManager.h>

const char* server_url = "http://<BACKEND_IP>:5000/api"; // Thay <BACKEND_IP> bằng IP backend
const char* deviceId = "ESP32-001";

#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);
#define RELAY_PIN 26
#define SOIL_PIN 34

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  // Sử dụng WiFiManager để cấu hình Wi-Fi qua web portal
  WiFiManager wifiManager;
  wifiManager.autoConnect("SmartFarm-Setup"); // Tên AP khi cấu hình
  Serial.println("✅ WiFi connected");
  Serial.print("IP: "); Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    delay(5000);
    return;
  }

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soil = analogRead(SOIL_PIN);

  // ==== Lấy ngưỡng cảnh báo từ backend ====
  int temperatureMax = 35;
  int soilMoistureMin = 500;
  int humidityMin = 30;
  int humidityMax = 90;

  HTTPClient http;
  String thresholdUrl = String(server_url) + "/alert-thresholds/" + deviceId;
  http.begin(thresholdUrl);
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    int idx;
    idx = payload.indexOf("temperatureMax");
    if (idx != -1) temperatureMax = payload.substring(idx+15, payload.indexOf(',', idx)).toInt();
    idx = payload.indexOf("soilMoistureMin");
    if (idx != -1) soilMoistureMin = payload.substring(idx+16, payload.indexOf(',', idx)).toInt();
    idx = payload.indexOf("humidityMin");
    if (idx != -1) humidityMin = payload.substring(idx+12, payload.indexOf(',', idx)).toInt();
    idx = payload.indexOf("humidityMax");
    if (idx != -1) humidityMax = payload.substring(idx+12, payload.indexOf('}', idx)).toInt();
  }
  http.end();

  // ==== Auto Logic ====
  bool abnormal = false;
  String alertMsg = "";

  if (temperature > temperatureMax) {
    abnormal = true;
    alertMsg += "Nhiệt độ cao! ";
    digitalWrite(RELAY_PIN, LOW);
  }
  if (soil < soilMoistureMin) {
    abnormal = true;
    alertMsg += "Độ ẩm đất thấp! ";
    digitalWrite(RELAY_PIN, LOW);
  }
  if (humidity < humidityMin || humidity > humidityMax) {
    abnormal = true;
    alertMsg += "Độ ẩm không khí bất thường! ";
    digitalWrite(RELAY_PIN, LOW);
  }
  if (!abnormal) {
    digitalWrite(RELAY_PIN, HIGH);
  }

  // Gửi dữ liệu cảm biến lên backend
  http.begin(String(server_url) + "/data");
  http.addHeader("Content-Type", "application/json");
  String dataPayload = "{";
  dataPayload += "\"deviceId\":\"" + String(deviceId) + "\",";
  dataPayload += "\"temperature\":" + String(temperature) + ",";
  dataPayload += "\"humidity\":" + String(humidity) + ",";
  dataPayload += "\"soilMoisture\":" + String(soil) + "}";
  http.POST(dataPayload);
  http.end();

  // Gửi cảnh báo nếu bất thường
  if (abnormal) {
    http.begin(String(server_url) + "/alerts");
    http.addHeader("Content-Type", "application/json");
    String alertPayload = "{";
    alertPayload += "\"deviceId\":\"" + String(deviceId) + "\",";
    alertPayload += "\"alert\":\"" + alertMsg + "\"}";
    http.POST(alertPayload);
    http.end();
    Serial.println("⚠️ Alert: " + alertPayload);
  }

  delay(10000);
}
