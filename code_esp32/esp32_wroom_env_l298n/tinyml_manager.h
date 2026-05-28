#pragma once

#include <Arduino.h>
#include <TensorFlowLite_ESP32.h>
#include <tensorflow/lite/micro/micro_mutable_op_resolver.h>
#include <tensorflow/lite/micro/micro_error_reporter.h>
#include <tensorflow/lite/micro/micro_interpreter.h>
#include <tensorflow/lite/schema/schema_generated.h>
#include "config.h"
#include "model.h"
#include "shared_protocol.h"

class TinyMLManager {
public:
  TinyMLManager();
  bool begin();
  bool runInference(SmartFarmData& data);

private:
  bool _initialized = false;
  
  // TFLM pointers
  tflite::MicroErrorReporter _microErrorReporter;
  tflite::ErrorReporter* _errorReporter = nullptr;
  const tflite::Model* _tfliteModel = nullptr;
  tflite::MicroInterpreter* _interpreter = nullptr;

  // Tensor arena: float32 model nhỏ chỉ cần 8KB
  static constexpr int kTensorArenaSize = 8 * 1024;
  alignas(16) uint8_t _tensorArena[kTensorArenaSize];

  // Helper normalization functions
  float normalizeRange(float value, float minValue, float maxValue);
  int8_t quantizeInt8(float value, const TfLiteTensor* tensor);
  uint8_t quantizeUInt8(float value, const TfLiteTensor* tensor);
  float dequantizeValue(int32_t value, const TfLiteTensor* tensor);
};
