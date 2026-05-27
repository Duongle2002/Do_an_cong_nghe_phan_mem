#include "app_network_manager.h"

AppNetworkManager::AppNetworkManager(WifiConfigPortal& portal) 
  : _wifiPortal(portal), _mqttClient(_espClient) {}

void AppNetworkManager::begin(const String& deviceId) {
  _deviceId = deviceId;
  _mqttClient.setServer(DEFAULT_MQTT_SERVER, DEFAULT_MQTT_PORT);
  
  // Kiểm tra trạng thái mạng ban đầu
  if (WiFi.status() == WL_CONNECTED) {
    _state = STATE_NORMAL_WIFI;
    Serial.println("[AppNetworkManager] Đã kết nối WiFi nhà. Chuyển sang NORMAL_WIFI");
  } else {
    _state = STATE_INIT;
    Serial.println("[AppNetworkManager] Khởi chạy cổng cấu hình WiFi...");
    _wifiPortal.begin();
  }
  
  _lastPublish = millis();
  _lastWifiCheck = millis();
  _lastHomeWifiRetry = millis();
}

bool AppNetworkManager::connectToMqtt() {
  if (_mqttClient.connected()) return true;

  unsigned long now = millis();
  if (now - _lastMqttRetry < 5000UL) return false; // Thử lại sau mỗi 5s để tránh nghẽn
  _lastMqttRetry = now;

  String clientId = "wroom-client-" + _deviceId;
  Serial.print("[AppNetworkManager] Đang kết nối MQTT Broker...");
  
  bool success = false;
  if (strlen(DEFAULT_MQTT_USER) > 0) {
    success = _mqttClient.connect(clientId.c_str(), DEFAULT_MQTT_USER, DEFAULT_MQTT_PASS);
  } else {
    success = _mqttClient.connect(clientId.c_str());
  }

  if (success) {
    Serial.println(" THÀNH CÔNG");
    // Đăng ký nhận lệnh từ Cloud nếu cần
    String controlTopic = "farm/" + _deviceId + "/control/#";
    _mqttClient.subscribe(controlTopic.c_str());
    _offlineTimeRecorded = false; // Reset cờ đếm thời gian mất mạng
    return true;
  } else {
    Serial.printf(" THẤT BẠI (rc=%d)\n", _mqttClient.state());
    return false;
  }
}

bool AppNetworkManager::connectToTcpServer() {   
  if (_tcpClient.connected()) return true;

  unsigned long now = millis();
  if (now - _lastTcpRetry < 4000UL) return false; // Thử kết nối TCP Server mỗi 4s
  _lastTcpRetry = now;

  Serial.printf("[AppNetworkManager] Đang kết nối TCP Server tại 192.168.4.1:%d...", FALLBACK_TCP_PORT);
  
  // Địa chỉ mặc định của SoftAP của S3 là 192.168.4.1
  if (_tcpClient.connect(IPAddress(192, 168, 4, 1), FALLBACK_TCP_PORT)) {
    Serial.println(" THÀNH CÔNG");
    return true;
  } else {
    Serial.println(" THẤT BẠI");
    return false;
  }
}

void AppNetworkManager::publishMqtt(const SmartFarmData& data) {
  if (!_mqttClient.connected()) return;

  // 1. Tạo gói JSON cho Telemetry
  StaticJsonDocument<256> telDoc;
  telDoc["id"] = _deviceId;
  telDoc["node_type"] = "sensor";
  telDoc["temperature"] = isnan(data.temperature) ? JsonVariant() : data.temperature;
  telDoc["humidity"] = isnan(data.humidity) ? JsonVariant() : data.humidity;
  telDoc["lux"] = isnan(data.lux) ? JsonVariant() : data.lux;
  telDoc["soil_pct"] = data.soil_pct;
  telDoc["uptime_s"] = millis() / 1000UL;

  char telPayload[256];
  serializeJson(telDoc, telPayload);
  String telTopic = "farm/" + _deviceId + "/telemetry";
  _mqttClient.publish(telTopic.c_str(), telPayload);

  // 2. Tạo gói JSON cho State (AI decisions)
  StaticJsonDocument<256> stateDoc;
  stateDoc["id"] = _deviceId;
  stateDoc["fan"] = data.fan;
  stateDoc["light"] = data.light;
  stateDoc["pump"] = data.pump;
  
  // Đồng bộ cả relay dạng relay_xx giống backend cũ
  stateDoc["relay_fan"] = data.fan;
  stateDoc["relay_light"] = data.light;
  stateDoc["relay_pump"] = data.pump;

  char statePayload[256];
  serializeJson(stateDoc, statePayload);
  String stateTopic = "farm/" + _deviceId + "/ai_state";
  _mqttClient.publish(stateTopic.c_str(), statePayload);

  Serial.println("[AppNetworkManager] Đã gửi MQTT Telemetry & AI State");
}

void AppNetworkManager::sendTcp(const SmartFarmData& data) {
  if (!_tcpClient.connected() && !connectToTcpServer()) return;

  // Tạo gói JSON đồng bộ theo quy ước Offline Protocol
  StaticJsonDocument<256> doc;
  doc["id"] = _deviceId;
  doc["temperature"] = isnan(data.temperature) ? JsonVariant() : data.temperature;
  doc["humidity"] = isnan(data.humidity) ? JsonVariant() : data.humidity;
  doc["soil"] = data.soil_pct;
  doc["soil_pct"] = data.soil_pct;
  doc["lux"] = isnan(data.lux) ? JsonVariant() : data.lux;
  doc["fan"] = data.fan;
  doc["light"] = data.light;
  doc["pump"] = data.pump;

  String payload;
  serializeJson(doc, payload);
  payload += "\n"; // Ký tự kết thúc dòng để S3 dễ phân tách gói tin
  
  _tcpClient.print(payload);
  Serial.print("[AppNetworkManager] Đã gửi gói TCP: ");
  Serial.print(payload);
}

void AppNetworkManager::tryHomeWifiReconnect() {
  Serial.println("[AppNetworkManager] Thử ngắt kết nối AP và tìm lại WiFi nhà...");
  resetWifiStack();
  
  // Load lại cấu hình WiFi đã lưu từ cổng
  Preferences prefs;
  prefs.begin("wroomwifi", true);
  String ssid = prefs.getString("wifi_ssid", "");
  String pass = prefs.getString("wifi_pass", "");
  prefs.end();

  if (ssid.length() > 0) {
    Serial.printf("[AppNetworkManager] Đang thử kết nối lại tới: %s\n", ssid.c_str());
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    // Đợi tối đa 8 giây để xem có kết nối lại được không
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 8000UL) {
      delay(200);
    }
  }
}

void AppNetworkManager::resetWifiStack() {
  Serial.println("[AppNetworkManager] Resetting WiFi Stack...");
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(200);
  WiFi.mode(WIFI_STA);
  delay(200);
}

void AppNetworkManager::process(SmartFarmData& data) {
  _wifiPortal.process();
  
  unsigned long now = millis();

  // Máy trạng thái mạng chính
  switch (_state) {
    case STATE_INIT:
      if (WiFi.status() == WL_CONNECTED) {
        _state = STATE_NORMAL_WIFI;
        Serial.println("[AppNetworkManager] WiFi kết nối. Sang NORMAL_WIFI");
      } else {
        // Chỉ tự động chuyển sang Fallback nếu đã có cấu hình WiFi chính nhưng không kết nối được sau 60 giây.
        // Nếu chưa cấu hình WiFi chính (SSID trống), giữ cổng cấu hình portal hoạt động vô hạn để người dùng kết nối.
        if (_wifiPortal.ssid().length() > 0) {
          if (now - _lastWifiCheck > 60000UL) {
            _lastWifiCheck = now;
            _state = STATE_FALLBACK_WIFI;
            Serial.println("[AppNetworkManager] Khởi tạo không thành công. Chuyển sang FALLBACK_WIFI");
          }
        } else {
          _lastWifiCheck = now; // reset timer liên tục khi SSID trống để không bị timeout chuyển sang Fallback
        }
      }
      break;

    case STATE_NORMAL_WIFI:
      handleNormalWifiState(data);
      break;

    case STATE_FALLBACK_WIFI:
      handleFallbackWifiState(data);
      break;

    case STATE_FULL_FAILURE:
      handleFullFailureState(data);
      break;
  }
}

void AppNetworkManager::handleNormalWifiState(SmartFarmData& data) {
  unsigned long now = millis();

  // 1. Kiểm tra mất kết nối WiFi hoặc MQTT
  if (WiFi.status() != WL_CONNECTED) {
    if (!_offlineTimeRecorded) {
      _offlineDetectedTime = now;
      _offlineTimeRecorded = true;
    }
    
    // Nếu mất WiFi quá 30 giây
    if (now - _offlineDetectedTime > 30000UL) {
      Serial.println("[AppNetworkManager] Mất WiFi quá 30 giây! Chuyển sang FALLBACK_WIFI");
      _state = STATE_FALLBACK_WIFI;
      _offlineTimeRecorded = false;
      
      // Ngắt MQTT và WiFi hoàn toàn để chuẩn bị kết nối AP của S3
      _mqttClient.disconnect(); // Dọn dẹp PubSubClient state trước khi reset
      resetWifiStack();
      return;
    }
  } else {
    // Nếu WiFi bình thường, duy trì MQTT
    if (connectToMqtt()) {
      _mqttClient.loop();
      
      // Định kỳ gửi dữ liệu
      if (now - _lastPublish >= MQTT_PUBLISH_INTERVAL_MS) {
        _lastPublish = now;
        publishMqtt(data);
      }
    } else {
      // WiFi connected nhưng MQTT failed (mất Internet)
      _mqttClient.loop(); // Vẫn chạy loop để xử lý buffer reconnect của PubSubClient
      if (!_offlineTimeRecorded) {
        _offlineDetectedTime = now;
        _offlineTimeRecorded = true;
      }
      
      if (now - _offlineDetectedTime > 60000UL) { // Tăng lên 60s: đủ thời gian MQTT broker khởi động
        Serial.println("[AppNetworkManager] Mất kết nối MQTT Broker quá 60 giây (Mất Internet)! Chuyển sang FALLBACK_WIFI");
        _state = STATE_FALLBACK_WIFI;
        _offlineTimeRecorded = false;
        _mqttClient.disconnect(); // Dọn dẹp PubSubClient state trước khi reset
        resetWifiStack();
        return;
      }
    }
  }
}

void AppNetworkManager::handleFallbackWifiState(SmartFarmData& data) {
  unsigned long now = millis();

  // 1. Định kỳ (mỗi 60 giây) kiểm tra lại xem WiFi nhà có khôi phục chưa
  if (now - _lastHomeWifiRetry >= 60000UL) {
    _lastHomeWifiRetry = now;
    
    // Ngắt TCP trước khi đổi mạng
    if (_tcpClient.connected()) {
      _tcpClient.stop();
    }
    
    tryHomeWifiReconnect();
    
    if (WiFi.status() == WL_CONNECTED && String(WiFi.SSID()) != FALLBACK_AP_SSID) {
      Serial.println("[AppNetworkManager] Đã khôi phục kết nối WiFi nhà. Chuyển sang NORMAL_WIFI");
      _mqttClient.disconnect(); // Xoá trạng thái cũ của PubSubClient
      _lastMqttRetry = 0;       // Bỏ qua throttle 5s → kết nối MQTT ngay lập tức
      _state = STATE_NORMAL_WIFI;
      _offlineTimeRecorded = false;
      return; // Kết thúc sớm để tránh kết nối Fallback AP trong cùng vòng lặp này
    } else {
      Serial.println("[AppNetworkManager] Không thể khôi phục WiFi nhà. Tiếp tục chế độ FALLBACK_WIFI");
      resetWifiStack();
      _lastFallbackWifiRetry = millis(); // Reset để lùi tiến trình quét Fallback AP sau ít nhất 20s
    }
  }

  // 2. Kết nối vào SoftAP của S3 nếu chưa kết nối (thử lại mỗi 20 giây để tránh nghẽn luồng)
  if (WiFi.status() != WL_CONNECTED || String(WiFi.SSID()) != FALLBACK_AP_SSID) {
    // Tránh trùng thời điểm quét lại WiFi nhà (lệch ít nhất 10 giây)
    if (now - _lastHomeWifiRetry >= 10000UL) {
      if (now - _lastFallbackWifiRetry >= 20000UL) {
        _lastFallbackWifiRetry = now;
        Serial.printf("[AppNetworkManager] Đang kết nối vào Fallback AP: %s...\n", FALLBACK_AP_SSID);
        resetWifiStack();
        WiFi.begin(FALLBACK_AP_SSID, FALLBACK_AP_PASS);
      }
    }
  }

  // Khởi tạo các trạng thái thông báo thành công/thất bại tĩnh để log khi có thay đổi trạng thái
  static bool wasConnectedToFallback = false;
  bool isConnectedToFallback = (WiFi.status() == WL_CONNECTED && String(WiFi.SSID()) == FALLBACK_AP_SSID);
  if (isConnectedToFallback && !wasConnectedToFallback) {
    Serial.println("[AppNetworkManager] Kết nối Fallback AP THÀNH CÔNG");
  } else if (!isConnectedToFallback && wasConnectedToFallback) {
    Serial.println("[AppNetworkManager] Mất kết nối tới Fallback AP");
  }
  wasConnectedToFallback = isConnectedToFallback;

  // 3. Nếu đã kết nối tới AP của S3, mở TCP Client gửi dữ liệu
  if (WiFi.status() == WL_CONNECTED && String(WiFi.SSID()) == FALLBACK_AP_SSID) {
    if (now - _lastPublish >= TCP_SEND_INTERVAL_MS) {
      _lastPublish = now;
      sendTcp(data);
    }
  }
}

void AppNetworkManager::handleFullFailureState(SmartFarmData& data) {
  // Chế độ thất bại hoàn toàn (không có mạng nào)
  // Vẫn chạy suy luận AI bình thường tại loop()
  unsigned long now = millis();
  if (now - _lastHomeWifiRetry >= 30000UL) {
    _lastHomeWifiRetry = now;
    Serial.println("[AppNetworkManager] Đang thử kết nối lại các mạng...");
    tryHomeWifiReconnect();
    if (WiFi.status() == WL_CONNECTED) {
      _state = STATE_NORMAL_WIFI;
    }
  }
}
