#pragma once

#include <Arduino.h>
   
// --- Cấu hình phần cứng (Pinout) ---
#define SOIL_PIN 34           // Chân ADC đọc cảm biến độ ẩm đất   
#define SDA_PIN 21            // Chân I2C SDA
#define SCL_PIN 22            // Chân I2C SCL
#define WIFI_LED_PIN 2        // Đèn LED báo trạng thái WiFi (On-board hoặc nối ngoài)
#define WIFI_RESET_BTN_PIN 27 // Nút nhấn cứng để reset WiFi (nhấn giữ 6s)

// LED active-high (sáng khi chân ở mức HIGH)
const bool WIFI_LED_ACTIVE_HIGH = true;

// --- Cấu hình cảm biến đất ---
const int SOIL_WET = 700;     // Giá trị ADC khi đất ẩm sũng nước
const int SOIL_DRY = 2500;    // Giá trị ADC khi đất khô hoàn toàn

// --- Thời gian chu kỳ chuỗi công việc (Non-blocking timing) ---
const unsigned long MQTT_PUBLISH_INTERVAL_MS = 10000UL;  // Chu kỳ gửi MQTT khi Online
const unsigned long TINYML_INFERENCE_INTERVAL_MS = 5000UL; // Chu kỳ chạy dự đoán AI cục bộ
const unsigned long TCP_SEND_INTERVAL_MS = 5000UL;        // Chu kỳ gửi dữ liệu TCP khi Offline
const unsigned long WIFI_CHECK_INTERVAL_MS = 15000UL;     // Chu kỳ kiểm tra trạng thái WiFi STA
const unsigned long WIFI_RESET_HOLD_MS = 6000UL;          // Thời gian giữ nút để reset WiFi (ms)
const unsigned long WIFI_BLINK_INTERVAL_MS = 500UL;       // Chu kỳ chớp LED khi mất WiFi (ms)

// --- Cấu hình MQTT mặc định ---
// const char* const DEFAULT_MQTT_SERVER = "broker.emqx.io"; // Cloud public broker (cùng server và S3)
// const char* const DEFAULT_MQTT_SERVER = "192.168.2.1";   // Local broker (chỉ dùng khi server chạy local)
const char* const DEFAULT_MQTT_SERVER = "broker.emqx.io";
const uint16_t DEFAULT_MQTT_PORT = 1883;
const char* const DEFAULT_MQTT_USER = "";
const char* const DEFAULT_MQTT_PASS = "";

// --- Ngưỡng phân tách quyết định AI (Hysteresis) ---
const float AI_THRESH_ON = 0.60f;   // Xác suất đạt được để kích hoạt thiết bị
const float AI_THRESH_OFF = 0.45f;  // Xác suất tụt xuống để tắt thiết bị
