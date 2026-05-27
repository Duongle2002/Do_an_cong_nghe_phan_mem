#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"
#include "../common/shared_protocol.h"

enum DisplayNetworkMode {
  DISP_NET_DISCONNECTED,
  DISP_NET_MQTT,
  DISP_NET_TCP
};

class DisplayManager {
public:
  DisplayManager();
  bool begin();
  
  // Vẽ toàn bộ màn hình dựa trên dữ liệu hiện tại
  void update(const SmartFarmData& data, 
              DisplayNetworkMode netMode, 
              const String& pairedSensorId, 
              unsigned long lastMsgMillis,
              const String& portalIp,
              OperationalMode opMode);

private:
  Adafruit_SSD1306 _display;

  void drawWifiBars(bool connected, int rssi);
  void printTruncated(const String& txt, int16_t x, int16_t y, int16_t maxWidth);
};
