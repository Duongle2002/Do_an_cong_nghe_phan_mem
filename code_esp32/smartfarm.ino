#include <WiFi.h>
#include <PubSubClient.h>
#include "DHT.h"

const char* ssid = "duong"; // Tên Wi-Fi của bạn
const char* password = "1234567890a"; // Mật khẩu Wi-Fi
const char* mqtt_server = "broker.emqx.io"; // Mosquitto cục bộ
const int mqtt_port = 1883;
const char* mqtt_username = "duong1883"; // Không cần username
const char* mqtt_password = "Duong1883"; // Không cần password
const char* topic_data = "smartfarm/sensor";
const char* topic_control = "smartfarm/control";

// ==== Device Info ====
const char* deviceId = "ESP32-001";

// ==== DHT Config ====
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ==== Relay Config ====
#define RELAY_PIN 26

// ==== Soil Sensor ====
#define SOIL_PIN 34

WiFiClient espClient;
PubSubClient client(espClient);

void reconnect() {
  while (!client.connected()) {
    Serial.print("🔄 Attempting MQTT connection...");
    if (client.connect(deviceId)) {
      Serial.println("✅ connected");
      client.subscribe(topic_control);
    } else {
      Serial.print("❌ failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5s");
      delay(5000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (int i = 0; i < length; i++) msg += (char)payload[i];

  Serial.print("📥 Message [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(msg);

  if (msg.indexOf(deviceId) != -1) {
    if (msg.indexOf("ON") != -1) {
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("🚀 Relay ON");
    } else if (msg.indexOf("OFF") != -1) {
      digitalWrite(RELAY_PIN, HIGH);
      Serial.println("🛑 Relay OFF");
    }
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  WiFi.begin(ssid, password);
  Serial.print("🔌 Connecting WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  Serial.print("IP: "); Serial.println(WiFi.localIP());

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int soil = analogRead(SOIL_PIN);

  String payload = "{";
  payload += "\"deviceId\":\"" + String(deviceId) + "\",";
  payload += "\"temperature\":" + String(temperature) + ",";
  payload += "\"humidity\":" + String(humidity) + ",";
  payload += "\"soilMoisture\":" + String(soil) + "}";
  
  client.publish(topic_data, payload.c_str());
  Serial.println("📤 Data: " + payload);

  delay(10000);
}
