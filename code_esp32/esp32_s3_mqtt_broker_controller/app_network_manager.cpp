#include "app_network_manager.h"

AppNetworkManager::AppNetworkManager(WifiConfigPortal& portal) 
  : _wifiPortal(portal), _mqttClient(_espClient), _tcpServer(FALLBACK_TCP_PORT) {}

void AppNetworkManager::begin(const String& deviceId, RelayManager* relayManager) {
  _deviceId = deviceId;
  _relayManager = relayManager;

  // 1. Cấu hình chế độ AP + STA song song (Rất quan trọng cho cơ chế Fallback AP)
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP(FALLBACK_AP_SSID, FALLBACK_AP_PASS);
  delay(100);
  
  Serial.printf("[AppNetworkManager] AP phát tại SSID: %s, Pass: %s\n", FALLBACK_AP_SSID, FALLBACK_AP_PASS);
  Serial.print("[AppNetworkManager] IP của SoftAP: ");
  Serial.println(WiFi.softAPIP());

  // 2. Khởi động TCP Server để hứng kết nối từ WROOM khi offline
  _tcpServer.begin();
  _tcpServer.setNoDelay(true);
  Serial.printf("[AppNetworkManager] TCP Server bắt đầu lắng nghe tại cổng %d\n", FALLBACK_TCP_PORT);

  // 3. Tải thông tin ghép cặp cũ (pairedSensorId) từ NVS Flash
  Preferences prefs;
  prefs.begin("s3wifi", true);
  _pairedSensorId = prefs.getString("paired_sensor", "");
  prefs.end();
  Serial.printf("[AppNetworkManager] Sensor Node đang ghép cặp: %s\n", 
                _pairedSensorId.length() > 0 ? _pairedSensorId.c_str() : "(Chưa cấu hình)");

  // 4. Khởi động cổng kết nối STA
  _wifiPortal.begin();

  // 5. Cấu hình MQTT
  _mqttClient.setServer(DEFAULT_MQTT_SERVER, DEFAULT_MQTT_PORT);
  
  // Thiết lập callback xử lý tin nhắn nhận được
  _mqttClient.setCallback([this](char* topic, byte* payload, unsigned int length) {
    this->handleMqttMessage(topic, payload, length);
  });
}

bool AppNetworkManager::connectToMqtt() {
  if (_mqttClient.connected()) return true;

  unsigned long now = millis();
  if (now - _lastMqttRetry < MQTT_RETRY_INTERVAL_MS) return false;
  _lastMqttRetry = now;

  String clientId = "s3-controller-" + _deviceId;
  Serial.print("[AppNetworkManager] Đang kết nối MQTT Broker...");
  
  bool success = false;
  if (strlen(DEFAULT_MQTT_USER) > 0) {
    success = _mqttClient.connect(clientId.c_str(), DEFAULT_MQTT_USER, DEFAULT_MQTT_PASS);
  } else {
    success = _mqttClient.connect(clientId.c_str());
  }

  if (success) {
    Serial.println(" THÀNH CÔNG");
    
    // Đăng ký nhận cấu hình ghép cặp động từ Web/App
    String configTopic = "farm/" + _deviceId + "/config";
    _mqttClient.subscribe(configTopic.c_str());
    Serial.printf("[AppNetworkManager] Subscribed: %s\n", configTopic.c_str());

    // Đăng ký nhận lệnh điều khiển từ người dùng
    String controlTopic = "farm/" + _deviceId + "/control/#";
    _mqttClient.subscribe(controlTopic.c_str());
    Serial.printf("[AppNetworkManager] Subscribed: %s\n", controlTopic.c_str());

    // Đăng ký subscribe các topic cảm biến của riêng node WROOM đang được ghép cặp
    updateSubscriptions(_pairedSensorId);
    
    return true;
  } else {
    Serial.printf(" THẤT BẠI (rc=%d)\n", _mqttClient.state());
    return false;
  }
}

void AppNetworkManager::updateSubscriptions(const String& newPairedId) {
  if (!_mqttClient.connected()) return;

  // 1. Huỷ đăng ký các topic cảm biến cũ nếu có
  if (_activeTelemetryTopic.length() > 0) {
    _mqttClient.unsubscribe(_activeTelemetryTopic.c_str());
  }
  if (_activeStateTopic.length() > 0) {
    _mqttClient.unsubscribe(_activeStateTopic.c_str());
  }
  if (_activeControlTopic.length() > 0) {
    _mqttClient.unsubscribe(_activeControlTopic.c_str());
  }

  // 2. Đăng ký các topic cảm biến mới nếu ID hợp lệ
  if (newPairedId.length() > 0) {
    _activeTelemetryTopic = "farm/" + newPairedId + "/telemetry";
    _activeStateTopic = "farm/" + newPairedId + "/state";
    _activeControlTopic = "farm/" + newPairedId + "/control/#";

    _mqttClient.subscribe(_activeTelemetryTopic.c_str());
    _mqttClient.subscribe(_activeStateTopic.c_str());
    _mqttClient.subscribe(_activeControlTopic.c_str());

    Serial.printf("[AppNetworkManager] Đăng ký lắng nghe WROOM Node mới:\n -> %s\n -> %s\n -> %s\n", 
                  _activeTelemetryTopic.c_str(), _activeStateTopic.c_str(), _activeControlTopic.c_str());
  } else {
    _activeTelemetryTopic = "";
    _activeStateTopic = "";
    _activeControlTopic = "";
  }
}

void AppNetworkManager::handleMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Chuyển payload sang String
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  // Chuẩn hóa và làm sạch chuỗi payload nhận được (loại bỏ khoảng trắng, dấu nháy kép dư thừa)
  msg.trim();
  if (msg.startsWith("\"") && msg.endsWith("\"")) {
    msg = msg.substring(1, msg.length() - 1);
  }
  msg.trim();
  
  String topicStr = String(topic);
  Serial.printf("[AppNetworkManager] Nhận MQTT [%s]: %s\n", topic, msg.c_str());

  // 1. Xử lý nhận gói tin cấu hình ghép cặp (farm/S3_ID/config)
  if (topicStr == "farm/" + _deviceId + "/config") {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, msg);
    if (err) {
      Serial.println("[AppNetworkManager] Lỗi phân tích JSON cấu hình");
      return;
    }
    
    if (doc.containsKey("pairedSensorId")) {
      String newPairedId = doc["pairedSensorId"].as<String>();
      newPairedId.trim();

      if (newPairedId != _pairedSensorId) {
        _pairedSensorId = newPairedId;
        
        // Lưu ID ghép cặp mới vào Flash NVS để ghi nhớ
        Preferences prefs;
        prefs.begin("s3wifi", false);
        prefs.putString("paired_sensor", _pairedSensorId);
        prefs.end();
        
        Serial.printf("[AppNetworkManager] Ghép cặp thành công với node: %s\n", _pairedSensorId.c_str());
        
        // Cập nhật subscription
        updateSubscriptions(_pairedSensorId);
      }
    }
    return;
  }

  // 2. Xử lý nhận lệnh điều khiển thủ công hoặc chế độ từ Web/App (farm/S3_ID/control/<device> hoặc farm/WROOM_ID/control/<device>)
  if (topicStr.startsWith("farm/" + _deviceId + "/control/") || 
      (_pairedSensorId.length() > 0 && topicStr.startsWith("farm/" + _pairedSensorId + "/control/"))) {
    int lastSlash = topicStr.lastIndexOf('/');
    String target = topicStr.substring(lastSlash + 1); // fan, light, pump, auto, clear, mode
    
    if (target == "mode") {
      if (msg == "manual") {
        _relayManager->setMode(MODE_MANUAL);
      } else if (msg == "auto") {
        _relayManager->setMode(MODE_AUTO);
      } else if (msg == "scheduled") {
        _relayManager->setMode(MODE_SCHEDULED);
      }
      return;
    }

    if (target == "auto" || target == "clear") {
      _relayManager->clearOverrides();
      return;
    }

    bool on = (msg == "ON" || msg == "1");
    _relayManager->setManualControl(target, on, "command");
    return;
  }

  // 3. Xử lý nhận dữ liệu telemetry từ WROOM được ghép cặp (farm/WROOM_ID/telemetry)
  if (_pairedSensorId.length() > 0 && topicStr == "farm/" + _pairedSensorId + "/telemetry") {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      if (doc.containsKey("temperature")) _temp = doc["temperature"].as<float>();
      if (doc.containsKey("humidity")) _hum = doc["humidity"].as<float>();
      if (doc.containsKey("lux")) _lux = doc["lux"].as<float>();
      if (doc.containsKey("soil_pct")) _soilPct = doc["soil_pct"].as<int>();
      else if (doc.containsKey("soil")) _soilPct = doc["soil"].as<int>();
      else if (doc.containsKey("soilMoisture")) _soilPct = doc["soilMoisture"].as<int>();
      _lastMsgMillis = millis();
    }
    return;
  }

  // 4. Xử lý nhận quyết định AI từ WROOM được ghép cặp (farm/WROOM_ID/state)
  if (_pairedSensorId.length() > 0 && topicStr == "farm/" + _pairedSensorId + "/state") {
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, msg) == DeserializationError::Ok) {
      bool fan = doc["fan"].as<bool>();
      bool light = doc["light"].as<bool>();
      bool pump = doc["pump"].as<bool>();

      _relayManager->setAutoControl(fan, light, pump);

      // Chỉ cập nhật cache hiển thị OLED từ AI nếu đang ở chế độ AUTO
      if (_relayManager->getMode() == MODE_AUTO) {
        _fanState = fan;
        _lightState = light;
        _pumpState = pump;
      } else {
        _fanState = _relayManager->getFanState();
        _lightState = _relayManager->getLightState();
        _pumpState = _relayManager->getPumpState();
      }
    }
    return;
  }
}

void AppNetworkManager::publishState(const char* reason, bool fan, bool light, bool pump) {
  if (!_mqttClient.connected()) return;

  // Gửi trạng thái rơ-le thực tế của S3 lên Cloud để app đồng bộ
  StaticJsonDocument<256> doc;
  doc["id"] = _deviceId;
  doc["reason"] = reason;
  doc["relay_fan"] = fan;
  doc["relay_light"] = light;
  doc["relay_pump"] = pump;
  
  // Đồng bộ cả phím dạng fan/light/pump giống WROOM để app dễ xử lý
  doc["fan"] = fan;
  doc["light"] = light;
  doc["pump"] = pump;

  // Đóng gói opMode hiện tại để đồng bộ lên Database
  OperationalMode mode = _relayManager->getMode();
  if (mode == MODE_MANUAL) doc["opMode"] = "manual";
  else if (mode == MODE_AUTO) doc["opMode"] = "auto";
  else if (mode == MODE_SCHEDULED) doc["opMode"] = "scheduled";

  char payload[256];
  serializeJson(doc, payload);
  String topic = "farm/" + _deviceId + "/state";
  _mqttClient.publish(topic.c_str(), payload);
  Serial.printf("[AppNetworkManager] Đã gửi trạng thái rơ-le lên Cloud (%s)\n", reason);
}

void AppNetworkManager::processTcpServer(SmartFarmData& data, unsigned long& lastMsgMillis) {
  // 1. Kiểm tra kết nối khách hàng mới (TCP Client)
  if (_tcpServer.hasClient()) {
    if (_tcpClient && _tcpClient.connected()) {
      _tcpClient.stop(); // Chỉ chấp nhận duy nhất 1 node cảm biến kết nối
    }
    _tcpClient = _tcpServer.available();
    Serial.println("[AppNetworkManager] Có kết nối TCP Client mới (WROOM Offline)");
  }

  // 2. Đọc dữ liệu từ Client hiện tại
  if (_tcpClient && _tcpClient.connected()) {
    if (_tcpClient.available()) {
      String line = _tcpClient.readStringUntil('\n');
      line.trim();

      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, line);
      if (!err) {
        String senderId = doc["id"].as<String>();
        
        // Xác thực bảo mật: Chỉ nhận gói tin từ đúng node WROOM được ghép cặp
        if (_pairedSensorId.length() > 0 && senderId == _pairedSensorId) {
          lastMsgMillis = millis();

          // Trích xuất dữ liệu cảm biến để hiển thị
          if (doc.containsKey("temperature")) data.temperature = doc["temperature"].as<float>();
          if (doc.containsKey("humidity")) data.humidity = doc["humidity"].as<float>();
          if (doc.containsKey("lux")) data.lux = doc["lux"].as<float>();
          if (doc.containsKey("soil_pct")) data.soil_pct = doc["soil_pct"].as<int>();

          // Trích xuất quyết định AI và điều khiển rơ-le
          bool fan = doc["fan"].as<bool>();
          bool light = doc["light"].as<bool>();
          bool pump = doc["pump"].as<bool>();

          _relayManager->setAutoControl(fan, light, pump);

          // Chỉ áp dụng hiển thị từ AI nếu ở chế độ AUTO, các chế độ khác dùng rơ-le thực tế
          if (_relayManager->getMode() == MODE_AUTO) {
            data.fan = fan;
            data.light = light;
            data.pump = pump;
          } else {
            data.fan = _relayManager->getFanState();
            data.light = _relayManager->getLightState();
            data.pump = _relayManager->getPumpState();
          }
        } else {
          Serial.printf("[AppNetworkManager] CẢNH BÁO: Từ chối gói TCP từ node không ghép cặp: %s\n", senderId.c_str());
        }
      }
    }
  }
}

void AppNetworkManager::process(SmartFarmData& data, String& pairedSensorId, unsigned long& lastMsgMillis) {
  _wifiPortal.process();
  
  // Trả về ID ghép cặp hiện tại cho hàm vẽ màn hình hiển thị
  pairedSensorId = _pairedSensorId;

  // 1. Duy trì kết nối MQTT nếu ở chế độ kết nối WiFi
  if (WiFi.status() == WL_CONNECTED) {
    // Luôn chạy MQTT loop và đồng bộ data nếu đang connected, bất kể retry throttle
    if (_mqttClient.connected()) {
      _mqttClient.loop();
      
      // Đồng bộ dữ liệu cảm biến nhận từ MQTT sang data dùng để hiển thị OLED
      // Tách riêng khỏi connectToMqtt() để OLED luôn cập nhật kể cả khi retry đang chờ
      data.temperature = _temp;
      data.humidity = _hum;
      data.lux = _lux;
      data.soil_pct = _soilPct;
      
      // Đồng bộ trạng thái thiết bị lên màn hình theo chế độ
      if (_relayManager->getMode() == MODE_AUTO) {
        data.fan = _fanState;
        data.light = _lightState;
        data.pump = _pumpState;
      } else {
        data.fan = _relayManager->getFanState();
        data.light = _relayManager->getLightState();
        data.pump = _relayManager->getPumpState();
      }
      
      if (_lastMsgMillis > 0) {
        lastMsgMillis = _lastMsgMillis;
      }
      
      // Định kỳ gửi trạng thái rơ-le (30s một lần hoặc gửi lập tức khi thay đổi ở relay_manager)
      unsigned long now = millis();
      if (now - _lastStatePublish >= 30000UL) {
        _lastStatePublish = now;
        publishState("period", _relayManager->getFanState(), _relayManager->getLightState(), _relayManager->getPumpState());
      }
    } else {
      // Chưa connected: thử kết nối lại (có throttle 5s bên trong)
      connectToMqtt();
    }
  } else {
    // Nếu mất WiFi: Tự động bật AP dự phòng để nhận kết nối TCP từ WROOM
    if (WiFi.getMode() != WIFI_AP_STA && WiFi.getMode() != WIFI_AP) {
      Serial.println("[AppNetworkManager] Mat ket noi WiFi! Tu dong khoi dong AP du phong (SmartFarm_Fallback_AP)...");
      WiFi.mode(WIFI_AP_STA);
      WiFi.softAP(FALLBACK_AP_SSID, FALLBACK_AP_PASS);
      delay(100);
    }
  }

  // 2. Chạy máy quét kết nối TCP Server dự phòng khi offline
  processTcpServer(data, lastMsgMillis);

  // Đảm bảo ở chế độ MANUAL hoặc SCHEDULED, OLED hiển thị luôn phản ánh trạng thái thực tế của rơ-le
  if (_relayManager->getMode() != MODE_AUTO) {
    data.fan = _relayManager->getFanState();
    data.light = _relayManager->getLightState();
    data.pump = _relayManager->getPumpState();
  }
}
