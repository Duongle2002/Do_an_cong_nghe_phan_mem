#pragma once

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "relay_manager.h"
#include "../common/shared_protocol.h"
#include "../common/wifi_config_portal.h"

class AppNetworkManager {
public:
  AppNetworkManager(WifiConfigPortal& portal);
  void begin(const String& deviceId, RelayManager* relayManager);
  void process(SmartFarmData& data, String& pairedSensorId, unsigned long& lastMsgMillis);
  
  // Gửi trạng thái rơ-le lên MQTT Broker
  void publishState(const char* reason, bool fan, bool light, bool pump);
  bool isConnected() const { return WiFi.status() == WL_CONNECTED; }
  bool isMqttConnected() { return _mqttClient.connected(); }

private:
  WifiConfigPortal& _wifiPortal;
  WiFiClient _espClient;
  PubSubClient _mqttClient;
  WiFiServer _tcpServer;
  WiFiClient _tcpClient; // Quản lý kết nối Client hiện tại

  RelayManager* _relayManager = nullptr;
  String _deviceId;
  String _pairedSensorId;
  
  unsigned long _lastMqttRetry = 0;
  unsigned long _lastStatePublish = 0;
  
  // Lưu giữ danh sách topic đã subscribe để huỷ đăng ký khi thay đổi pairing
  String _activeTelemetryTopic;
  String _activeStateTopic;
  String _activeControlTopic;

  // Cac bien cache du lieu nhan tu MQTT de hien thi len OLED
  float _temp = NAN;
  float _hum = NAN;
  float _lux = NAN;
  int _soilPct = -1;
  bool _fanState = false;
  bool _lightState = false;
  bool _pumpState = false;
  unsigned long _lastMsgMillis = 0;

  void handleMqttMessage(char* topic, byte* payload, unsigned int length);
  bool connectToMqtt();
  void updateSubscriptions(const String& newPairedId);
  void processTcpServer(SmartFarmData& data, unsigned long& lastMsgMillis);
};
