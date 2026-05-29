# Sơ đồ Tuần tự: Gửi Lệnh Điều Khiển từ Web/Mobile → MQTT Broker → ESP32

> **Vai trò:** Database Designer  
> **Chức năng:** Gửi lệnh điều khiển thiết bị (Fan / Pump / Light) từ giao diện người dùng tới ESP32 qua hệ thống MQTT.

---

## 🗂️ Các Thành Phần Tham Gia (Actors & Components)

| Ký hiệu | Mô tả | Công nghệ |
|---|---|---|
| **User** | Người dùng thao tác trên giao diện | - |
| **Web/Mobile** | Giao diện React Dashboard | React + Vite |
| **Node.js Server** | Backend xử lý API & publish MQTT | Express.js |
| **MongoDB** | Cơ sở dữ liệu lưu lệnh & trạng thái | MongoDB / Mongoose |
| **MQTT Broker** | Trung gian nhắn tin pub/sub | EMQX / Mosquitto |
| **ESP32-S3** | Bộ điều khiển relay chính | Arduino/ESP-IDF |
| **ESP32-WROOM** | Node cảm biến + TinyML | Arduino |

---

## 📊 Sơ đồ Tuần tự — Luồng Chính (Happy Path)

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant WebMobile as 🖥️ Web / Mobile<br/>(React Dashboard)
    participant Server as ⚙️ Node.js Server<br/>(Express API)
    participant MongoDB as 🗄️ MongoDB
    participant MQTTBroker as 📡 MQTT Broker<br/>(EMQX/Mosquitto)
    participant ESP32S3 as 🤖 ESP32-S3<br/>(Controller)

    rect rgb(230, 245, 255)
        Note over User, WebMobile: ① Người dùng ra lệnh từ giao diện
        User->>WebMobile: Nhấn nút "BẬT Máy Bơm"
        WebMobile->>WebMobile: Lấy JWT Token từ localStorage
    end

    rect rgb(255, 248, 220)
        Note over WebMobile, MongoDB: ② Gửi lệnh tới Backend & Lưu vào DB
        WebMobile->>+Server: POST /api/commands<br/>{ deviceId, target:"pump", action:"ON" }<br/>Header: Authorization: Bearer <JWT>
        Server->>Server: Middleware authenticate()<br/>Xác thực JWT Token
        Server->>MongoDB: checkDeviceAccess(deviceId, user)<br/>Kiểm tra quyền truy cập thiết bị
        MongoDB-->>Server: Device document { externalId, ownerId, ... }
        Server->>MongoDB: Command.create({ deviceId, userId, target:"pump",<br/> action:"ON", status:"pending" })
        MongoDB-->>Server: Command document { _id, status:"pending" }
        Server->>MongoDB: Device.findByIdAndUpdate()<br/>Cập nhật lastPumpState="ON" ngay lập tức<br/>(Chống race condition với AI)
        MongoDB-->>Server: ✅ Updated
    end

    rect rgb(240, 255, 240)
        Note over Server, MQTTBroker: ③ Server publish lệnh lên MQTT Broker
        Server->>+MQTTBroker: PUBLISH farm/{externalId}/control/pump "ON"<br/>QoS=1, retain=false
        Note right of MQTTBroker: Topic mới: farm/{id}/control/{target}
        Server->>MQTTBroker: PUBLISH controllers/{externalId}/control/pump "ON"<br/>QoS=1, retain=false
        Note right of MQTTBroker: Topic cũ: tương thích ngược
        MQTTBroker-->>-Server: PUBACK ✅
        Server-->>-WebMobile: HTTP 201 Created<br/>{ _id, status:"pending", target:"pump", action:"ON" }
        WebMobile->>WebMobile: Cập nhật UI: Hiển thị trạng thái "pending"
    end

    rect rgb(255, 240, 245)
        Note over MQTTBroker, ESP32S3: ④ MQTT Broker giao lệnh tới ESP32-S3
        MQTTBroker->>+ESP32S3: DELIVER farm/{externalId}/control/pump "ON"<br/>(ESP32-S3 đã subscribe topic này)
        ESP32S3->>ESP32S3: mqttCallback() xử lý message<br/>Parse topic & payload
        ESP32S3->>ESP32S3: Kích hoạt Relay Pump<br/>digitalWrite(RELAY_PIN, HIGH)
        ESP32S3->>ESP32S3: Cập nhật local state: pumpState = true
    end

    rect rgb(245, 240, 255)
        Note over ESP32S3, MQTTBroker: ⑤ ESP32-S3 gửi ACK xác nhận thực thi
        ESP32S3->>MQTTBroker: PUBLISH devices/{externalId}/cmd/ack<br/>{ "id": "<commandId>", "status":"executed",<br/>  "executedAt": "<ISO8601>" }
        MQTTBroker->>Server: DELIVER devices/{externalId}/cmd/ack
        Server->>MongoDB: Command.findByIdAndUpdate(ack.id,<br/>{ status:"executed", executedAt })
        MongoDB-->>Server: ✅ Updated
        Note right of Server: Broker cũng gửi state report
        ESP32S3->>MQTTBroker: PUBLISH farm/{externalId}/state<br/>{ fan:false, pump:true, light:false, opMode:"manual" }
        MQTTBroker->>Server: DELIVER farm/{externalId}/state
        Server->>MongoDB: Device.findByIdAndUpdate()<br/>Cập nhật lastPumpState, lastSeenAt
    end

    rect rgb(255, 245, 230)
        Note over Server, WebMobile: ⑥ Server đẩy cập nhật real-time về Web/Mobile qua SSE
        Server->>WebMobile: SSE Event: pushTelemetry(externalId, payload)<br/>{ relayPump:"ON", status:"online", ... }
        WebMobile->>WebMobile: Nhận SSE event<br/>Cập nhật UI: Relay Pump = 🟢 ON
        WebMobile->>User: Hiển thị: "Máy bơm đang BẬT ✅"
    end
```

---

## 📊 Sơ đồ Tuần tự — Luồng Lỗi & Edge Cases

```mermaid
sequenceDiagram
    autonumber

    actor User as 👤 User
    participant WebMobile as 🖥️ Web / Mobile
    participant Server as ⚙️ Node.js Server
    participant MongoDB as 🗄️ MongoDB
    participant MQTTBroker as 📡 MQTT Broker
    participant ESP32S3 as 🤖 ESP32-S3

    rect rgb(255, 235, 235)
        Note over User, MongoDB: ❌ Case 1: Không có quyền điều khiển thiết bị
        User->>WebMobile: Nhấn điều khiển thiết bị của người dùng khác
        WebMobile->>Server: POST /api/commands { deviceId, target, action }
        Server->>MongoDB: checkDeviceAccess(deviceId, user)
        MongoDB-->>Server: ownerId ≠ user.id → FORBIDDEN
        Server-->>WebMobile: HTTP 403 Forbidden<br/>{ message: "Forbidden" }
        WebMobile->>User: Hiển thị thông báo lỗi ❌
    end

    rect rgb(255, 235, 235)
        Note over Server, MQTTBroker: ❌ Case 2: MQTT Broker mất kết nối
        Server->>MQTTBroker: PUBLISH farm/{id}/control/pump "ON"
        Note right of Server: mqtt.publishControl() bị bỏ qua<br/>nếu !client.connected()
        Server->>MongoDB: Command đã lưu với status="pending"
        Note over MongoDB: Command ở trạng thái "pending"<br/>chờ ESP32 poll hoặc broker khôi phục
        Note over Server: reconnectPeriod=2000ms<br/>Server tự tái kết nối MQTT
    end

    rect rgb(255, 235, 235)
        Note over MQTTBroker, ESP32S3: ❌ Case 3: ESP32 mất kết nối WiFi/MQTT
        MQTTBroker->>ESP32S3: DELIVER (QoS=1) — Không nhận được PUBACK
        Note right of MQTTBroker: Broker giữ message trong hàng đợi<br/>(QoS=1 đảm bảo at-least-once)
        ESP32S3->>ESP32S3: connectToMqtt() retry mỗi 5 giây
        ESP32S3->>MQTTBroker: CONNECT (Reconnect)
        MQTTBroker->>ESP32S3: DELIVER lại message đã queue
        ESP32S3->>ESP32S3: Thực thi lệnh
    end

    rect rgb(255, 248, 215)
        Note over Server, ESP32S3: ⚠️ Case 4: Safety Window — Chế độ AUTO
        Note over Server: WROOM gửi AI State: pump=true<br/>farm/{wroom-id}/ai_state
        MQTTBroker->>Server: DELIVER farm/{wroom-id}/ai_state { pump:true }
        Server->>MongoDB: Kiểm tra s3Controller.opMode & safetyWindows
        MongoDB-->>Server: opMode="auto", safetyWindows=[{start:"17:00", end:"18:00"}]
        Server->>Server: Kiểm tra giờ hiện tại:<br/>currentHHMM nằm ngoài khung an toàn
        Server->>MQTTBroker: PUBLISH farm/{wroom-id}/state { pump:false }<br/>(Ghi đè AI quyết định — bơm bị chặn)
        MQTTBroker->>ESP32S3: DELIVER farm/{wroom-id}/state { pump:false }
        ESP32S3->>ESP32S3: Relay Pump = OFF (tuân theo lệnh server)
    end
```

---

## 🔄 Luồng Ngược: ESP32-WROOM gửi AI State (TinyML)

```mermaid
sequenceDiagram
    autonumber

    participant ESP32WROOM as 🧠 ESP32-WROOM<br/>(TinyML Node)
    participant MQTTBroker as 📡 MQTT Broker
    participant Server as ⚙️ Node.js Server
    participant MongoDB as 🗄️ MongoDB
    participant WebMobile as 🖥️ Web / Mobile

    Note over ESP32WROOM: TinyML inference chạy on-device<br/>Quyết định: pump=true, fan=false

    ESP32WROOM->>MQTTBroker: PUBLISH farm/{wroom-id}/telemetry<br/>{ temperature, humidity, soil_pct, lux }
    ESP32WROOM->>MQTTBroker: PUBLISH farm/{wroom-id}/ai_state<br/>{ fan:false, pump:true, light:false }

    MQTTBroker->>Server: DELIVER farm/{wroom-id}/telemetry
    Server->>MongoDB: SensorData.create({ deviceId, temperature, humidity, ... })
    Server->>MongoDB: Device.findByIdAndUpdate() → status="online"

    MQTTBroker->>Server: DELIVER farm/{wroom-id}/ai_state
    Server->>MongoDB: Device.findOne({ pairedSensorId: wroom-id })<br/>Tìm ESP32-S3 điều khiển đã ghép cặp
    MongoDB-->>Server: s3Controller { opMode, safetyWindows, lastPumpState }

    alt opMode = "auto" & trong khung an toàn
        Server->>MQTTBroker: PUBLISH farm/{wroom-id}/state { pump:true }
    else opMode = "manual" hoặc ngoài khung an toàn
        Server->>MQTTBroker: PUBLISH farm/{wroom-id}/state<br/>{ pump: s3Controller.lastPumpState }
    end

    MQTTBroker->>ESP32WROOM: DELIVER farm/{wroom-id}/state (lệnh relay cuối cùng)

    Server->>WebMobile: SSE pushTelemetry(wroom-id, { relayPump, ... })
    WebMobile->>WebMobile: Cập nhật Dashboard real-time
```

---

## 📋 Bảng Tổng Hợp MQTT Topics

| Topic Pattern | Hướng | QoS | Retain | Mô tả |
|---|---|---|---|---|
| `farm/{deviceId}/control/{target}` | Server → ESP32 | 1 | false | Lệnh điều khiển relay (mới) |
| `controllers/{deviceId}/control/{target}` | Server → ESP32 | 1 | false | Lệnh điều khiển relay (cũ, tương thích ngược) |
| `farm/{deviceId}/telemetry` | ESP32 → Server | 1 | false | Dữ liệu cảm biến từ WROOM |
| `farm/{deviceId}/state` | Server → ESP32 | 1 | false | Trạng thái relay đã duyệt |
| `farm/{deviceId}/ai_state` | WROOM → Server | 1 | false | Quyết định AI từ TinyML |
| `farm/{deviceId}/config` | Server → ESP32 | 1 | **true** | Cấu hình retained cho S3 |
| `devices/{deviceId}/cmd/ack` | ESP32 → Server | 1 | false | Xác nhận thực thi lệnh |
| `sensors/{deviceId}/data` | ESP32 → Server | 1 | false | Telemetry (topic cũ) |
| `sensors/{deviceId}/status` | ESP32 → Server | 1 | false | Online/Offline status |
| `controllers/{deviceId}/state` | ESP32 → Server | 1 | false | Trạng thái relay (topic cũ) |

---

## 🗃️ Schema Collection Liên Quan

### Collection `commands`
```json
{
  "_id": "ObjectId",
  "deviceId": "ObjectId (ref: devices)",
  "userId": "ObjectId (ref: users)",
  "target": "fan | light | pump | main",
  "action": "ON | OFF",
  "status": "pending | executed | queued",
  "executedAt": "Date (nullable)",
  "createdAt": "Date"
}
```

### Collection `devices` (trường liên quan đến control)
```json
{
  "_id": "ObjectId",
  "externalId": "String (MQTT device ID)",
  "pairedSensorId": "String (WROOM node ID)",
  "opMode": "manual | auto | scheduled",
  "lastFanState": "ON | OFF",
  "lastPumpState": "ON | OFF",
  "lastLightState": "ON | OFF",
  "lastFanToggleAt": "Date",
  "lastPumpToggleAt": "Date",
  "lastLightToggleAt": "Date",
  "safetyWindows": [{ "start": "HH:MM", "end": "HH:MM" }],
  "status": "online | offline",
  "lastSeenAt": "Date"
}
```

---

## 🔐 Cơ Chế Bảo Mật

```
Web/Mobile ──── JWT Token ────► Node.js Server
                                     │
                                 authenticate()
                                     │
                              checkDeviceAccess()
                                     │
                          ownerId == user.id? ──── ❌ 403 Forbidden
                                     │ ✅
                              Tiếp tục luồng
```

---

## ✅ Tổng Kết Luồng Chính

```
User → Web/Mobile → POST /api/commands (JWT)
     → Server authenticate & checkDeviceAccess
     → MongoDB: Command.create (status: pending)
     → MongoDB: Device.update (lastPumpState ngay lập tức)
     → MQTT Publish: farm/{id}/control/pump "ON" (QoS=1)
     → HTTP 201 trả về ngay
     → MQTT Broker deliver tới ESP32-S3
     → ESP32-S3: kích hoạt relay
     → ESP32-S3: PUBLISH cmd/ack & state
     → Server: Command.update (status: executed)
     → Server: SSE pushTelemetry
     → Web/Mobile: Cập nhật UI real-time ✅
```
