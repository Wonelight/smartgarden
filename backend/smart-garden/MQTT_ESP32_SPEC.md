# MQTT Backend ↔ ESP32 - Đặc tả giao tiếp

## Cơ chế kết nối (Connection)

### Tổng quan

```
  [ESP32]  <----MQTT---->  [Broker Mosquitto]  <----MQTT---->  [Backend]
  ClientID = deviceCode      (1883 / 9001 WS)     ClientID = smart-garden-backend
  cleanSession=false                              cleanSession=false
  LWT → .../lwt                                   2 kết nối: sub + pub
```

### Backend → Broker

1. **Hai kết nối (2 ClientID)**  
   Broker MQTT chỉ cho phép **một connection trên một ClientID**. Backend cần vừa subscribe vừa publish nên dùng hai client:
   - **Subscriber**: `mqtt.client-id` (vd: `smart-garden-backend`) – chỉ subscribe.
   - **Publisher**: `mqtt.client-id` + `-pub` (vd: `smart-garden-backend-pub`) – chỉ publish.

2. **Thời điểm connect**  
   - **Inbound**: `MqttPahoMessageDrivenChannelAdapter` được khởi tạo khi Spring context start → tự connect tới broker, subscribe các topic `smart_garden/devices/+/status`, `.../sensor`, `.../heartbeat`, `.../lwt`, `.../cmd/ack`.  
   - **Outbound**: `MqttPahoMessageHandler` connect **lazy** – connect lần đầu khi có message gửi đi (vd khi gửi command).

3. **Tham số kết nối** (trong `MqttConfig` / `MqttProperties`):
   - **cleanSession = false**: Broker giữ session (subscription + QoS 1 messages chưa ack). Khi backend reconnect, vẫn nhận lại message gửi khi nó offline.
   - **automaticReconnect = true**: Paho tự reconnect khi mất kết nối.
   - **recoveryInterval** (adapter): 10s – khoảng cách giữa các lần thử lại subscribe khi lỗi.

4. **Luồng dữ liệu**  
   - Message từ broker → Adapter → `mqttInboundChannel` → `MqttInboundHandler` (parse topic, gọi service: sensor ingest, status/heartbeat/LWT cập nhật device, cmd/ack → `MqttCommandSender`).  
   - Gửi command: `DeviceControlService` → `MqttCommandSender.sendAndWaitAck()` → build message → `mqttOutboundChannel` → `MqttPahoMessageHandler` (publish lên `.../cmd`).

5. **TLS**  
   Đổi `mqtt.broker-url` sang `ssl://host:8883`. Paho dùng SSL socket. Production có thể bật auth (username/password) và ACL trên broker.

### MCU (ESP32) → Broker

1. **Một kết nối một thiết bị**  
   Mỗi ESP32 dùng **một ClientID cố định = `device_code`** (trùng với DB), **cleanSession = false**.

2. **Khi connect**  
   - Set **Last Will (LWT)**: topic `smart_garden/devices/{deviceCode}/lwt`, payload `offline`, retain=true, QoS 1.  
   - Broker sẽ publish LWT khi ESP32 mất kết nối (ngắt đột ngột, mất điện) → Backend nhận và đánh dấu device OFFLINE.

3. **Sau khi connect**  
   - Subscribe topic **`smart_garden/devices/{deviceCode}/cmd`** (nhận lệnh từ backend).  
   - Publish: `.../sensor`, `.../status`, `.../heartbeat`, `.../cmd/ack` (theo đặc tả payload bên dưới).

4. **Application heartbeat**  
   Định kỳ (vd 60s) gửi message lên `.../heartbeat`. Backend dùng để cập nhật `lastOnline` và coi device còn online.

5. **Reconnect**  
   ESP32 nên **automaticReconnect** và dùng **cùng ClientID** mỗi lần để broker khôi phục session (cleanSession=false).

---

## Topic naming

- Format: `smart_garden/devices/{deviceCode}/{type}`
- `deviceCode`: mã thiết bị (trùng `device_code` trong DB, dùng làm MQTT ClientID trên MCU).

| Topic suffix | Hướng    | Retain | QoS | Mô tả                          |
|-------------|----------|--------|-----|---------------------------------|
| `status`    | MCU→Backend | true  | 1   | Trạng thái (online, manualMode, pump, setPoint) |
| `sensor`    | MCU→Backend | false | 1   | Telemetry cảm biến             |
| `heartbeat` | MCU→Backend | false | 0   | Application-level heartbeat     |
| `lwt`       | Broker (LWT) | true  | 1   | Last Will: payload "offline"   |
| `cmd`       | Backend→MCU | false | 1   | Lệnh điều khiển                |
| `cmd/ack`   | MCU→Backend | false | 1   | ACK lệnh (có cmd_id)           |

## LWT (Last Will Testament)

- Topic: `smart_garden/devices/{deviceCode}/lwt`
- Payload: `{"status":"offline"}` hoặc chuỗi `"offline"`
- Retain = true, QoS 1.

## JSON payload

### Command (Backend → MCU) – topic `cmd`

```json
{
  "cmdId": "uuid",
  "cmd": "PUMP_ON | PUMP_OFF | AUTO | SET_SETPOINT",
  "params": { "setpoint": 30 }
}
```

### ACK (MCU → Backend) – topic `cmd/ack`

- Echo `cmdId` để Backend match. Bỏ qua duplicate (QoS 1 có thể gửi 2 lần).

```json
{
  "cmdId": "uuid",
  "status": "ok | error",
  "message": "optional"
}
```

### Sensor (MCU → Backend) – topic `sensor`

```json
{
  "soilMoisture": 45.0,
  "soilMoisture2": 42.0,
  "temperature": 28.5,
  "humidity": 65.0,
  "lightIntensity": 1200.0,
  "rainDetected": false,
  "ambientLight": 1100.0,
  "pumpState": false,
  "ts": 1708412400000
}
```

### Status (MCU → Backend) – topic `status`, retain = true

```json
{
  "online": true,
  "manualMode": false,
  "pumpState": false,
  "setPoint": 30,
  "ts": 1708412400000
}
```

### Heartbeat – topic `heartbeat`

```json
{ "ts": 1708412400000 }
```

## Kết nối vườn với thiết bị (Connect by MAC)

1. **ESP32**: Kết nối WiFi → lấy MAC (vd `WiFi.macAddress()` → "AA:BB:CC:DD:EE:FF") → hiển thị trên màn hình/Serial để user nhập vào app.
2. **Backend**: User gọi `POST /api/devices/connect` với body `{ "macAddress": "AA:BB:CC:DD:EE:FF" }`. Server chuẩn hóa MAC thành 12 ký tự hex viết hoa (AABBCCDDEEFF) làm `device_code`. Chưa có device → tạo mới, gán user; đã có và thuộc user khác → lỗi "Thiết bị đã được tài khoản khác đăng ký".
3. **Xác thực thành công**: Trả về thông tin device → coi như đã kết nối. ESP32 dùng cùng `device_code` (MAC chuẩn hóa) cho MQTT thì hoạt động bình thường.

## MCU (ESP32) cần

1. **ClientID cố định**: dùng `device_code` = **MAC chuẩn hóa** (12 ký tự hex viết hoa, không dấu; vd từ `WiFi.macAddress()` bỏ `:` rồi toUpperCase).
2. **cleanSession = false**.
3. Subscribe: `smart_garden/devices/{deviceCode}/cmd`.
4. Publish: `sensor`, `status`, `heartbeat`, `cmd/ack`; cấu hình LWT topic + payload.
5. Gửi heartbeat định kỳ (ví dụ 60s).
6. Khi nhận `cmd`: thực hiện lệnh, gửi ACK lên `cmd/ack` với cùng `cmdId`.

## Chạy broker (Docker)

```bash
docker compose -f docker-compose.mqtt.yml up -d
```

Cấu hình broker: `mosquitto/config/mosquitto.conf` (listener 1883, 9001 WS, allow_anonymous cho dev).
