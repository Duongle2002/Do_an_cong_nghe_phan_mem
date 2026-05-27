#pragma once

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_AHTX0.h>
#include <Adafruit_BMP280.h>   
#include <BH1750.h>
#include "config.h"
#include "../common/shared_protocol.h"

class SensorManager {
public:
  SensorManager();
  void begin();
  bool read(SmartFarmData& data);

private:
  Adafruit_AHTX0 _aht;
  Adafruit_BMP280 _bmp;
  BH1750 _lightMeter;

  bool _ahtPresent = false;
  bool _bmpPresent = false;
  bool _bhPresent = false;

  int readSoilRaw();
  int soilPercentFromRaw(int raw);
};
