#include "tinyml_manager.h"
#include <math.h>
// Force recompilation of this translation unit to embed the new model.h weights

TinyMLManager::TinyMLManager() : _initialized(false) {
  _errorReporter = &_microErrorReporter;
}
   
bool TinyMLManager::begin() {
  if (_initialized) return true;

  // Lấy mô hình từ mảng byte trong model.h (float32, không quantize)
  _tfliteModel = tflite::GetModel(model_tflite);
  if (_tfliteModel->version() != 3) {
    Serial.println("[TinyMLManager] LỖI: Phiên bản model schema TFLite không khớp (yêu cầu v3)");
    return false;
  }

  // Float32 model chỉ cần FullyConnected, Relu, Logistic
  static tflite::MicroMutableOpResolver<3> opResolver;
  if (opResolver.AddFullyConnected() != kTfLiteOk) {
    Serial.println("[TinyMLManager] LỖI: Đăng ký Op FullyConnected thất bại");
    return false;
  }
  if (opResolver.AddLogistic() != kTfLiteOk) {
    Serial.println("[TinyMLManager] LỖI: Đăng ký Op Logistic (Sigmoid) thất bại");
    return false;
  }
  if (opResolver.AddRelu() != kTfLiteOk) {
    Serial.println("[TinyMLManager] LỖI: Đăng ký Op Relu thất bại");
    return false;
  }

  // Khởi tạo bộ thông dịch
  static tflite::MicroInterpreter staticInterpreter(
    _tfliteModel,
    opResolver,
    _tensorArena,
    kTensorArenaSize,
    _errorReporter
  );
  _interpreter = &staticInterpreter;

  // Cấp phát bộ nhớ cho Tensors
  TfLiteStatus allocateStatus = _interpreter->AllocateTensors();
  if (allocateStatus != kTfLiteOk) {
    Serial.println("[TinyMLManager] LỖI: Cấp phát Tensors thất bại");
    return false;
  }

  // Kiểm tra cấu trúc input/output
  TfLiteTensor* input = _interpreter->input(0);
  TfLiteTensor* output = _interpreter->output(0);
  if (!input || !output) {
    Serial.println("[TinyMLManager] LỖI: Thiếu tensors đầu vào/đầu ra");
    return false;
  }

  _initialized = true;
  Serial.println("[TinyMLManager] Mô hình TinyML đã được khởi tạo thành công");
  return true;
}

float TinyMLManager::normalizeRange(float value, float minValue, float maxValue) {
  if (isnan(value)) return 0.5f; // Giá trị trung vị mặc định nếu lỗi cảm biến
  float val = constrain(value, minValue, maxValue);
  return (val - minValue) / (maxValue - minValue);
}

int8_t TinyMLManager::quantizeInt8(float value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  if (scale <= 0.0f) return 0;
  int q = (int)lroundf(value / scale) + zeroPoint;
  return (int8_t)constrain(q, -128, 127);
}

uint8_t TinyMLManager::quantizeUInt8(float value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  if (scale <= 0.0f) return 0;
  int q = (int)lroundf(value / scale) + zeroPoint;
  return (uint8_t)constrain(q, 0, 255);
}

float TinyMLManager::dequantizeValue(int32_t value, const TfLiteTensor* tensor) {
  const float scale = tensor->params.scale;
  const int zeroPoint = tensor->params.zero_point;
  return ((float)value - (float)zeroPoint) * scale;
}

bool TinyMLManager::runInference(SmartFarmData& data) {
  if (!_initialized || !_interpreter) {
    Serial.println("[TinyMLManager] LỖI: Bộ suy luận chưa sẵn sàng");
    return false;
  }

  TfLiteTensor* input = _interpreter->input(0);
  TfLiteTensor* output = _interpreter->output(0);
  if (!input || !output) return false;

  // 1. Chuẩn hóa dữ liệu đầu vào theo dải đo của mô hình Keras
  float tempNorm = normalizeRange(data.temperature, 15.0f, 45.0f);
  float humNorm  = normalizeRange(data.humidity,    0.0f, 100.0f);
  float soilNorm = normalizeRange((float)data.soil_pct, 0.0f, 100.0f);
  float luxNorm  = normalizeRange(data.lux,         0.0f, 5000.0f);

  float inputs[4] = { tempNorm, humNorm, soilNorm, luxNorm };

  // 2. Nạp dữ liệu đầu vào (float32)
  for (int i = 0; i < 4; i++) {
    switch (input->type) {
      case kTfLiteFloat32:
        input->data.f[i] = inputs[i];
        break;
      case kTfLiteInt8:
        input->data.int8[i] = quantizeInt8(inputs[i], input);
        break;
      case kTfLiteUInt8:
        input->data.uint8[i] = quantizeUInt8(inputs[i], input);
        break;
      default:
        Serial.println("[TinyMLManager] LỖI: Kiểu dữ liệu đầu vào Tensor không hỗ trợ");
        return false;
    }
  }

  // 3. Thực thi suy luận
  if (_interpreter->Invoke() != kTfLiteOk) {
    Serial.println("[TinyMLManager] LỖI: Chạy mô hình thất bại");
    return false;
  }

  // 4. Lấy kết quả đầu ra
  float outputs[3] = {0.0f};
  for (int i = 0; i < 3; i++) {
    switch (output->type) {
      case kTfLiteFloat32:
        outputs[i] = output->data.f[i];
        break;
      case kTfLiteInt8:
        outputs[i] = dequantizeValue(output->data.int8[i], output);
        break;
      case kTfLiteUInt8:
        outputs[i] = dequantizeValue(output->data.uint8[i], output);
        break;
      default:
        Serial.println("[TinyMLManager] LỖI: Kiểu dữ liệu đầu ra Tensor không hỗ trợ");
        return false;
    }
  }

  // 5. Áp dụng Hysteresis để bật/tắt an toàn
  data.fan   = data.fan   ? (outputs[0] >= AI_THRESH_OFF) : (outputs[0] >= AI_THRESH_ON);
  data.light = data.light ? (outputs[1] >= AI_THRESH_OFF) : (outputs[1] >= AI_THRESH_ON);
  data.pump  = data.pump  ? (outputs[2] >= AI_THRESH_OFF) : (outputs[2] >= AI_THRESH_ON);

  Serial.printf("[TinyMLManager] Kết quả AI: Fan=%.3f (%s), Light=%.3f (%s), Pump=%.3f (%s)\n",
                outputs[0], data.fan ? "ON" : "OFF",
                outputs[1], data.light ? "ON" : "OFF",
                outputs[2], data.pump ? "ON" : "OFF");

  return true;
}
