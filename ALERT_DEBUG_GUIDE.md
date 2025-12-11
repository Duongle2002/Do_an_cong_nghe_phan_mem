# Alert System Debug Guide

## Vấn đề: Alert không trigger khi cảm biến vượt ngưỡng

### Cách kiểm tra từng bước:

#### 1. Verify Alert Rule đã được tạo
```bash
GET /api/alert-rules?deviceId=YOUR_DEVICE_ID
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Response phải có:**
```json
[
  {
    "_id": "...",
    "deviceId": "YOUR_DEVICE_ID",
    "metric": "temperature",
    "minThreshold": 15,
    "maxThreshold": 45,
    "enabled": true,
    "notificationType": "app",
    "cooldownMinutes": 5
  }
]
```

**Nếu response rỗng:**
- Alert rule chưa được tạo, hoặc
- deviceId không match

---

#### 2. Test Alert Trigger Manually
```bash
POST /api/sensors/test-alert/YOUR_DEVICE_ID
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
Body:
{
  "temperature": 50,
  "humidity": 60,
  "soilMoisture": 75,
  "lux": 1000
}
```

**Kiểm tra server console cho log:**
```
[Alert] Device: Device Name, Sensor data: { temperature: 50, ... } Rules count: 1
[Alert] Rule: temperature, Value: 50, Min: 15, Max: 45, Enabled: true
[Alert] Max check 45: 50 → triggered=true
[Alert] Created alert: 65...
```

Nếu thấy:
- `Rules count: 0` → Alert rule chưa được tạo
- `triggered=false` → Logic lỗi, hoặc threshold sai
- `ShouldAlert: false` → Cooldown đang chặn (chờ 5 phút)

---

#### 3. Check Alert đã được tạo
```bash
GET /api/alerts?deviceId=YOUR_DEVICE_ID&read=false
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Phải thấy alert mới tạo:**
```json
[
  {
    "_id": "...",
    "deviceId": "YOUR_DEVICE_ID",
    "type": "warning",
    "message": "temperature is 50.00 (threshold: 15 - 45)",
    "read": false,
    "timestamp": "2025-12-09T..."
  }
]
```

---

#### 4. Gửi Sensor Data thực tế
```bash
POST /api/sensors/ingest
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
Body:
{
  "deviceId": "YOUR_DEVICE_ID",
  "temperature": 50,
  "humidity": 60,
  "soilMoisture": 75,
  "lux": 1000
}
```

**Kiểm tra:**
- Response status 201
- Check server logs (bước 2)
- Check alerts list (bước 3)

---

### Common Issues & Fixes:

| Vấn đề | Nguyên nhân | Giải pháp |
|--------|-----------|---------|
| Rules count: 0 | Alert rule chưa được tạo | Vào app → Device Detail → Alert Rules → Add Rule |
| triggered=false | Threshold sai logic | **Xem note dưới** |
| ShouldAlert: false | Cooldown đang chặn | Chờ 5 phút hoặc xóa lastAlertTime |

---

### Threshold Logic:

**Nếu set min=15, max=45:**
- ✅ Alert khi: temp < 15 **hoặc** temp > 45
- ❌ Không alert khi: 15 ≤ temp ≤ 45

**Nếu chỉ set max=45 (min=null):**
- ✅ Alert khi: temp > 45

**Nếu chỉ set min=15 (max=null):**
- ✅ Alert khi: temp < 15

---

### Reset Cooldown (để test liên tục):

Xóa `lastAlertTime` của rule:
```bash
PUT /api/alert-rules/RULE_ID
Headers:
  Authorization: Bearer YOUR_ACCESS_TOKEN
Body:
{
  "lastAlertTime": null
}
```

Hoặc xóa và tạo rule mới.

---

### Flutter App Toast Notification:

**Toast chỉ hiển thị khi:**
1. App đang mở
2. Polling alert mỗi 10 giây
3. Alert mới (chưa được show)

**Nếu không thấy toast:**
- Kiểm tra app console (logs)
- Xem Alerts Log page (Home → 🔔)
- Alert có thể đã trigger nhưng chưa được show do filter/scroll
