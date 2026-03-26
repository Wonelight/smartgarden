# 🌱 Smart Garden — Hệ thống Vườn Thông Minh

Hệ thống tưới tiêu thông minh kết hợp **Vật lý FAO-56** và **Machine Learning**, sử dụng dữ liệu cảm biến từ ESP32 để tự động hóa việc quản lý nước và phát hiện bệnh cây trồng.

---

## 📋 Mục lục

- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Cài đặt & Chạy](#cài-đặt--chạy)
  - [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
  - [1. MQTT Broker](#1-mqtt-broker-mosquitto)
  - [2. Backend](#2-backend-spring-boot)
  - [3. AI Service](#3-ai-service-fastapi)
  - [4. Frontend](#4-frontend-react)
  - [5. ESP32 Firmware](#5-esp32-firmware)
- [API Endpoints](#api-endpoints)
- [Cơ sở dữ liệu](#cơ-sở-dữ-liệu)
- [Mô hình AI / ML](#mô-hình-ai--ml)
- [Phần cứng ESP32](#phần-cứng-esp32)
- [Biến môi trường](#biến-môi-trường)

---

## Kiến trúc hệ thống

```
┌──────────────┐     MQTT      ┌──────────────────┐     REST      ┌─────────────────┐
│   ESP32-S3   │◄────────────►│  Mosquitto MQTT   │◄────────────►│   Spring Boot   │
│  (Firmware)  │  sensor/cmd   │  :1883 / :9001    │              │   Backend :8081 │
└──────────────┘               └──────────────────┘              └────────┬────────┘
       │                                                                  │
   Sensors &                                                    ┌────────┴────────┐
   Actuators                                                    │                 │
                                                          REST  │           REST  │
                                                                ▼                 ▼
                                                   ┌─────────────────┐  ┌──────────────┐
                                                   │  AI Service     │  │   React      │
                                                   │  FastAPI :5000  │  │   Frontend   │
                                                   │  (FAO-56 + ML) │  │   :3000      │
                                                   └─────────────────┘  └──────────────┘
                                                                               │
                                                                          WebSocket
                                                                        (realtime data)
```

---

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Backend** | Java 21, Spring Boot 3.2, Spring Data JPA, Spring Security (JWT), MapStruct |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Radix UI, Recharts, TanStack Query |
| **AI Service** | Python 3.11, FastAPI, scikit-learn, XGBoost, Ultralytics YOLO11, Pandas, NumPy |
| **Firmware** | Arduino C++ (ESP32-S3), FreeRTOS, PubSubClient (MQTT), WiFiManager |
| **Database** | MySQL 8 |
| **Message Broker** | Eclipse Mosquitto (MQTT + WebSocket) |
| **Containerization** | Docker, Docker Compose |
| **Weather** | OpenWeather API |

---

## Cấu trúc thư mục

```
smart_garden/
├── backend/smart-garden/     # Spring Boot backend
│   └── src/main/java/...     # Controllers, Services, Entities, Config
├── frontend/smart-garden-frontend/  # React + Vite frontend
│   └── src/                  # Pages, Components, Hooks, Services
├── ai-service/               # FastAPI AI/ML service
│   ├── app/                  # API, Services, Models, ML pipelines
│   ├── scripts/              # Camera inference script
│   └── tests/                # Unit tests
├── esp32-firmware/           # Arduino firmware cho ESP32-S3
│   └── sketch_feb17a/
├── mosquitto/config/         # Cấu hình MQTT broker
├── scripts/                  # Training scripts, data generation
├── data/                     # Training data, SQL seed files
└── docker-compose.mqtt.yml   # Docker cho MQTT broker
```

---

## Cài đặt & Chạy

### Yêu cầu hệ thống

- **Java** 21+
- **Node.js** 18+ & npm
- **Python** 3.11+
- **Docker** & Docker Compose
- **MySQL** 8+
- **Arduino IDE** / PlatformIO (cho firmware)

### 1. MQTT Broker (Mosquitto)

```bash
docker compose -f docker-compose.mqtt.yml up -d
```

Broker chạy tại:
- MQTT: `localhost:1883`
- WebSocket: `localhost:9001`

### 2. Backend (Spring Boot)

```bash
cd backend/smart-garden

# Tạo file cấu hình local (không commit)
cp src/main/resources/application.properties src/main/resources/application-local.properties
# Sửa application-local.properties: cấu hình MySQL, MQTT, JWT secret

# Chạy
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Backend chạy tại: `http://localhost:8081`

### 3. AI Service (FastAPI)

```bash
cd ai-service

# Tạo virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/macOS

# Cài dependencies
pip install -r requirements.txt

# Cấu hình
cp .env.example .env
# Sửa .env: BACKEND_URL, DB connection,...

# Chạy
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

AI Service chạy tại: `http://localhost:5000`

Hoặc dùng Docker:
```bash
cd ai-service
docker compose up -d
```

### 4. Frontend (React)

```bash
cd frontend/smart-garden-frontend

npm install
npm run dev
```

Frontend chạy tại: `http://localhost:3000`

### 5. ESP32 Firmware

1. Mở `esp32-firmware/sketch_feb17a/sketch_feb17a.ino` bằng Arduino IDE
2. Cài board **ESP32-S3** qua Board Manager
3. Cài các thư viện: `Adafruit SHT4x`, `BH1750`, `TFT_eSPI`, `PubSubClient`, `WiFiManager`, `ArduinoJson`
4. Cấu hình WiFi & MQTT broker IP trong code
5. Upload firmware lên board

---

## API Endpoints

### Backend (Spring Boot) — `/api`

| Nhóm | Endpoint | Mô tả |
|---|---|---|
| **Auth** | `POST /auth/login`, `/register`, `/refresh` | Đăng nhập, đăng ký, refresh JWT |
| **Device** | `GET/PUT /devices/{id}`, `POST /devices/connect` | Quản lý thiết bị |
| **Sensor** | `GET /devices/{id}/sensor-data/latest`, `/range`, `/hourly` | Dữ liệu cảm biến |
| **Irrigation** | `GET/PUT /devices/{id}/irrigation/config`, `/history/range` | Cấu hình & lịch sử tưới |
| **Schedule** | `GET/POST /schedules` | Lịch tưới tự động (cron) |
| **AI** | `POST /ai/predict`, `/ai/train`, `GET /ai/results/{id}` | Dự đoán & huấn luyện AI |
| **Water Balance** | `GET/PUT /devices/{id}/water-balance-state` | Cân bằng nước đa lớp |
| **Control** | `POST /devices/controls` | Gửi lệnh tới ESP32 (bơm, đèn) |
| **Admin** | `/admin/users`, `/admin/devices` | Quản trị người dùng & thiết bị |
| **Library** | `/admin/crop-libraries`, `/admin/soil-libraries` | Thư viện cây trồng & đất |
| **Weather** | Weather endpoints | Tích hợp OpenWeather |

### AI Service (FastAPI) — `/api/v1`

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/ai/predict` | Dự đoán tưới tiêu (FAO-56 + ML) |
| `POST` | `/api/v1/ai/train` | Huấn luyện model |
| `POST` | `/api/v1/ai/train-batch` | Huấn luyện batch |
| `POST` | `/api/v1/plant/analyze` | Phân tích ảnh cây trồng (YOLO) |
| `POST` | `/api/v1/plant/train` | Fine-tune YOLO |
| `GET` | `/api/v1/plant/models` | Danh sách model YOLO |
| `GET` | `/health` | Health check |

---

## Cơ sở dữ liệu

### Sơ đồ quan hệ

```
users ──┬──→ devices ──┬──→ sensor_data
        │              ├──→ sensor_data_hourly
        │              ├──→ irrigation_config
        │              ├──→ irrigation_history
        │              ├──→ schedules
        │              ├──→ device_controls
        │              ├──→ device_water_balance_state
        │              ├──→ crop_season ──→ crop_library
        │              └──→ soil_library
        ├──→ roles
        └──→ notifications
```

### Bảng chính

| Bảng | Mô tả |
|---|---|
| `users` | Người dùng (USER / ADMIN) |
| `devices` | Thiết bị ESP32 (device_code, GPS, trạng thái online/offline) |
| `sensor_data` | Dữ liệu thô từ cảm biến (JSON payload) |
| `sensor_data_hourly` | Dữ liệu tổng hợp theo giờ |
| `irrigation_config` | Ngưỡng tưới, cấu hình bơm, bật/tắt AI |
| `irrigation_history` | Lịch sử tưới (thời điểm, thời lượng, phương pháp) |
| `crop_library` / `soil_library` | Thư viện cây trồng & loại đất |
| `device_water_balance_state` | Cân bằng nước đa lớp (shallow + deep) |
| `ml_prediction` | Kết quả dự đoán ML |

> Tất cả bảng sử dụng **soft delete** (`deleted_at IS NULL`).

---

## Mô hình AI / ML

### Pipeline dự đoán tưới (Hybrid FAO-56 + ML)

```
Sensor Data + Weather Forecast + Crop Config
                │
                ▼
    ┌───────────────────────┐
    │  Tiền xử lý đặc trưng │  (33 numeric + 1 categorical)
    │  - Lag features        │
    │  - Interaction terms   │
    │  - Cyclic time encode  │
    └───────────┬───────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
  ┌──────────┐   ┌──────────────┐
  │  FAO-56  │   │   ML Model   │
  │  ET₀ →   │   │  (RF / XGB)  │
  │  24h sim │   │  Residual    │
  └────┬─────┘   └──────┬───────┘
       │                │
       └───────┬────────┘
               ▼
    Irrigation Recommendation
    (mm nước, thời lượng bơm, confidence)
```

### Phân tích ảnh cây trồng (YOLO11)

| Task | Mô tả |
|---|---|
| **Detection** | Phát hiện vùng bệnh, sâu bệnh, quả |
| **Classification** | Phân loại khỏe / bệnh (toàn ảnh) |
| **Segmentation** | Xác định % diện tích lá bị ảnh hưởng |

→ Đầu ra: `health_score` (0–100), trạng thái, khuyến nghị chăm sóc.

---

## Phần cứng ESP32

### Cảm biến & thiết bị

| Thành phần | Chi tiết |
|---|---|
| **Board** | ESP32-S3 |
| **Nhiệt độ & Độ ẩm** | SHT4x (I2C) |
| **Ánh sáng** | BH1750 (I2C) |
| **Độ ẩm đất** | 2x Resistive (ADC pin 15, 16) |
| **Mưa** | Analog (pin 17) |
| **Bơm nước** | Relay GPIO 4 (Active LOW) |
| **Đèn** | Relay GPIO 39 (Active LOW) |
| **Màn hình** | ST7735 TFT (SPI) |

### MQTT Topics

| Hướng | Topic | Nội dung |
|---|---|---|
| **Publish** | `sensor/{deviceCode}` | JSON: temp, humidity, soil1/2, light, rain, pump_state, light_state |
| **Publish** | `heartbeat/{deviceCode}` | Heartbeat mỗi 60s |
| **Subscribe** | `command/{deviceCode}` | Lệnh điều khiển bơm/đèn |

### Multi-tasking (FreeRTOS)

- Sensor sampling (31-sample ADC, EMA α=0.3)
- Pump control (hysteresis: ON ≤20%, OFF ≥30%)
- TFT display update
- MQTT publish (mỗi 10s) + reconnect

---

## Biến môi trường

### Backend (`application-local.properties`)

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/smart_garden
spring.datasource.username=root
spring.datasource.password=<password>
app.jwt.secret=<jwt-secret>
spring.mqtt.broker-url=tcp://localhost:1883
```

### AI Service (`.env`)

```env
BACKEND_URL=http://localhost:8081/api
DB_HOST=localhost
DB_PORT=3306
DB_NAME=smart_garden
DB_USER=root
DB_PASSWORD=<password>
DEBUG=true
```

### Frontend (`.env`)

```env
VITE_API_BASE_URL=http://localhost:8081/api
VITE_WS_URL=ws://localhost:9001
```

---

## Tác giả

- **Trần Hải Anh** — MSSV: 111060935

---

> **Ghi chú**: File `application-local.properties` và `.env` chứa thông tin nhạy cảm, đã được thêm vào `.gitignore` và không được commit lên repository.
