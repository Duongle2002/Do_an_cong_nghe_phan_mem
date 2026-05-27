#pragma once

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "../common/shared_protocol.h"
#include "../common/wifi_config_portal.h"

enum NetworkState {
  STATE_INIT,
  STATE_NORMAL_WIFI,
  STATE_FALLBACK_WIFI,
  STATE_FULL_FAILURE
};

class AppNetworkManager {
public:
  AppNetworkManager(WifiConfigPortal& portal);
  void begin(const String& deviceId);
  void process(SmartFarmData& data);
  NetworkState getState() const { return _state; }
  bool isMqttConnected() { return _mqttClient.connected(); }

private:
  WifiConfigPortal& _wifiPortal;
  WiFiClient _espClient;
  PubSubClient _mqttClient;
  WiFiClient _tcpClient;

  NetworkState _state = STATE_INIT;
  String _deviceId;
  
  // Variables for tracking times non-blockingly
  unsigned long _lastMqttRetry = 0;
  unsigned long _lastTcpRetry = 0;
  unsigned long _lastPublish = 0;
  unsigned long _lastWifiCheck = 0;
  unsigned long _lastHomeWifiRetry = 0;
  unsigned long _offlineDetectedTime = 0;
  bool _offlineTimeRecorded = false;
  unsigned long _lastFallbackWifiRetry = 0;

  void handleNormalWifiState(SmartFarmData& data);
  void handleFallbackWifiState(SmartFarmData& data);
  void handleFullFailureState(SmartFarmData& data);

  bool connectToMqtt();
  bool connectToTcpServer();
  void tryHomeWifiReconnect();
  void resetWifiStack();
  
  void publishMqtt(const SmartFarmData& data);
  void sendTcp(const SmartFarmData& data);
};
