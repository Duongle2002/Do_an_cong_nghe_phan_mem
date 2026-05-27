#include "relay_manager.h"
#include <Preferences.h>

RelayManager::RelayManager() {}

void RelayManager::begin(RelayStateChangedCallback callback) {
  _onStateChanged = callback;

  // Đọc chế độ hoạt động đã lưu từ bộ nhớ Flash NVS
  Preferences prefs;
  prefs.begin("s3ctrl", true);
  _opMode = (OperationalMode)prefs.getInt("op_mode", (int)MODE_AUTO);
  prefs.end();
  Serial.printf("[RelayManager] Khoi tao: Che do hoat dong = %s\n", 
                _opMode == MODE_MANUAL ? "MANUAL" : (_opMode == MODE_AUTO ? "AUTO" : "SCHEDULED"));

  // Cấu hình chân rơ-le và đưa về trạng thái TẮT an toàn lúc khởi động
  const int offLevel = RELAY_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(RELAY_FAN_PIN, offLevel);
  digitalWrite(RELAY_LIGHT_PIN, offLevel);
  digitalWrite(RELAY_PUMP_PIN, offLevel);
  
  pinMode(RELAY_FAN_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(RELAY_PUMP_PIN, OUTPUT);

  // Cấu hình chân nút bấm kéo lên điện trở nội bộ (INPUT_PULLUP)
  pinMode(BTN_FAN_PIN, INPUT_PULLUP);
  pinMode(BTN_LIGHT_PIN, INPUT_PULLUP);
  pinMode(BTN_PUMP_PIN, INPUT_PULLUP);
  pinMode(BTN_MODE_PIN, INPUT_PULLUP);

  // Khóa phím bấm lúc khởi động 1s để ổn định nguồn điện và VCC
  _lastRelayToggleTime = millis();
}

void RelayManager::applyRelay(int pin, bool state) {
  digitalWrite(pin, RELAY_ACTIVE_HIGH ? (state ? HIGH : LOW) : (state ? LOW : HIGH));
  _lastRelayToggleTime = millis(); // Ghi nhận thời điểm thay đổi trạng thái rơ-le để khóa phím
}

void RelayManager::triggerStateChange(const char* target, bool state, const char* reason) {
  if (_onStateChanged) {
    _onStateChanged(target, state, reason);
  }
}

void RelayManager::setManualControl(const String& target, bool on, const char* reason) {
  unsigned long now = millis();
  if (target == "fan") {
    // Chỉ áp dụng thời hạn đè 5 phút ở chế độ AUTO. Các chế độ khác đè vĩnh viễn (0)
    _overrideFanUntil = (_opMode == MODE_AUTO) ? (now + RELAY_MANUAL_OVERRIDE_MS) : 0;
    if (_fanState != on) {
      _fanState = on;
      applyRelay(RELAY_FAN_PIN, on);
      triggerStateChange("fan", on, reason);
    }
  } else if (target == "light") {
    _overrideLightUntil = (_opMode == MODE_AUTO) ? (now + RELAY_MANUAL_OVERRIDE_MS) : 0;
    if (_lightState != on) {
      _lightState = on;
      applyRelay(RELAY_LIGHT_PIN, on);
      triggerStateChange("light", on, reason);
    }
  } else if (target == "pump") {
    _overridePumpUntil = (_opMode == MODE_AUTO) ? (now + RELAY_MANUAL_OVERRIDE_MS) : 0;
    if (_pumpState != on) {
      _pumpState = on;
      applyRelay(RELAY_PUMP_PIN, on);
      triggerStateChange("pump", on, reason);
    }
  }
}

void RelayManager::clearOverrides() {
  _overrideFanUntil = 0;
  _overrideLightUntil = 0;
  _overridePumpUntil = 0;
  Serial.println("[RelayManager] Da giai phong hoan toan trang thai khoa dieu khien thu cong!");
}

void RelayManager::setMode(OperationalMode mode) {
  _opMode = mode;
  Preferences prefs;
  prefs.begin("s3ctrl", false);
  prefs.putInt("op_mode", (int)mode);
  prefs.end();
  Serial.printf("[RelayManager] Chuyen che do hoat dong sang: %s\n", 
                mode == MODE_MANUAL ? "MANUAL" : (mode == MODE_AUTO ? "AUTO" : "SCHEDULED"));
  
  if (mode == MODE_AUTO || mode == MODE_SCHEDULED) {
    clearOverrides();
  }
}

void RelayManager::setAutoControl(bool fanOn, bool lightOn, bool pumpOn) {
  // Chỉ áp dụng AI điều khiển nếu đang ở chế độ AUTO
  if (_opMode != MODE_AUTO) {
    return;
  }

  unsigned long now = millis();

  if (now >= _overrideFanUntil) {
    if (_fanState != fanOn) {
      _fanState = fanOn;
      applyRelay(RELAY_FAN_PIN, fanOn);
      triggerStateChange("fan", fanOn, "auto");
    }
  }

  if (now >= _overrideLightUntil) {
    if (_lightState != lightOn) {
      _lightState = lightOn;
      applyRelay(RELAY_LIGHT_PIN, lightOn);
      triggerStateChange("light", lightOn, "auto");
    }
  }

  if (now >= _overridePumpUntil) {
    if (_pumpState != pumpOn) {
      _pumpState = pumpOn;
      applyRelay(RELAY_PUMP_PIN, pumpOn);
      triggerStateChange("pump", pumpOn, "auto");
    }
  }
}

void RelayManager::process() {
  unsigned long now = millis();

  // Bỏ qua tất cả phím bấm trong vòng 1000ms đầu khi bất kỳ rơ-le nào thay đổi trạng thái
  // hoặc khi mạch vừa khởi động, nhằm triệt tiêu hoàn toàn hiện tượng rung và nhảy rơ-le do nhiễu điện/sụt áp
  if (now - _lastRelayToggleTime < 1000UL) {
    _fanBtnPressStart = 0;
    _lightBtnPressStart = 0;
    _pumpBtnPressStart = 0;
    _modeBtnPressStart = 0;
    _fanBtnPressed = false;
    _lightBtnPressed = false;
    _pumpBtnPressed = false;
    _modeBtnPressed = false;
    return;
  }

  // 1. Nút nhấn Quạt
  int rawFan = digitalRead(BTN_FAN_PIN);
  if (rawFan == LOW) {
    if (_fanBtnPressStart == 0) {
      _fanBtnPressStart = now;
    } else if (!_fanBtnPressed && (now - _fanBtnPressStart >= BUTTON_DEBOUNCE_MS)) {
      _fanBtnPressed = true;
      setManualControl("fan", !_fanState, "button");
    }
  } else {
    _fanBtnPressStart = 0;
    _fanBtnPressed = false;
  }

  // 2. Nút nhấn Đèn
  int rawLight = digitalRead(BTN_LIGHT_PIN);
  if (rawLight == LOW) {
    if (_lightBtnPressStart == 0) {
      _lightBtnPressStart = now;
    } else if (!_lightBtnPressed && (now - _lightBtnPressStart >= BUTTON_DEBOUNCE_MS)) {
      _lightBtnPressed = true;
      setManualControl("light", !_lightState, "button");
    }
  } else {
    _lightBtnPressStart = 0;
    _lightBtnPressed = false;
  }

  // 3. Nút nhấn Bơm
  int rawPump = digitalRead(BTN_PUMP_PIN);
  if (rawPump == LOW) {
    if (_pumpBtnPressStart == 0) {
      _pumpBtnPressStart = now;
    } else if (!_pumpBtnPressed && (now - _pumpBtnPressStart >= BUTTON_DEBOUNCE_MS)) {
      _pumpBtnPressed = true;
      setManualControl("pump", !_pumpState, "button");
    }
  } else {
    _pumpBtnPressStart = 0;
    _pumpBtnPressed = false;
  }

  // 4. Nút nhấn chuyển Chế độ (Mode Switch)
  int rawMode = digitalRead(BTN_MODE_PIN);
  if (rawMode == LOW) {
    if (_modeBtnPressStart == 0) {
      _modeBtnPressStart = now;
    } else if (!_modeBtnPressed && (now - _modeBtnPressStart >= BUTTON_DEBOUNCE_MS)) {
      _modeBtnPressed = true;
      OperationalMode nextMode = (OperationalMode)(((int)_opMode + 1) % 3);
      setMode(nextMode);
      triggerStateChange("mode", false, "button");
    }
  } else {
    _modeBtnPressStart = 0;
    _modeBtnPressed = false;
  }
}
