# Sơ đồ Lớp (Class Diagram) — Hệ thống Smart Farm

> **Vai trò:** Database Designer  
> **Phạm vi:** Toàn bộ mã nguồn (Backend · Frontend · ESP32-WROOM · ESP32-S3)

---

## 🗄️ TẦNG 1 — Backend: MongoDB Data Models

```mermaid
classDiagram
    direction TB

    class User {
        +ObjectId _id
        +String name
        +String email
        +String passwordHash
        +String role  ~~"Farmer|Admin"~~
        +Date createdAt
        +Date updatedAt
    }

    class AuthToken {
        +ObjectId _id
        +ObjectId userId
        +String accessToken
        +String refreshToken
        +Date expiry
        +Date createdAt
        +Date updatedAt
    }

    class Device {
        +ObjectId _id
        +String name
        +String location
        +String status  ~~"online|offline"~~
        +ObjectId ownerId
        +String firmwareVersion
        +String externalId
        +String pairedSensorId
        +String opMode  ~~"manual|auto|scheduled"~~
        +Boolean autoPumpEnabled
        +Number autoPumpSoilBelow
        +Number autoPumpHysteresis
        +Boolean autoFanEnabled
        +Number autoFanTempAbove
        +Number autoFanHysteresis
        +Boolean autoLightEnabled
        +Number autoLightLuxBelow
        +Number autoLightHysteresis
        +Number minToggleIntervalSec
        +Date lastFanToggleAt
        +Date lastPumpToggleAt
        +Date lastLightToggleAt
        +String lastFanState  ~~"ON|OFF"~~
        +String lastPumpState  ~~"ON|OFF"~~
        +String lastLightState  ~~"ON|OFF"~~
        +Date lastSeenAt
        +String schedFanOn
        +String schedFanOff
        +String schedFanDays
        +String schedLightOn
        +String schedLightOff
        +String schedLightDays
        +String schedPumpOn
        +String schedPumpOff
        +String schedPumpDays
        +SafetyWindow[] safetyWindows
        +Date createdAt
    }

    class SafetyWindow {
        <<embedded>>
        +String start  ~~"HH:MM"~~
        +String end    ~~"HH:MM"~~
    }

    class SensorData {
        +ObjectId _id
        +ObjectId deviceId
        +Number temperature
        +Number humidity
        +Number soilMoisture
        +Number lux
        +Number pH
        +Date timestamp
    }

    class Command {
        +ObjectId _id
        +ObjectId deviceId
        +ObjectId userId
        +String target  ~~"fan|light|pump|main"~~
        +String action  ~~"ON|OFF"~~
        +String status  ~~"pending|executed|queued"~~
        +Date createdAt
        +Date executedAt
    }

    class Schedule {
        +ObjectId _id
        +ObjectId deviceId
        +ObjectId userId
        +String target  ~~"fan|light|pump|main"~~
        +String action  ~~"ON|OFF"~~
        +Date time
        +String repeat  ~~"daily|weekly"~~
        +Boolean active
        +Date lastRunAt
        +Date createdAt
        +Date updatedAt
    }

    class Alert {
        +ObjectId _id
        +ObjectId deviceId
        +String type  ~~"warning|error"~~
        +String message
        +Date timestamp
        +Boolean read
        +Date createdAt
        +Date updatedAt
    }

    class AlertRule {
        +ObjectId _id
        +ObjectId deviceId
        +String metric  ~~"temperature|humidity|soilMoisture|lux"~~
        +Number minThreshold
        +Number maxThreshold
        +Boolean enabled
        +String notificationType  ~~"all|email|app"~~
        +Number cooldownMinutes
        +Date lastAlertTime
        +Date createdAt
        +Date updatedAt
    }

    class SystemLog {
        +ObjectId _id
        +String actor  ~~"User|Admin|Device"~~
        +String action
        +String details
        +Date timestamp
        +Date createdAt
        +Date updatedAt
    }

    %% Relationships
    User "1" --> "0..*" AuthToken : has
    User "1" --> "0..*" Device : owns
    Device "1" --> "0..*" SensorData : generates
    Device "1" --> "0..*" Command : receives
    Device "1" --> "0..*" Schedule : has
    Device "1" --> "0..*" Alert : triggers
    Device "1" --> "0..*" AlertRule : configures
    Device "1" *-- "0..*" SafetyWindow : embeds
    User "1" --> "0..*" Command : issues
    User "1" --> "0..*" Schedule : creates
```

---

## ⚙️ TẦNG 2 — Backend: Services & Integrations (Node.js)

```mermaid
classDiagram
    direction LR

    class ExpressApp {
        <<singleton>>
        +Set sseClients
        +pushTelemetry(externalId, payload) void
        +pushDeviceStatus(externalId, status) void
        +use(middleware) void
        +get(path, handler) void
        +post(path, handler) void
    }

    class MqttIntegration {
        <<singleton>>
        +publishControl(deviceId, target, action, cmd) void
        +publishConfig(deviceId, configObj) void
        -initMqtt(app) MqttApi
        -client: MqttClient
        -appRef: ExpressApp
    }

    class AlertService {
        <<service>>
        +checkAlertRules(deviceId, sensorData) Promise~void~
    }

    class EmailService {
        <<service>>
        +sendAlertEmail(email, deviceName, message, type) Promise~void~
    }

    class SchedulerService {
        <<service>>
        +initScheduler(publishControl, intervalMs) void
        -tick(publishControl) Promise~void~
        -sameMinute(a, b) Boolean
        -matches(now, when, repeat) Boolean
        -timer: NodeTimer
    }

    class PresenceService {
        <<service>>
        +startPresenceChecker(interval) void
        -markOfflineDevices() Promise~void~
    }

    class AuthController {
        +login(req, res) void
        +register(req, res) void
        +refresh(req, res) void
        +logout(req, res) void
    }

    class DeviceController {
        +list(req, res) void
        +create(req, res) void
        +getOne(req, res) void
        +update(req, res) void
        +remove(req, res) void
        +pairSensor(req, res) void
        +updateConfig(req, res) void
    }

    class CommandController {
        +create(req, res) void
        +list(req, res) void
        +nextForDevice(req, res) void
        +updateStatus(req, res) void
    }

    class SensorController {
        +list(req, res) void
        +latest(req, res) void
    }

    class ScheduleController {
        +create(req, res) void
        +list(req, res) void
        +update(req, res) void
        +remove(req, res) void
    }

    class AlertController {
        +list(req, res) void
        +markRead(req, res) void
    }

    class AlertRuleController {
        +create(req, res) void
        +list(req, res) void
        +update(req, res) void
        +remove(req, res) void
    }

    class AuthMiddleware {
        <<middleware>>
        +authenticate(req, res, next) void
    }

    class JwtUtil {
        <<utility>>
        +signAccessToken(payload) String
        +signRefreshToken(payload) String
        +verifyAccessToken(token) Object
        +verifyRefreshToken(token) Object
    }

    class CheckDeviceAccess {
        <<utility>>
        +checkDeviceAccess(deviceId, user) Promise~Device~
    }

    %% Dependencies
    CommandController --> MqttIntegration : publishControl()
    CommandController --> CheckDeviceAccess : uses
    DeviceController --> MqttIntegration : publishConfig()
    MqttIntegration --> AlertService : checkAlertRules()
    MqttIntegration --> ExpressApp : pushTelemetry()
    AlertService --> EmailService : sendAlertEmail()
    SchedulerService --> MqttIntegration : publishControl()
    AuthController --> JwtUtil : sign/verify
    AuthMiddleware --> JwtUtil : verifyAccessToken()
```

---

## 🖥️ TẦNG 3 — Frontend: React Components (Dashboard)

```mermaid
classDiagram
    direction TB

    class AuthContext {
        <<Context>>
        +Object user
        +String accessToken
        +login(email, password) Promise
        +logout() void
        +register(name, email, password) Promise
    }

    class ApiClient {
        <<singleton>>
        +baseURL: String
        +get(path, params) Promise
        +post(path, data) Promise
        +put(path, data) Promise
        +delete(path) Promise
        -interceptors: AxiosInterceptors
    }

    class App {
        <<Router>>
        +routes: Route[]
        -useAuthContext() AuthContext
    }

    class LoginPage {
        -email: String
        -password: String
        +handleSubmit() void
    }

    class RegisterPage {
        -name: String
        -email: String
        -password: String
        +handleSubmit() void
    }

    class DevicesPage {
        -devices: Device[]
        -sseStreams: Map
        -liveData: Map
        +fetchDevices() void
        +sendCommand(deviceId, target, action) void
        +openSSEStream(externalId) EventSource
    }

    class DeviceDetailPage {
        -device: Device
        -activeTab: String
        -liveData: Object
        +fetchDevice() void
        +sendCommand(target, action) void
    }

    class CreateDevicePage {
        -name: String
        -location: String
        +handleSubmit() void
    }

    class SettingsPage {
        -user: User
        -alertRules: AlertRule[]
        +saveProfile() void
        +saveAlertRules() void
    }

    class OverviewTab {
        +device: Device
        +liveData: Object
        -sensorHistory: SensorData[]
    }

    class ControlTab {
        +device: Device
        +liveData: Object
        +sendCommand(target, action) void
        -schedules: Schedule[]
    }

    class AnalyticsTab {
        +device: Device
        -sensorHistory: SensorData[]
        -timeRange: String
    }

    class AutomationPanel {
        +device: Device
        +onSave(config) void
        -thresholds: Object
    }

    class SchedulesPanel {
        +device: Device
        -schedules: Schedule[]
        +createSchedule(data) void
        +deleteSchedule(id) void
    }

    class DeviceSettingsPanel {
        +device: Device
        +onSave(config) void
        -safetyWindows: SafetyWindow[]
    }

    class PairingPanel {
        +device: Device
        +onPair(sensorId) void
    }

    class ControlBox {
        +label: String
        +state: Boolean
        +onToggle(action) void
        -loading: Boolean
    }

    class RealtimeDeviceCard {
        +device: Device
        +liveData: Object
        +onControl(target, action) void
    }

    class MetricChart {
        +data: SensorData[]
        +metric: String
        +timeRange: String
    }

    class AiTab {
        +device: Device
        -aiRecommendation: Object
    }

    class MapTab {
        +devices: Device[]
    }

    class Tabs {
        +tabs: String[]
        +activeTab: String
        +onChange(tab) void
    }

    class UserProfile {
        -user: User
        +onSave(data) void
    }

    class DeviceEditModal {
        +device: Device
        +onSave(data) void
        +onClose() void
    }

    %% Relationships
    App --> AuthContext : provides
    App --> LoginPage : routes
    App --> RegisterPage : routes
    App --> DevicesPage : routes
    App --> DeviceDetailPage : routes
    App --> CreateDevicePage : routes
    App --> SettingsPage : routes

    DevicesPage --> RealtimeDeviceCard : renders
    DevicesPage --> ApiClient : calls
    DeviceDetailPage --> OverviewTab : renders
    DeviceDetailPage --> ControlTab : renders
    DeviceDetailPage --> AnalyticsTab : renders
    DeviceDetailPage --> AiTab : renders
    DeviceDetailPage --> MapTab : renders
    DeviceDetailPage --> Tabs : uses
    DeviceDetailPage --> ApiClient : calls

    ControlTab --> ControlBox : renders
    ControlTab --> AutomationPanel : renders
    ControlTab --> SchedulesPanel : renders
    ControlTab --> DeviceSettingsPanel : renders
    ControlTab --> PairingPanel : renders
    AnalyticsTab --> MetricChart : renders
    SettingsPage --> UserProfile : renders
    DevicesPage --> DeviceEditModal : uses
    AuthContext --> ApiClient : uses
```

---

## 🔌 TẦNG 4 — Firmware ESP32-WROOM (Sensor + TinyML Node)

```mermaid
classDiagram
    direction TB

    class SmartFarmData {
        <<struct>>
        +float temperature
        +float humidity
        +float lux
        +int soil_pct
        +bool fan
        +bool light
        +bool pump
    }

    class WifiConfigPortal {
        -String _nsName
        -String _apSSID
        -String _apPass
        -String _apTitle
        +begin() void
        +process() void
        +ssid() String
        +isPortalActive() bool
    }

    class SensorManager {
        -Adafruit_AHTX0 _aht
        -Adafruit_BMP280 _bmp
        -BH1750 _lightMeter
        -bool _ahtPresent
        -bool _bmpPresent
        -bool _bhPresent
        +SensorManager()
        +begin() void
        +read(data) bool
        -readSoilRaw() int
        -soilPercentFromRaw(raw) int
    }

    class TinyMLManager {
        -bool _initialized
        -MicroErrorReporter _microErrorReporter
        -ErrorReporter* _errorReporter
        -Model* _tfliteModel
        -MicroInterpreter* _interpreter
        -uint8_t _tensorArena[8192]
        +TinyMLManager()
        +begin() bool
        +runInference(data) bool
        -normalizeRange(value, min, max) float
        -quantizeInt8(value, tensor) int8_t
        -quantizeUInt8(value, tensor) uint8_t
        -dequantizeValue(value, tensor) float
    }

    class AppNetworkManager_WROOM {
        <<AppNetworkManager>>
        -WifiConfigPortal _wifiPortal
        -WiFiClient _espClient
        -PubSubClient _mqttClient
        -WiFiClient _tcpClient
        -NetworkState _state
        -String _deviceId
        -unsigned long _lastMqttRetry
        -unsigned long _lastTcpRetry
        -unsigned long _lastPublish
        -bool _offlineTimeRecorded
        +AppNetworkManager(portal)
        +begin(deviceId) void
        +process(data) void
        +getState() NetworkState
        +isMqttConnected() bool
        -connectToMqtt() bool
        -connectToTcpServer() bool
        -publishMqtt(data) void
        -sendTcp(data) void
        -handleNormalWifiState(data) void
        -handleFallbackWifiState(data) void
        -handleFullFailureState(data) void
        -tryHomeWifiReconnect() void
        -resetWifiStack() void
    }

    class NetworkState_WROOM {
        <<enumeration>>
        STATE_INIT
        STATE_NORMAL_WIFI
        STATE_FALLBACK_WIFI
        STATE_FULL_FAILURE
    }

    class MainSketch_WROOM {
        <<sketch>>
        -WifiConfigPortal wifiPortal
        -SensorManager sensorManager
        -TinyMLManager tinymlManager
        -AppNetworkManager networkManager
        -SmartFarmData sharedData
        -String deviceId
        +setup() void
        +loop() void
        -getMacId() String
        -setWifiLed(on) void
    }

    %% Relationships
    MainSketch_WROOM *-- WifiConfigPortal : has
    MainSketch_WROOM *-- SensorManager : has
    MainSketch_WROOM *-- TinyMLManager : has
    MainSketch_WROOM *-- AppNetworkManager_WROOM : has
    MainSketch_WROOM *-- SmartFarmData : has
    AppNetworkManager_WROOM o-- WifiConfigPortal : ref
    AppNetworkManager_WROOM --> NetworkState_WROOM : uses
    SensorManager --> SmartFarmData : writes
    TinyMLManager --> SmartFarmData : reads & writes
    AppNetworkManager_WROOM --> SmartFarmData : reads
```

---

## 🤖 TẦNG 5 — Firmware ESP32-S3 (Controller + MQTT + OLED)

```mermaid
classDiagram
    direction TB

    class OperationalMode {
        <<enumeration>>
        MODE_MANUAL
        MODE_AUTO
        MODE_SCHEDULED
    }

    class DisplayNetworkMode {
        <<enumeration>>
        DISP_NET_DISCONNECTED
        DISP_NET_MQTT
        DISP_NET_TCP
    }

    class RelayStateChangedCallback {
        <<typedef>>
        +void operator()(target, state, reason)
    }

    class RelayManager {
        -bool _fanState
        -bool _lightState
        -bool _pumpState
        -unsigned long _overrideFanUntil
        -unsigned long _overrideLightUntil
        -unsigned long _overridePumpUntil
        -OperationalMode _opMode
        -unsigned long _fanBtnPressStart
        -unsigned long _lightBtnPressStart
        -unsigned long _pumpBtnPressStart
        -unsigned long _modeBtnPressStart
        -unsigned long _lastRelayToggleTime
        -RelayStateChangedCallback _onStateChanged
        +RelayManager()
        +begin(callback) void
        +process() void
        +setManualControl(target, on, reason) void
        +clearOverrides() void
        +setAutoControl(fanOn, lightOn, pumpOn) void
        +getMode() OperationalMode
        +setMode(mode) void
        +getFanState() bool
        +getLightState() bool
        +getPumpState() bool
        +isFanOverridden() bool
        +isLightOverridden() bool
        +isPumpOverridden() bool
        -applyRelay(pin, state) void
        -triggerStateChange(target, state, reason) void
    }

    class DisplayManager {
        -Adafruit_SSD1306 _display
        +DisplayManager()
        +begin() bool
        +update(data, netMode, pairedSensorId, lastMsgMillis, portalIp, opMode) void
        -drawWifiBars(connected, rssi) void
        -printTruncated(txt, x, y, maxWidth) void
    }

    class AppNetworkManager_S3 {
        <<AppNetworkManager>>
        -WifiConfigPortal _wifiPortal
        -WiFiClient _espClient
        -PubSubClient _mqttClient
        -WiFiServer _tcpServer
        -WiFiClient _tcpClient
        -RelayManager* _relayManager
        -String _deviceId
        -String _pairedSensorId
        -String _activeTelemetryTopic
        -String _activeStateTopic
        -String _activeControlTopic
        -float _temp, _hum, _lux
        -int _soilPct
        -bool _fanState, _lightState, _pumpState
        +AppNetworkManager(portal)
        +begin(deviceId, relayManager) void
        +process(data, pairedSensorId, lastMsgMillis) void
        +publishState(reason, fan, light, pump) void
        +isConnected() bool
        +isMqttConnected() bool
        -connectToMqtt() bool
        -handleMqttMessage(topic, payload, length) void
        -updateSubscriptions(newPairedId) void
        -processTcpServer(data, lastMsgMillis) void
    }

    class MainSketch_S3 {
        <<sketch>>
        -WifiConfigPortal wifiPortal
        -RelayManager relayManager
        -DisplayManager displayManager
        -AppNetworkManager networkManager
        -SmartFarmData sharedData
        -String deviceId
        -String pairedSensorId
        +setup() void
        +loop() void
        -onRelayStateChanged(target, state, reason) void
    }

    %% Relationships
    MainSketch_S3 *-- WifiConfigPortal : has
    MainSketch_S3 *-- RelayManager : has
    MainSketch_S3 *-- DisplayManager : has
    MainSketch_S3 *-- AppNetworkManager_S3 : has
    MainSketch_S3 *-- SmartFarmData : has
    AppNetworkManager_S3 o-- WifiConfigPortal : ref
    AppNetworkManager_S3 o-- RelayManager : controls
    AppNetworkManager_S3 --> SmartFarmData : reads & writes
    RelayManager --> OperationalMode : uses
    RelayManager --> RelayStateChangedCallback : callback
    DisplayManager --> DisplayNetworkMode : uses
    DisplayManager --> SmartFarmData : reads
    DisplayManager --> OperationalMode : displays
```

---

## 🔗 TẦNG 6 — Sơ đồ Quan hệ Toàn hệ thống

```mermaid
classDiagram
    direction TB

    class ReactDashboard {
        <<Frontend Layer>>
        +Pages: 6 pages
        +Components: 15 components
        +ApiClient: axios
        +SSE: EventSource
    }

    class NodejsServer {
        <<Backend Layer>>
        +Routes: 9 routers
        +Controllers: 9 controllers
        +Services: alertService, scheduler
        +Middleware: auth, validate, error
        +SSE: push helpers
    }

    class MongoDatabase {
        <<Data Layer>>
        +Collections: User, Device,
        +SensorData, Command,
        +Schedule, Alert,
        +AlertRule, AuthToken, SystemLog
    }

    class MQTTBroker {
        <<Message Broker>>
        +Protocol: MQTT v3.1.1
        +QoS: 1 (at-least-once)
        +Topics: farm/+ / sensors/+ / controllers/+
    }

    class ESP32_WROOM {
        <<Sensor Node>>
        +SensorManager: DHT/AHT, BMP, BH1750
        +TinyMLManager: TensorFlow Lite Micro
        +AppNetworkManager: MQTT + TCP Client
        +WifiConfigPortal: Captive Portal
    }

    class ESP32_S3 {
        <<Controller Node>>
        +RelayManager: Fan, Pump, Light
        +DisplayManager: SSD1306 OLED
        +AppNetworkManager: MQTT + TCP Server
        +WifiConfigPortal: Captive Portal
    }

    ReactDashboard --> NodejsServer : REST API (JWT Bearer)
    ReactDashboard --> NodejsServer : SSE /api/stream/devices/:id
    NodejsServer --> MongoDatabase : Mongoose ODM
    NodejsServer --> MQTTBroker : PUBLISH control commands
    MQTTBroker --> NodejsServer : SUBSCRIBE telemetry / state / ack
    MQTTBroker --> ESP32_S3 : DELIVER control commands (QoS=1)
    MQTTBroker --> ESP32_WROOM : DELIVER state feedback
    ESP32_WROOM --> MQTTBroker : PUBLISH telemetry + ai_state
    ESP32_S3 --> MQTTBroker : PUBLISH state + cmd/ack
    ESP32_WROOM --> ESP32_S3 : TCP fallback (SoftAP 192.168.4.1:8080)
```

---

## 📋 Bảng Tổng Hợp Classes / Entities

| Layer | Class/Entity | Loại | Trách nhiệm chính |
|---|---|---|---|
| **DB Model** | `User` | Mongoose Schema | Quản lý tài khoản người dùng |
| **DB Model** | `Device` | Mongoose Schema | Cấu hình & trạng thái thiết bị IoT |
| **DB Model** | `SensorData` | Mongoose Schema | Lưu trữ lịch sử đo lường |
| **DB Model** | `Command` | Mongoose Schema | Lệnh điều khiển từ User/Scheduler |
| **DB Model** | `Schedule` | Mongoose Schema | Lịch trình tự động hóa |
| **DB Model** | `Alert` | Mongoose Schema | Cảnh báo được kích hoạt |
| **DB Model** | `AlertRule` | Mongoose Schema | Ngưỡng kích hoạt cảnh báo |
| **DB Model** | `AuthToken` | Mongoose Schema | JWT access/refresh token |
| **DB Model** | `SystemLog` | Mongoose Schema | Nhật ký hành động hệ thống |
| **Service** | `AlertService` | Singleton | Kiểm tra ngưỡng, tạo alert, gửi email |
| **Service** | `SchedulerService` | Singleton | Chạy lịch tự động (mỗi 30s) |
| **Service** | `EmailService` | Singleton | Gửi email thông báo qua SMTP |
| **Service** | `PresenceService` | Singleton | Đánh dấu thiết bị offline |
| **Integration** | `MqttIntegration` | Singleton | Pub/Sub MQTT Broker |
| **Infra** | `ExpressApp` | Singleton | HTTP Server + SSE |
| **Frontend** | `AuthContext` | React Context | Quản lý phiên đăng nhập |
| **Frontend** | `ApiClient` | axios | HTTP client với JWT interceptor |
| **Frontend** | `DevicesPage` | React Page | Danh sách thiết bị + SSE streams |
| **Frontend** | `DeviceDetailPage` | React Page | Chi tiết thiết bị (multi-tab) |
| **ESP32 WROOM** | `SensorManager` | C++ Class | Đọc cảm biến AHT/BMP/BH1750/Soil |
| **ESP32 WROOM** | `TinyMLManager` | C++ Class | Suy luận TensorFlow Lite Micro |
| **ESP32 WROOM** | `AppNetworkManager` | C++ Class | Quản lý MQTT + TCP Client + WiFi FSM |
| **ESP32 S3** | `RelayManager` | C++ Class | Điều khiển relay Fan/Pump/Light |
| **ESP32 S3** | `DisplayManager` | C++ Class | Hiển thị OLED SSD1306 |
| **ESP32 S3** | `AppNetworkManager` | C++ Class | MQTT + TCP Server + WiFi |
| **Shared** | `SmartFarmData` | C++ Struct | Giao thức dữ liệu dùng chung |
| **Shared** | `WifiConfigPortal` | C++ Class | Captive portal cấu hình WiFi |
