#include <Wire.h>
#include <WiFi.h>
#include "esp_mac.h"
#include "config.h"
#include "../common/shared_protocol.h"
#include "../common/wifi_config_portal.h"
#include "sensor_manager.h"
#include "tinyml_manager.h"
#include "app_network_manager.h"

// --- Thực thể toàn cục ---
WifiConfigPortal wifiPortal("wroomwifi", "SmartFarm-WROOM-Setup", "12345678", "ESP32 WROOM Sensor Node");
SensorManager sensorManager;
TinyMLManager tinymlManager;
AppNetworkManager networkManager(wifiPortal);

SmartFarmData sharedData;
String deviceId;

// Quản lý LED WiFi
unsigned long lastWifiBlink = 0;
bool wifiLedOn = false;

// Quản lý nút Reset WiFi
unsigned long wifiResetPressStart = 0;
bool wifiResetTriggered = false;

// Lên lịch cho suy luận TinyML và đọc cảm biến
unsigned long lastInferenceTime = 0;

// Lấy Device ID dựa trên địa chỉ MAC
String getMacId() {
  uint8_t mac[6];
  esp_efuse_mac_get_default(mac);  
  char buf[32];
  snprintf(buf, sizeof(buf), "%02X%02X%02X%02X%02X%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  return String(buf);
}

inline void setWifiLed(bool on) {
  digitalWrite(WIFI_LED_PIN, (WIFI_LED_ACTIVE_HIGH ? (on ? HIGH : LOW) : (on ? LOW : HIGH)));
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n=============================================");
  Serial.println("  Smart Farm: ESP32 WROOM (Sensor + TinyML)  ");
  Serial.println("=============================================");

  // Khởi tạo I2C   
  Wire.begin(SDA_PIN, SCL_PIN);

  // Lấy ID thiết bị
  deviceId = "esp32-" + getMacId();
  Serial.print("[Setup] Device ID: ");
  Serial.println(deviceId);

  // Khởi tạo các quản lý
  sensorManager.begin();
  tinymlManager.begin();
  networkManager.begin(deviceId);

  // Cấu hình LED báo trạng thái
  pinMode(WIFI_LED_PIN, OUTPUT);
  setWifiLed(false);

  // Cấu hình nút nhấn cứng
  pinMode(WIFI_RESET_BTN_PIN, INPUT_PULLUP);

  lastInferenceTime = millis();
}

void loop() {
  unsigned long now = millis();

  // 1. Quản lý LED chỉ báo WiFi:
  // - Nếu ở Normal Mode và MQTT online: bật LED sáng đứng.
  // - Nếu ở Fallback Mode hoặc mất kết nối: chớp LED theo chu kỳ.
  if (networkManager.getState() == STATE_NORMAL_WIFI && networkManager.isMqttConnected()) {
    setWifiLed(true); 
  } else {
    if (now - lastWifiBlink >= WIFI_BLINK_INTERVAL_MS) {
      lastWifiBlink = now;
      wifiLedOn = !wifiLedOn;
      setWifiLed(wifiLedOn);
    }
  }

  // 2. Xử lý nút nhấn Reset WiFi (Nhấn giữ WIFI_RESET_HOLD_MS)
  int resetBtnState = digitalRead(WIFI_RESET_BTN_PIN);
  if (resetBtnState == LOW) {
    if (wifiResetPressStart == 0) {
      wifiResetPressStart = now;
    }
    if (!wifiResetTriggered && (now - wifiResetPressStart >= WIFI_RESET_HOLD_MS)) {
      wifiResetTriggered = true;
      Serial.println("[Button] Phát hiện nút nhấn reset WiFi được giữ lâu!");
      
      // Chớp LED báo hiệu trước khi reset
      for (int i = 3; i >= 1; i--) {
        Serial.printf("[Button] Đang khôi phục cài đặt gốc sau %d...\n", i);
        setWifiLed(true); delay(200);
        setWifiLed(false); delay(600);
      }
      
      Serial.println("[Button] Đang xoá cấu hình WiFi trong NVS và khởi động lại...");
      setWifiLed(true); delay(300); setWifiLed(false);

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

  // 3. Đọc cảm biến và thực thi TinyML phi blocking mỗi 5s
  if (now - lastInferenceTime >= TINYML_INFERENCE_INTERVAL_MS) {
    lastInferenceTime = now;
    
    // Đọc giá trị mới nhất từ cảm biến vật lý
    if (sensorManager.read(sharedData)) {
      Serial.printf("[Sensor] Đọc cảm biến: T=%.2f°C, H=%.2f%%, Soil=%d%%, Lux=%.1f\n", 
                    sharedData.temperature, sharedData.humidity, sharedData.soil_pct, sharedData.lux);
      
      // Chạy suy luận để cập nhật quyết định điều khiển AI
      tinymlManager.runInference(sharedData);
    } else {
      Serial.println("[Sensor] LỖI: Đọc cảm biến thất bại");
    }
  }

  // 4. Xử lý truyền thông mạng và truyền tải dữ liệu
  networkManager.process(sharedData);

  // Tránh khoá vòng lặp để watchdog hoạt động bình thường
  yield();
}
