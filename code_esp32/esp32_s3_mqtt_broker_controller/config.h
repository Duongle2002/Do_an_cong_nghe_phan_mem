#pragma once

#include <Arduino.h>

// --- Cấu hình chân phần cứng (Pinout) ---
#define SDA_PIN 8
#define SCL_PIN 9

// Chân điều khiển rơ-le (Relay)
#define RELAY_FAN_PIN   16
#define RELAY_LIGHT_PIN 17
#define RELAY_PUMP_PIN  18

// Chân nút bấm điều khiển thủ công (Manual override)
#define BTN_FAN_PIN   4
#define BTN_LIGHT_PIN 5
#define BTN_PUMP_PIN  6

// Nút nhấn cứng để reset WiFi
#define WIFI_RESET_BTN_PIN 37

// Nút nhấn cứng chuyển đổi chế độ hoạt động
#define BTN_MODE_PIN  7

// Enum chế độ hoạt động
enum OperationalMode {
  MODE_MANUAL = 0,
  MODE_AUTO = 1,
  MODE_SCHEDULED = 2
};

// Cấu hình cực hoạt động của Relay (Active-HIGH hay Active-LOW)
const bool RELAY_ACTIVE_HIGH = true;

// Nếu rơ-le phần cứng là ngược cực nhưng muốn hiển thị nhãn ON/OFF đúng thực tế
const bool RELAY_DISPLAY_INVERT = false;

// --- Cấu hình OLED SSD1306 ---
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_I2C_ADDR 0x3C

// --- Khoảng thời gian chu kỳ công việc ---
const unsigned long BUTTON_DEBOUNCE_MS = 50UL;         // Bộ chống rung phím (debounce)
const unsigned long RELAY_MANUAL_OVERRIDE_MS = 300000UL; // Thời gian khoá điều khiển thủ công (5 phút)
const unsigned long DISPLAY_REFRESH_INTERVAL_MS = 1000UL; // Chu kỳ làm tươi màn hình OLED
const unsigned long WIFI_RESET_HOLD_MS = 6000UL;       // Thời gian giữ nút để reset WiFi (ms)
const unsigned long MQTT_RETRY_INTERVAL_MS = 5000UL;   // Chu kỳ thử lại kết nối MQTT

// --- Cấu hình MQTT mặc định ---
const char* const DEFAULT_MQTT_SERVER = "broker.emqx.io";
const uint16_t DEFAULT_MQTT_PORT = 1883;
const char* const DEFAULT_MQTT_USER = "";
const char* const DEFAULT_MQTT_PASS = "";
