#pragma once

#include <Arduino.h>

// Cấu hình mạng SoftAP dự phòng (Fallback AP)
const char* const FALLBACK_AP_SSID = "SmartFarm_Fallback_AP";
const char* const FALLBACK_AP_PASS = "SmartFarmFallbackPassword";

// Cổng chạy TCP Server của ESP32-S3 và TCP Client của WROOM
const uint16_t FALLBACK_TCP_PORT = 8080;

// Cấu trúc dữ liệu đồng bộ trạng thái giữa 2 node (WROOM và S3)
struct SmartFarmData {
  float temperature = NAN;
  float humidity = NAN;
  float lux = NAN;
  int soil_pct = -1;
  
  // Trạng thái relay điều khiển tự động (AI quyết định từ WROOM)
  bool fan = false;
  bool light = false;
  bool pump = false;
};
