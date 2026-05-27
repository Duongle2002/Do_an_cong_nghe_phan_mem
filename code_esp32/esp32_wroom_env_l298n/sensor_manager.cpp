#include "sensor_manager.h"

SensorManager::SensorManager() : _ahtPresent(false), _bmpPresent(false), _bhPresent(false) {}

void SensorManager::begin() {
  // Đặt cấu hình bộ suy hao cho chân ADC cảm biến độ ẩm đất   
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);

  // Khởi tạo các cảm biến I2C
  if (_aht.begin()) {
    _ahtPresent = true;
    Serial.println("[SensorManager] Cảm biến AHTx0 khởi tạo thành công");
  } else {
    Serial.println("[SensorManager] LỖI: Không tìm thấy cảm biến AHTx0");
  }

  if (_bmp.begin(0x76)) {
    _bmpPresent = true;
    Serial.println("[SensorManager] Cảm biến BMP280 khởi tạo thành công tại địa chỉ 0x76");
  } else if (_bmp.begin(0x77)) {
    _bmpPresent = true;
    Serial.println("[SensorManager] Cảm biến BMP280 khởi tạo thành công tại địa chỉ 0x77");
  } else {
    Serial.println("[SensorManager] LỖI: Không tìm thấy cảm biến BMP280");
  }

  if (_lightMeter.begin()) {
    _bhPresent = true;
    Serial.println("[SensorManager] Cảm biến BH1750 khởi tạo thành công");
  } else {
    Serial.println("[SensorManager] LỖI: Không tìm thấy cảm biến BH1750");
  }
}

int SensorManager::readSoilRaw() {
  return analogRead(SOIL_PIN);
}

int SensorManager::soilPercentFromRaw(int raw) {
  int pct = map(raw, SOIL_WET, SOIL_DRY, 100, 0);
  return constrain(pct, 0, 100);
}

bool SensorManager::read(SmartFarmData& data) {
  // Đọc cảm biến Lux
  if (_bhPresent) {
    float lux = _lightMeter.readLightLevel();
    data.lux = (lux >= 0.0f) ? lux : 0.0f;
  } else {
    data.lux = NAN;
  }

  // Đọc cảm biến nhiệt độ & độ ẩm không khí (AHTx0)
  if (_ahtPresent) {
    sensors_event_t tempEvent, humidityEvent;
    if (_aht.getEvent(&humidityEvent, &tempEvent)) {
      data.temperature = tempEvent.temperature;
      data.humidity = humidityEvent.relative_humidity;
    } else {
      data.temperature = NAN;
      data.humidity = NAN;
    }
  } else if (_bmpPresent) {
    // BMP280 fallback cho nhiệt độ nếu thiếu AHT
    data.temperature = _bmp.readTemperature();
    data.humidity = NAN;
  } else {
    data.temperature = NAN;
    data.humidity = NAN;
  }

  // Đọc độ ẩm đất
  int rawSoil = readSoilRaw();
  data.soil_pct = soilPercentFromRaw(rawSoil);

  // Đọc thành công nếu ít nhất có 1 thông số không lỗi
  return (!isnan(data.temperature) || !isnan(data.humidity) || !isnan(data.lux) || data.soil_pct >= 0);
}
