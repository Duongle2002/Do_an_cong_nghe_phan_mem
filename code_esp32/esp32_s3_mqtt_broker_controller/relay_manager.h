#pragma once

#include <Arduino.h>
#include "config.h"

// Kiểu dữ liệu con trỏ hàm để callback khi trạng thái rơ-le thay đổi
typedef void (*RelayStateChangedCallback)(const char* target, bool state, const char* reason);

class RelayManager {
public:
  RelayManager();
  void begin(RelayStateChangedCallback callback);
  void process();
  
  // Hàm ghi đè trạng thái từ ngoài (MQTT command / TCP command)
  void setManualControl(const String& target, bool on, const char* reason);
  
  // Hàm xoá trạng thái ghi đè thủ công
  void clearOverrides();

  // Hàm áp dụng trạng thái từ thuật toán AI (nếu không có Manual Override đang kích hoạt)
  void setAutoControl(bool fanOn, bool lightOn, bool pumpOn);

  // Getter/Setter chế độ hoạt động
  OperationalMode getMode() const { return _opMode; }
  void setMode(OperationalMode mode);

  // Getter trạng thái hiện tại
  bool getFanState() const { return _fanState; }
  bool getLightState() const { return _lightState; }
  bool getPumpState() const { return _pumpState; }

  // Getter thời gian đè thủ công
  bool isFanOverridden() const { return millis() < _overrideFanUntil; }
  bool isLightOverridden() const { return millis() < _overrideLightUntil; }
  bool isPumpOverridden() const { return millis() < _overridePumpUntil; }

private:
  bool _fanState = false;
  bool _lightState = false;
  bool _pumpState = false;

  unsigned long _overrideFanUntil = 0;
  unsigned long _overrideLightUntil = 0;
  unsigned long _overridePumpUntil = 0;

  OperationalMode _opMode = MODE_AUTO;

  // Bộ đếm thời gian chống rung ổn định phím bấm
  unsigned long _fanBtnPressStart = 0;
  unsigned long _lightBtnPressStart = 0;
  unsigned long _pumpBtnPressStart = 0;
  unsigned long _modeBtnPressStart = 0;

  bool _fanBtnPressed = false;
  bool _lightBtnPressed = false;
  bool _pumpBtnPressed = false;
  bool _modeBtnPressed = false;

  // Thời điểm cuối cùng trạng thái rơ-le thay đổi (để chặn nhiễu điện/sụt áp)
  unsigned long _lastRelayToggleTime = 0;

  RelayStateChangedCallback _onStateChanged = nullptr;

  void applyRelay(int pin, bool state);
  void triggerStateChange(const char* target, bool state, const char* reason);
};
