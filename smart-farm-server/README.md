# Smart Farm Server (Node.js + MongoDB)

Server API cho hệ thống Smart Farm, xây dựng với Express và MongoDB (Mongoose).

## Tính năng chính
- Xác thực JWT (access/refresh), phân quyền `Farmer`/`Admin`
- Quản lý Users, Devices
- Ghi nhận SensorData theo Device, truy vấn theo thời gian
- Tạo và theo dõi Commands (pending/executed/queued) cho thiết bị
- Quản lý Schedules, Alerts, SystemLogs
- Cấu hình bảo mật cơ bản: Helmet, CORS, Rate Limit, morgan logs

## Cấu hình & chạy
1. Tạo file `.env` từ mẫu:
```
cp .env.example .env
```
Sau đó chỉnh sửa `MONGO_URI`, `JWT_*` nếu cần.

2. Cài dependencies và chạy dev:
```
npm install
npm run dev
```
Mặc định server chạy ở http://localhost:4000

## Cấu trúc thư mục
- `src/models`: Mongoose models cho tất cả collections
- `src/routes`: Định nghĩa các API routes
- `src/controllers`: Business logic
- `src/middleware`: Auth, validate, error handler
- `src/config/db.js`: Kết nối MongoDB

## Ghi chú
- Đây là scaffold/khung sẵn sàng mở rộng. Bạn có thể bổ sung MQTT integration, scheduler runner, unit tests.
- Với production, hãy dùng secrets mạnh và cấu hình CORS phù hợp.
