#include "display_manager.h"
#include <WiFi.h>

DisplayManager::DisplayManager() : _display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET) {}

bool DisplayManager::begin() {
  if (!_display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[DisplayManager] LỖI: SSD1306 allocation failed");
    return false;
  }
  
  _display.clearDisplay();
  _display.setTextSize(1);
  _display.setTextColor(SSD1306_WHITE);
  _display.setCursor(0, 0);
  _display.println("ESP32-S3 Smart Farm");
  _display.println("Initializing...");
  _display.display();
  Serial.println("[DisplayManager] Màn hình OLED SSD1306 khởi tạo thành công");
  return true;
}

void DisplayManager::drawWifiBars(bool connected, int rssi) {
  int bars = 0;
  if (connected) {
    if (rssi > -50) bars = 4;
    else if (rssi > -60) bars = 3;
    else if (rssi > -70) bars = 2;
    else if (rssi > -80) bars = 1;
    else bars = 0;
  }
  
  const int bw = 3;      // Bar width
  const int spacing = 1; // Spacing
  for (int i = 0; i < 4; i++) {
    int h = (i + 1) * 3; // Height
    int x = SCREEN_WIDTH - ((4 - i) * (bw + spacing));
    int y = 2 + (12 - h);
    if (i < bars) {
      _display.fillRect(x, y, bw, h, SSD1306_WHITE);
    } else {
      _display.drawRect(x, y, bw, h, SSD1306_WHITE);
    }
  }
}

void DisplayManager::printTruncated(const String& txt, int16_t x, int16_t y, int16_t maxWidth) {
  _display.setTextSize(1);
  _display.setTextColor(SSD1306_WHITE);
  int16_t x1, y1; uint16_t w, h;
  _display.getTextBounds(txt, x, y, &x1, &y1, &w, &h);
  
  if ((int)w <= maxWidth) {
    _display.setCursor(x, y);
    _display.print(txt);
    return;
  }

  String s = txt;
  const String ell = "...";
  while (s.length() > 0) {
    s.remove(s.length() - 1);
    String cand = s + ell;
    _display.getTextBounds(cand, x, y, &x1, &y1, &w, &h);
    if ((int)w <= maxWidth) {
      _display.setCursor(x, y);
      _display.print(cand);
      return;
    }
  }
  
  _display.setCursor(x, y);
  _display.print(ell);
}

void DisplayManager::update(const SmartFarmData& data, 
                            DisplayNetworkMode netMode, 
                            const String& pairedSensorId, 
                            unsigned long lastMsgMillis,
                            const String& portalIp,
                            OperationalMode opMode) {
  _display.clearDisplay();
  _display.setCursor(0, 0);
  _display.setTextSize(1);
  _display.setTextWrap(true);

  // 1. Vẽ cột sóng WiFi
  bool wifiConnected = (WiFi.status() == WL_CONNECTED);
  int rssi = wifiConnected ? WiFi.RSSI() : 0;
  drawWifiBars(wifiConnected, rssi);

  // 2. Chế độ cấu hình WiFi (Portal active)
  if (netMode == DISP_NET_DISCONNECTED) {
    _display.setCursor(0, 10);
    _display.println("WiFi: CHUA KET NOI");
    
    _display.setCursor(0, 22);
    _display.print("AP: ");
    printTruncated("SmartFarm-S3-Setup", 24, 22, SCREEN_WIDTH - 24);

    _display.setCursor(0, 34);
    _display.print("Pass: 12345678");

    _display.setCursor(0, 48);
    _display.print("IP Portal: ");
    _display.println(portalIp);

    _display.display();
    return;
  }

  // 3. Chế độ hoạt động bình thường (Đã kết nối)
  // Dòng 1: Nhiệt độ & Độ ẩm
  _display.print("T:");
  if (!isnan(data.temperature)) _display.print(data.temperature, 2); else _display.print("--");
  _display.print(" H:");
  if (!isnan(data.humidity)) _display.print(data.humidity, 2); else _display.print("--");
  _display.println();

  // Dòng 2: Ánh sáng & Độ ẩm đất
  _display.print("L:");
  if (!isnan(data.lux)) _display.print((int)data.lux); else _display.print("--");
  _display.print(" S:");
  if (data.soil_pct >= 0) _display.print(data.soil_pct); else _display.print("--");
  _display.println("%");

  // Dòng 3: Trạng thái đóng cắt Rơ-le thực tế (Actuator states)
  // Để đồng nhất, dùng đảo cực hiển thị nếu được định cấu hình
  bool dispFan = RELAY_DISPLAY_INVERT ? !data.fan : data.fan;
  bool dispLight = RELAY_DISPLAY_INVERT ? !data.light : data.light;
  bool dispPump = RELAY_DISPLAY_INVERT ? !data.pump : data.pump;

  _display.print("REL: Fan:"); _display.print(dispFan ? "OFF" : "ON");
  _display.print(" Lgt:"); _display.print(dispLight ? "OFF" : "ON");
  _display.println();

  _display.print("     Pmp:"); _display.print(dispPump ? "OFF" : "ON");
  _display.println();

  // Dòng 4: Ghép cặp sensor ID
  _display.print("Sensor: ");
  if (pairedSensorId.length() > 0) {
    printTruncated(pairedSensorId, 48, 40, SCREEN_WIDTH - 48);
  } else {
    _display.print("CHUA GHEP");
  }
  _display.println();

  // Dòng 5: Trạng thái chế độ mạng
  if (netMode == DISP_NET_MQTT) {
    _display.print("NET: NORMAL (MQTT)");
  } else {
    _display.print("NET: FALLBACK (TCP)");
  }
  _display.println();

  // Dòng 6: Chế độ hoạt động & Bộ đếm thời gian cập nhật tối giản
  _display.print("MODE: ");
  if (opMode == MODE_MANUAL) _display.print("MANUAL");
  else if (opMode == MODE_AUTO) _display.print("AUTO");
  else if (opMode == MODE_SCHEDULED) _display.print("SCHED");

  _display.print(" ");
  if (lastMsgMillis == 0) {
    _display.print("[No]");
  } else {
    unsigned long age = (millis() - lastMsgMillis) / 1000;
    _display.print("[");
    _display.print(age);
    _display.print("s]");
  }
  _display.println();

  _display.display();
}
