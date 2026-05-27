#include <Wire.h>
#include <WiFi.h>
#include <Preferences.h>
#include "config.h"
#include "../common/shared_protocol.h"
#include "../common/wifi_config_portal.h"
#include "relay_manager.h"
#include "display_manager.h"
#include "app_network_manager.h"

// --- Thực thể toàn cục ---
WifiConfigPortal wifiPortal("s3wifi", "SmartFarm-S3-Setup", "12345678", "ESP32-S3 Controller Node");
RelayManager relayManager;
DisplayManager displayManager;
AppNetworkManager networkManager(wifiPortal);

SmartFarmData sharedData;
String deviceId;
String pairedSensorId;

// Quản lý hiển thị và độ trễ
unsigned long lastDisplayUpdate = 0;
unsigned long lastMsgMillis = 0; // Thời điểm nhận được bản tin cảm biến cuối cùng

// Quản lý nút Reset WiFi
unsigned long wifiResetPressStart = 0;
bool wifiResetTriggered = false;

// Hàm callback được gọi khi trạng thái Relay thay đổi
void onRelayStateChanged(const char* target, bool state, const char* reason) {
  Serial.printf("[Callback] Rơ-le [%s] chuyển sang: %s (nguyên nhân: %s)\n", 
                target, state ? "ON" : "OFF", reason);
  
  // Đồng bộ lên cấu trúc dữ liệu hiển thị tức thời
  if (strcmp(target, "fan") == 0) sharedData.fan = state;
  else if (strcmp(target, "light") == 0) sharedData.light = state;
  else if (strcmp(target, "pump") == 0) sharedData.pump = state;

  // Cập nhật lên Cloud nếu MQTT đang online
  if (networkManager.isMqttConnected()) {
    networkManager.publishState(reason, relayManager.getFanState(), relayManager.getLightState(), relayManager.getPumpState());
  }

  // Làm tươi OLED lập tức
  displayManager.update(sharedData, 
                        (WiFi.status() == WL_CONNECTED) ? (networkManager.isMqttConnected() ? DISP_NET_MQTT : DISP_NET_TCP) : DISP_NET_TCP,
                        pairedSensorId, 
                        lastMsgMillis, 
                        wifiPortal.ip(),
                        relayManager.getMode());
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\n=============================================");
  Serial.println("  Smart Farm: ESP32-S3 (Controller + OLED)   ");
  Serial.println("=============================================");

  // Khởi tạo địa chỉ MAC độc nhất
  deviceId = "esp32s3-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("[Setup] Device ID: %s\n", deviceId.c_str());

  // Khởi tạo I2C cho OLED
  Wire.begin(SDA_PIN, SCL_PIN);

  // Khởi tạo hiển thị OLED
  if (!displayManager.begin()) {
    Serial.println("[Setup] LỖI: OLED init failed!");
  }

  // Khởi tạo Relay và nút bấm
  relayManager.begin(onRelayStateChanged);

  // Khởi tạo mạng điều phối
  networkManager.begin(deviceId, &relayManager);

  // Cấu hình nút nhấn cứng Reset WiFi
  pinMode(WIFI_RESET_BTN_PIN, INPUT_PULLUP);

  lastDisplayUpdate = millis();
}

void loop() {
  unsigned long now = millis();

  // 1. Xử lý nút nhấn Reset WiFi (Giữ WIFI_RESET_HOLD_MS)
  int resetBtnState = digitalRead(WIFI_RESET_BTN_PIN);
  if (resetBtnState == LOW) {
    if (wifiResetPressStart == 0) {
      wifiResetPressStart = now;
    }
    if (!wifiResetTriggered && (now - wifiResetPressStart >= WIFI_RESET_HOLD_MS)) {
      wifiResetTriggered = true;
      Serial.println("[Button] Khôi phục cài đặt WiFi gốc...");
      
      // Xoá cấu hình WiFi trong NVS và khởi động lại
      Preferences prefs;
      prefs.begin("s3wifi", false);
      prefs.putString("wifi_ssid", "");
      prefs.putString("wifi_pass", "");
      prefs.putString("paired_sensor", ""); // Reset cả ghép cặp
      prefs.end();

      Preferences prefs2;
      prefs2.begin("s3ctrl", false);
      prefs2.putInt("op_mode", (int)MODE_AUTO);
      prefs2.end();

      delay(300);
      ESP.restart();
    }
  } else {
    wifiResetPressStart = 0;
    wifiResetTriggered = false;
  }

  // 2. Xử lý logic phím bấm điều khiển rơ-le vật lý (debounce phi blocking)
  relayManager.process();

  // 3. Xử lý truyền thông mạng (MQTT / TCP / Config) và cập nhật dữ liệu ghép đôi
  networkManager.process(sharedData, pairedSensorId, lastMsgMillis);

  // 4. Đồng bộ dữ liệu cảm biến nhận được từ MQTT về sharedData để vẽ màn hình
  // Khi Online, dữ liệu cảm biến được S3 subscribe từ WROOM và backend.
  // MQTT loop() tự cập nhật thông qua hàm handleMqttMessage.
  // Ở đây chỉ cần kiểm tra xem thông tin ghép cặp đổi để cập nhật OLED.

  // 5. Chu kỳ làm tươi màn hình OLED mỗi giây
  if (now - lastDisplayUpdate >= DISPLAY_REFRESH_INTERVAL_MS) {
    lastDisplayUpdate = now;

    DisplayNetworkMode mode = DISP_NET_DISCONNECTED;
    if (WiFi.status() == WL_CONNECTED) {
      mode = networkManager.isMqttConnected() ? DISP_NET_MQTT : DISP_NET_TCP;
    } else {
      // Nếu mất WiFi, hoạt động chế độ offline (TCP server sẵn sàng)
      mode = DISP_NET_TCP; 
    }

    displayManager.update(sharedData, mode, pairedSensorId, lastMsgMillis, wifiPortal.ip(), relayManager.getMode());
  }

  // Tránh khoá vòng lặp để watchdog hoạt động
  yield();
}
