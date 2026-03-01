# Smart Garden AI Service

> Hệ thống AI dự đoán tưới tiêu thông minh sử dụng kiến trúc hybrid **FAO-56 Physics + Machine Learning** (Random Forest / XGBoost). Nhận dữ liệu sensor từ ESP32 qua Spring Boot backend, tính toán cân bằng nước đa tầng (multi-layer water balance), và trả về khuyến nghị tưới tiêu tối ưu.

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Tech Stack](#3-tech-stack)
4. [Hướng dẫn cài đặt](#4-hướng-dẫn-cài-đặt)
5. [Sử dụng](#5-sử-dụng)
6. [Cấu hình](#6-cấu-hình)
7. [API Specification](#7-api-specification)
8. [Logic AI / Thuật toán](#8-logic-ai--thuật-toán)
9. [Cấu trúc thư mục](#9-cấu-trúc-thư-mục)
10. [Troubleshooting](#10-troubleshooting)
11. [Hướng phát triển](#11-hướng-phát-triển)

---

## 1. Tổng quan dự án

### Vấn đề

Tưới tiêu nông nghiệp truyền thống lãng phí nước do không tính đến điều kiện thời tiết thực tế, loại đất, giai đoạn sinh trưởng cây trồng, và trạng thái ẩm đất theo thời gian thực. Cần một hệ thống tự động ra quyết định tưới dựa trên dữ liệu cảm biến và mô hình vật lý + AI.

### Giải pháp

AI Service kết hợp:

- **FAO-56 Penman-Monteith** — mô hình vật lý chuẩn quốc tế tính lượng bốc thoát hơi nước chuẩn (ET₀), cân bằng nước đa tầng (shallow + deep root zone)
- **Random Forest / XGBoost** — học phần sai lệch (residual) mà mô hình vật lý không nắm bắt được: mưa ngẫu nhiên, drift sensor, hiệu ứng vi khí hậu cục bộ
- **Kiến trúc hybrid** — FAO-56 xử lý ~80-90% tín hiệu vật lý, ML bổ sung hiệu chỉnh data-driven

### Đặc điểm chính

| Đặc điểm | Mô tả |
|---|---|
| Hybrid Physics + ML | FAO-56 baseline + RF/XGBoost residual correction |
| Multi-layer water balance | Tầng nông (40%) + tầng sâu (60%) root zone |
| Hourly time-step | ETo tính theo giờ (FAO-56 Eq. 53), tránh over-accumulation |
| Location-aware | Vĩ độ/độ cao ảnh hưởng trực tiếp đến ETo, sunrise/sunset |
| Sensor fusion | Kết hợp sensor đất, dự báo thời tiết OpenWeather, thông tin cây trồng |
| 24h forward simulation | Mô phỏng trước 24h bằng FAO-56 để dự đoán cạn kiệt |
| Lag features | 6 giờ bộ nhớ ngắn hạn (depletion trend, rain sum, ETc mean) |
| Flexible storage | In-memory hoặc MySQL (qua REST API) cho water balance state |

---

## 2. Kiến trúc hệ thống

### 2.1. Kiến trúc tổng thể (System Architecture)

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   ESP32      │────▶│  Spring Boot     │────▶│   AI Service      │
│   Sensors    │     │  Backend         │     │   (FastAPI)       │
│              │     │  :8081           │     │   :5000           │
│  • Temp/Hum  │     │                  │     │                   │
│  • Soil x2   │     │  • REST API      │     │  • Preprocessing  │
│  • Light     │     │  • OpenWeather   │     │  • FAO-56 Physics │
│  • Rain      │     │  • Crop/Soil DB  │     │  • RF/XGB Model   │
└──────────────┘     └──────────────────┘     └───────────────────┘
                              │                         │
                              ▼                         ▼
                     ┌──────────────────┐     ┌───────────────────┐
                     │    MySQL DB      │     │  Model Storage    │
                     │  Water Balance   │     │  (.joblib files)  │
                     │  State           │     │                   │
                     └──────────────────┘     └───────────────────┘
```

### 2.2. Prediction Pipeline (Chi tiết luồng xử lý)

```
AiPredictRequest
│
├─ sensors: {temp, humidity, soil_moist1, soil_moist2, rain, light}
├─ openweather: {temperature, humidity, wind_speed, forecast_rain, daily_forecasts[]}
└─ crop: {type, growth_stage, kc_current, field_capacity, wilting_point, soil_type, ...}
│
▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. PREPROCESSING (preprocessing_service.py)                        │
│                                                                     │
│    a) Cleaning & Mapping                                            │
│       • soil_moist1 → shallow, soil_moist2 → deep                  │
│       • Domain clamping (temp: 0-50°C, humidity: 0-100%, ...)      │
│       • Missing value defaults                                      │
│                                                                     │
│    b) ETo/ETc tính toán (hourly)                                    │
│       • FAO-56 Eq. 53 → ETo (mm/h)                                 │
│       • Kc climatic adjustment (Eq. 62) cho mid/end season          │
│       • ETc = ETo × Kc_adj                                          │
│                                                                     │
│    c) Multi-layer Water Balance                                     │
│       • Shallow depletion: D_sh(i) = D_sh(i-1) + ETc×0.4 - Rain×0.7│
│       • Deep depletion:    D_dp(i) = D_dp(i-1) + ETc×0.6 - Rain×0.3│
│       • Sensor-informed blending (dynamic trust weight)             │
│       • Weighted depletion = 0.6×deep + 0.4×shallow                │
│                                                                     │
│    d) 24h Forward Simulation (deterministic FAO-56)                 │
│       • Diurnal temp/humidity cycles (location-aware)               │
│       • Parabolic solar radiation curve                             │
│       • Ks stress factor (FAO-56 Eq. 84)                            │
│       → fao_pred_24h, etc_cumulative_24h                            │
│                                                                     │
│    e) Feature Engineering (31 numeric + 1 categorical)              │
│       • Interaction: temp×humidity, solar×temp                      │
│       • Seasonal: season×stress, season×rain, season×etc            │
│       • Cyclic time: hour_sin/cos, month_sin                        │
│       • Lag 6h: depletion_trend, rain_sum, etc_mean                 │
│       • Sub-model: is_cold_season, cold×stress, cold×etc            │
│                                                                     │
│    Output: pd.DataFrame (1 row × 32 features + fao_pred_24h)       │
└─────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. ML PREDICTION (prediction_service.py)                            │
│                                                                     │
│    ┌──────────────────────────────┐                                 │
│    │ FAO-56 Baseline              │                                 │
│    │ fao_pred_24h (from step 1d)  │──┐                              │
│    └──────────────────────────────┘  │                              │
│                                      ▼                              │
│    ┌──────────────────────────────┐  ┌─────────────────────┐        │
│    │ RF/XGB Model                 │  │      HYBRID         │        │
│    │ predict(features) → residual │──│ fao_pred + residual │        │
│    └──────────────────────────────┘  │ = predicted_depl_24h│        │
│                                      └─────────────────────┘        │
│                                              │                      │
│    Decision Logic:                           ▼                      │
│    • predicted_depl_24h > RAW → irrigate (depl - 0.5×RAW) mm       │
│    • soil_deficit > 15 → light irrigation (depl × 0.3) mm          │
│    • otherwise → không tưới (0 mm)                                  │
│                                                                     │
│    Confidence Estimation:                                           │
│    • RF: tree variance (1 - std / (IQR + 1))                       │
│    • XGB: residual magnitude (0.95 - |residual| × 0.11)            │
│                                                                     │
│    Output: (irrigation_mm, confidence, predicted_depletion_24h)     │
└─────────────────────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. POST-PROCESSING (anfis_service.py)                              │
│                                                                     │
│    • Clamp: 0 ≤ water_mm ≤ 20 mm                                   │
│    • Convert: mm → duration (seconds)                               │
│      duration = water_mm / flow_rate (default: 0.033 mm/s)         │
│    • Buffer: refined_duration = duration - 10s                     │
│                                                                     │
│    Output: AiPredictResponse {                                      │
│      ai_output, predicted_duration, refined_duration,              │
│      confidence, ai_params                                          │
│    }                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3. Training Pipeline

```
┌────────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│ generate_dataset.py│────▶│  CSV Dataset       │────▶│  train_rf.py     │
│                    │     │  (35,040 rows)     │     │  train_xgb.py    │
│ Synthetic data     │     │  40 features       │     │                  │
│ FAO-56 simulation  │     │  + residual_target │     │  TimeSeriesSplit │
│ Multi-location     │     │                    │     │  RandomizedSearch│
│ Multi-crop/soil    │     │                    │     │  Hybrid eval     │
└────────────────────┘     └───────────────────┘     └──────────────────┘
                                                              │
                                                              ▼
                                                     ┌──────────────────┐
                                                     │ .joblib model    │
                                                     │ + metrics.txt    │
                                                     │                  │
                                                     │ ai-service/app/  │
                                                     │ ml/models/       │
                                                     └──────────────────┘
```

---

## 3. Tech Stack

| Thành phần | Công nghệ | Phiên bản | Vai trò |
|---|---|---|---|
| Web Framework | FastAPI | 0.115.0 | REST API, async, auto-docs |
| ASGI Server | Uvicorn | 0.30.6 | Production-ready ASGI server |
| Validation | Pydantic | 2.9.2 | Schema validation, domain clamping |
| Settings | pydantic-settings | 2.5.2 | Environment-based configuration |
| HTTP Client | httpx | 0.27.2 | Async HTTP cho backend REST API |
| ML Framework | scikit-learn | ≥1.5 | Pipeline, preprocessing, RandomForest |
| Gradient Boosting | XGBoost | ≥2.0 | XGBRegressor cho residual learning |
| Data Processing | pandas | ≥2.2 | DataFrame manipulation |
| Numerical | NumPy | ≥1.26 | Array operations |
| Serialization | joblib | ≥1.4 | Model save/load |
| Runtime | Python | 3.10+ | Language runtime |
| Container | Docker | 3.11-slim | Deployment |

---

## 4. Hướng dẫn cài đặt

### 4.1. Yêu cầu hệ thống

- Python 3.10+ (khuyến nghị 3.11)
- pip hoặc pip3
- (Tùy chọn) Docker + Docker Compose
- (Tùy chọn) Spring Boot backend chạy tại `:8081`

### 4.2. Cài đặt local

```bash
# Clone và di chuyển vào thư mục
cd ai-service

# Tạo virtual environment
python -m venv venv

# Kích hoạt (Linux/Mac)
source venv/bin/activate

# Kích hoạt (Windows PowerShell)
.\venv\Scripts\Activate.ps1

# Cài đặt dependencies
pip install -r requirements.txt
```

### 4.3. Cấu hình environment

```bash
# Copy file cấu hình mẫu
cp .env.example .env

# Chỉnh sửa .env nếu cần
```

### 4.4. Khởi chạy server

```bash
# Development (auto-reload)
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 5000 --workers 4
```

### 4.5. Cài đặt bằng Docker

```bash
# Build và chạy
docker-compose up --build

# Chạy nền
docker-compose up -d --build

# Xem logs
docker-compose logs -f ai-service
```

### 4.6. Kiểm tra hoạt động

```bash
# Health check
curl http://localhost:5000/

# Swagger UI
# Mở trình duyệt: http://localhost:5000/docs

# ReDoc
# Mở trình duyệt: http://localhost:5000/redoc
```

---

## 5. Sử dụng

### 5.1. Tạo dữ liệu huấn luyện (Data Generation)

```bash
# Dataset đầy đủ — 4 năm hourly (35,040 rows, 40 features)
cd scripts
python generate_dataset.py \
    --n-samples 35040 \
    --out ../data/rf_training_data.csv \
    --seed 42 \
    --interval 1 \
    --location hanoi

# Dataset nhỏ để test nhanh (1,000 rows)
python generate_training_dataset.py
# Output: scripts/training_dataset_1000.csv
```

**Tham số `generate_dataset.py`:**

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `--n-samples` | 35040 | Số mẫu (35040 = 4 năm × 365 ngày × 24h) |
| `--out` | `data/rf_training_data.csv` | Đường dẫn file CSV output |
| `--seed` | 42 | Random seed cho reproducibility |
| `--interval` | 1 | Khoảng cách giữa các mẫu (giờ) |
| `--location` | `hanoi` | Vùng khí hậu: `hanoi` hoặc `hcm` |

**Dữ liệu sinh ra bao gồm:**

- 5 loại cây: tomato, lettuce, pepper, cucumber, rice (mỗi loại có Kc, root depth, growth stages riêng)
- 5 loại đất: sandy, loam, clay, sandy_loam, clay_loam (FC, WP, infiltration ratios riêng)
- 4 giai đoạn sinh trưởng: initial, development, mid, end
- Chu kỳ ngày/đêm: nhiệt độ, bức xạ, ETo thay đổi theo giờ
- Mưa ngẫu nhiên: Markov chain với xác suất theo mùa
- AR(1) autocorrelation: ρ=0.92 (temp), ρ=0.88 (humidity), ρ=0.80 (wind)

### 5.2. Huấn luyện mô hình

```bash
cd scripts

# Huấn luyện Random Forest
python train_rf.py ../data/rf_training_data.csv \
    --target residual_target \
    --n-splits 5 \
    --n-iter 20 \
    --test-ratio 0.20 \
    --out-dir ../ai-service/app/ml/models

# Huấn luyện XGBoost
python train_xgb.py ../data/rf_training_data.csv \
    --target residual_target \
    --n-splits 5 \
    --n-iter 30 \
    --test-ratio 0.20 \
    --out-dir ../ai-service/app/ml/models
```

**Tham số training scripts:**

| Tham số | Mặc định | Mô tả |
|---|---|---|
| `csv_path` | (bắt buộc) | Đường dẫn CSV chứa features + target |
| `--target` | `residual_target` | Cột target: `residual_target`, `depletion_after_24h`, hoặc `actual_irrigation_mm_next_24h` |
| `--time-col` | `timestamp` | Cột thời gian để sort (TimeSeriesSplit) |
| `--n-splits` | 5 | Số fold cho TimeSeriesSplit cross-validation |
| `--n-iter` | 20 (RF) / 30 (XGB) | Số lần thử RandomizedSearchCV |
| `--test-ratio` | 0.20 | Tỷ lệ hold-out test set (20% mới nhất theo thời gian) |
| `--out-dir` | `ai-service/app/ml/models` | Thư mục lưu model + metrics |
| `--n-jobs` | -1 | Số CPU cores (-1 = tất cả) |

**Output sau training:**

```
ai-service/app/ml/models/
├── rf_v20260220_1430.joblib          # Versioned RF model
├── metrics_rf_v20260220_1430.txt     # RF metrics report
├── xgb_v20260220_1500.joblib         # Versioned XGB model
└── metrics_xgb_v20260220_1500.txt    # XGB metrics report
```

### 5.3. Gọi API prediction

```bash
curl -X POST http://localhost:5000/api/v1/ai/predict \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "sensor_data_id": 100,
    "sensors": {
      "temp": 30.5,
      "humidity": 65.0,
      "soil_moist1": 42.0,
      "soil_moist2": 38.0,
      "rain": 0,
      "light": 45000
    },
    "openweather": {
      "temperature": 31.0,
      "humidity": 62.0,
      "wind_speed": 2.5,
      "forecast_rain": 0.0,
      "daily_forecasts": [
        {"date": "2026-02-20", "total_rain": 0.0, "avg_clouds": 30.0},
        {"date": "2026-02-21", "total_rain": 5.2, "avg_clouds": 60.0},
        {"date": "2026-02-22", "total_rain": 0.0, "avg_clouds": 20.0}
      ]
    },
    "crop": {
      "type": "tomato",
      "growth_stage": "mid",
      "kc_current": 1.15,
      "root_depth": 0.5,
      "field_capacity": 30.0,
      "wilting_point": 15.0,
      "depletion_fraction": 0.5,
      "soil_type": "loam",
      "crop_height": 0.6,
      "latitude": 21.03,
      "altitude": 12.0
    }
  }'
```

**Response mẫu:**

```json
{
  "device_id": 1,
  "ai_output": 3.45,
  "predicted_duration": 104,
  "refined_duration": 94,
  "confidence": 0.82,
  "accuracy": 0.82,
  "ai_params": {
    "model": "xgb-pipeline",
    "version": "3.0",
    "features": {
      "etc": 0.185,
      "soil_moist_deficit": 10.0,
      "predicted_depl_24h": 4.12,
      "raw": 7.5,
      "soil_moist_shallow": 42.0,
      "soil_moist_deep": 38.0,
      "soil_moist_trend_1h": -0.5,
      "water_mm": 3.45
    }
  }
}
```

---

## 6. Cấu hình

### 6.1. Biến môi trường (`.env`)

```ini
# Tên và phiên bản ứng dụng
APP_NAME=Smart Garden AI Service
APP_VERSION=0.1.0
DEBUG=true

# URL backend Spring Boot
BACKEND_URL=http://localhost:8081/api

# CORS allowed origins
CORS_ORIGINS=["http://localhost:8081","http://localhost:3000","http://localhost:5173"]

# Water Balance Storage
# true  = MySQL database (qua REST API tới backend)
# false = In-memory (mất dữ liệu khi restart)
USE_DB_STORAGE=false
```

### 6.2. ML Model Directory

Mặc định model được lưu tại `app/ml/models/`. Khi khởi động, `PredictionService` tự động tìm model theo thứ tự ưu tiên:

1. XGBoost mới nhất (`xgb_v*.joblib` — sorted by version timestamp)
2. Random Forest (`rf_irrigation_pipeline.joblib`)
3. Nếu không tìm thấy → sử dụng stub prediction (physics-heuristic)

### 6.3. Các hằng số vật lý quan trọng

| Hằng số | Giá trị | Ý nghĩa |
|---|---|---|
| `SHALLOW_LAYER_RATIO` | 0.4 | 40% root zone depth cho tầng nông |
| `DEEP_LAYER_RATIO` | 0.6 | 60% root zone depth cho tầng sâu |
| `INFILTRATION_SHALLOW_RATIO` | 0.70 | 70% nước mưa/tưới vào tầng nông |
| `INFILTRATION_DEEP_RATIO` | 0.30 | 30% nước mưa/tưới vào tầng sâu |
| `DEFAULT_FLOW_RATE_MM_PER_SEC` | 0.033 | Tốc độ phun 2 L/min, diện tích 1m² |
| `TREND_WINDOW` | 6 | Số mẫu cho trend ~1h (mỗi 10 phút) |
| `LAG_WINDOW` | 36 | Số mẫu cho lag ~6h (mỗi 10 phút) |

---

## 7. API Specification

### Base URL

```
http://localhost:5000/api/v1
```

### Endpoints

#### `GET /` — Root

Kiểm tra service đang hoạt động.

**Response:**
```json
{
  "service": "Smart Garden AI Service",
  "version": "0.1.0",
  "docs": "/docs"
}
```

#### `GET /api/v1/health` — Health Check

**Response:**
```json
{
  "status": "healthy"
}
```

#### `POST /api/v1/ai/predict` — AI Prediction

Nhận dữ liệu sensor + thời tiết + cây trồng, trả về khuyến nghị tưới.

**Request Body (`AiPredictRequest`):**

| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `device_id` | int | Có | ID thiết bị ESP32 |
| `sensor_data_id` | int | Có | ID bản ghi sensor data |
| `sensors` | SensorPayload | Có | Dữ liệu cảm biến |
| `openweather` | OpenWeatherPayload | Không | Dữ liệu thời tiết |
| `crop` | CropPayload | Không | Thông tin cây trồng/đất |

**SensorPayload:**

| Field | Type | Range | Mô tả |
|---|---|---|---|
| `temp` | float | 0–50 °C | Nhiệt độ không khí |
| `humidity` | float | 0–100 % | Độ ẩm không khí |
| `soil_moist1` | float | 0–100 % | Độ ẩm đất tầng nông |
| `soil_moist2` | float | 0–100 % | Độ ẩm đất tầng sâu |
| `rain` | int | 0/1 | Phát hiện mưa (binary) |
| `light` | float | 0–200,000 lux | Cường độ ánh sáng |

**OpenWeatherPayload:**

| Field | Type | Mô tả |
|---|---|---|
| `temperature` | float | Nhiệt độ dự báo (°C) |
| `humidity` | float | Độ ẩm dự báo (%) |
| `wind_speed` | float | Tốc độ gió (m/s) |
| `forecast_rain` | float | Lượng mưa dự báo (mm) |
| `precipitation_probability` | float | Xác suất mưa (0–1) |
| `solar_radiation` | float | Bức xạ mặt trời (MJ/m²/day) |
| `atmospheric_pressure` | float | Áp suất khí quyển (kPa) |
| `daily_forecasts` | DailyForecast[] | Dự báo 1–3 ngày |

**CropPayload:**

| Field | Type | Mô tả |
|---|---|---|
| `type` | string | Loại cây (rice, tomato, ...) |
| `growth_stage` | string | Giai đoạn: initial/development/mid/end |
| `kc_current` | float | Hệ số cây trồng hiện tại |
| `root_depth` | float | Chiều sâu rễ (m) |
| `field_capacity` | float | Dung tích đồng ruộng (%) |
| `wilting_point` | float | Điểm héo vĩnh cửu (%) |
| `depletion_fraction` | float | Hệ số cạn kiệt cho phép (p) |
| `soil_type` | string | Loại đất (loam, clay, sandy, ...) |
| `latitude` | float | Vĩ độ (°) |
| `altitude` | float | Độ cao (m) |

**Response (`AiPredictResponse`):**

| Field | Type | Mô tả |
|---|---|---|
| `device_id` | int | ID thiết bị |
| `ai_output` | float | Lượng nước dự đoán (mm) |
| `predicted_duration` | int | Thời gian tưới dự đoán (giây) |
| `refined_duration` | int | Thời gian tưới sau hiệu chỉnh (giây) |
| `confidence` | float | Độ tin cậy (0–1) |
| `accuracy` | float | Tương đương confidence |
| `ai_params` | object | Metadata: model type, version, feature values |

#### `POST /api/v1/ai/train` — Trigger Training (Stub)

**Request Body (`AiTrainRequest`):**

| Field | Type | Mặc định | Mô tả |
|---|---|---|---|
| `device_id` | int | — | ID thiết bị |
| `epochs` | int | 100 | Số epochs |
| `learning_rate` | float | 0.01 | Learning rate |
| `data_count` | int | 0 | Số lượng dữ liệu huấn luyện |

**Response (`AiTrainResponse`):**

| Field | Type | Mô tả |
|---|---|---|
| `device_id` | int | ID thiết bị |
| `accuracy` | float | Accuracy (mock) |
| `status` | string | "completed" |
| `trained_params` | object | Metadata |

> **Lưu ý:** Endpoint `/train` hiện tại trả mock response. Training thực tế được thực hiện offline qua `scripts/train_rf.py` hoặc `train_xgb.py`.

---

## 8. Logic AI / Thuật toán

### 8.1. FAO-56 Penman-Monteith (Physics Engine)

Công thức tính lượng bốc thoát hơi nước chuẩn (Reference Evapotranspiration):

**ETo hàng ngày (Eq. 6):**

```
          0.408 × Δ × (Rn - G) + γ × (900 / (T + 273)) × u₂ × (es - ea)
ETo = ─────────────────────────────────────────────────────────────────────
                            Δ + γ × (1 + 0.34 × u₂)
```

**ETo theo giờ (Eq. 53):**

```
          0.408 × Δ × (Rn - G) + γ × (Cn / (T + 273)) × u₂ × (es - ea)
ETo_h = ─────────────────────────────────────────────────────────────────────
                            Δ + γ × (1 + Cd × u₂)
```

Trong đó:
- `Cn = 37`, `Cd = 0.24` (ban ngày) / `0.96` (ban đêm)
- `Δ` = slope of saturation vapour pressure curve
- `γ` = psychrometric constant
- `Rn` = net radiation (tính từ solar radiation, albedo, longwave)
- `G` = soil heat flux (0.1Rn ban ngày, 0.5Rn ban đêm)
- `u₂` = wind speed tại 2m

**Crop Evapotranspiration:**

```
ETc = ETo × Kc × Ks
```

- `Kc` = hệ số cây trồng (adjusted theo FAO-56 Eq. 62 cho mid/end season)
- `Ks` = hệ số stress nước (Eq. 84): Ks=1 khi Dr ≤ RAW, giảm tuyến tính khi Dr > RAW

### 8.2. Multi-layer Water Balance

Mô hình chia root zone thành 2 tầng:

```
Surface
  ║
  ║  Rain/Irrigation
  ║  ┌─────────────────────┐
  ║  │  70% infiltration    │
  ▼  │                     │
┌────────────────────────────┐
│     SHALLOW LAYER (40%)    │  ← sensor 1 (soil_moist1)
│     D_sh = D_sh + ETc×0.4 │
│            - Rain×0.7      │
│            - Irr×0.7       │
└────────────────────────────┘
         │  30% infiltration
         ▼
┌────────────────────────────┐
│     DEEP LAYER (60%)       │  ← sensor 2 (soil_moist2)
│     D_dp = D_dp + ETc×0.6 │
│            - Rain×0.3      │
│            - Irr×0.3       │
└────────────────────────────┘

Weighted Depletion = 0.6 × D_deep + 0.4 × D_shallow
```

**Dynamic Trust Blending (Sensor ↔ Physics):**

- Đất ẩm (sm ≥ 0.9·FC): sensor chính xác → weight 80% sensor, 20% calc
- Đất khô (sm ≤ 0.3·FC): sensor có thể drift → weight 20% sensor, 80% calc
- Nội suy tuyến tính giữa hai cực trị
- Reset về 0 khi sensor đọc ≥ FC (sau tưới / mưa nặng)

### 8.3. Hybrid ML Architecture

```
                    ┌──────────────────────┐
                    │    Training Phase     │
                    │                      │
   Ground truth ────│  residual_target =   │
   (simulation)     │  actual_depl_24h     │
                    │  - fao_pred_24h      │
                    │                      │
   Features ────────│  RF/XGB.fit(X, y)    │
   (31+1 dims)     └──────────────────────┘

                    ┌──────────────────────┐
                    │   Inference Phase     │
                    │                      │
   Live sensor ─────│  fao_pred_24h        │──┐
   data             │  (24h forward sim)   │  │
                    │                      │  │  predicted_depl_24h
   Features ────────│  rf_residual =       │──┤  = fao_pred + residual
   (31+1 dims)     │  RF/XGB.predict(X)   │  │
                    └──────────────────────┘  │
                                              ▼
                                   Decision: depl vs RAW
                                   → irrigation_mm → duration_seconds
```

**Tại sao hybrid?**

| Phương pháp | Ưu điểm | Nhược điểm |
|---|---|---|
| FAO-56 thuần | Có cơ sở vật lý, không cần data | Không bắt được mưa ngẫu nhiên, drift sensor |
| ML thuần | Bắt được pattern phức tạp | Cần nhiều data, không có physical constraints |
| **Hybrid** | **Vật lý xử lý ~80-90% tín hiệu, ML bổ sung** | **Phức tạp hơn nhưng robust nhất** |

### 8.4. Feature Engineering (32 features)

| Nhóm | Features | Mô tả |
|---|---|---|
| Atmospheric (4) | `temp`, `humidity`, `light`, `wind_speed` | Dữ liệu khí quyển thực tế |
| Forecast (3) | `forecast_rain_d0/d1/d2` | Lượng mưa dự báo 3 ngày |
| Soil Sensor (3) | `soil_moist_shallow`, `soil_moist_deep`, `soil_moist_trend_1h` | Độ ẩm 2 tầng + xu hướng |
| Agro-physics (2) | `etc`, `kc` | ETc hiện tại và hệ số cây trồng |
| Water Balance (2) | `raw`, `soil_moist_deficit` | RAW và thiếu hụt ẩm |
| Forward-looking (3) | `etc_cumulative_24h`, `net_water_loss_24h`, `stress_ratio` | Dự báo 24h bằng FAO-56 |
| Interaction (2) | `temp_x_humidity`, `solar_x_temp` | Tương tác phi tuyến |
| Seasonal (3) | `season_x_stress`, `season_x_rain`, `season_x_etc` | Tương tác mùa vụ |
| Cyclic Time (3) | `hour_sin`, `hour_cos`, `month_sin` | Mã hóa tuần hoàn |
| Lag 6h (3) | `depletion_trend_6h`, `rain_last_6h`, `etc_rolling_6h` | Bộ nhớ ngắn hạn |
| Cold Season (3) | `is_cold_season`, `cold_x_stress`, `cold_x_etc` | Sub-model mùa lạnh |
| Categorical (1) | `growth_stage` | Giai đoạn sinh trưởng (ordinal encoded) |

**Feature selection v2:** Loại bỏ `month_cos` (importance < 0.5%), `soil_type` (tất cả one-hot < 0.2%), `crop_type` (4/5 one-hot < 0.12% — info đã captured bởi kc, raw).

### 8.5. Model Input / Output

**Input (Inference):**

```
pd.DataFrame (1 row × 32 columns)
├── 31 numeric features → SimpleImputer(median)
└── 1 categorical (growth_stage) → OrdinalEncoder([initial, development, mid, end])
+ metadata: fao_pred_24h (không qua pipeline, dùng cho hybrid)
```

**Target (Training):**

```
residual_target = depletion_after_24h - fao_pred_24h
```

Đây là phần sai lệch mà FAO-56 không dự đoán được. RF/XGB chỉ cần học correction nhỏ này (thường < 2mm), không phải toàn bộ signal.

**Output (Inference):**

```
rf_residual (float) → predicted_depl_24h = fao_pred_24h + rf_residual
→ Decision logic → irrigation_mm (0–20 mm)
→ water_mm_to_duration_seconds() → duration (seconds)
```

### 8.6. Hyperparameter Search Space

**Random Forest:**

| Hyperparameter | Search Range |
|---|---|
| `n_estimators` | [200, 300, 400, 500] |
| `max_depth` | [6, 8, 10, 12] |
| `min_samples_leaf` | [5, 8, 12, 16] |
| `min_samples_split` | [10, 15, 20, 25] |
| `max_features` | [0.6, 0.7, 0.8, 0.9] |

**XGBoost:**

| Hyperparameter | Search Range |
|---|---|
| `n_estimators` | [200, 300, 400, 500, 600] |
| `max_depth` | [3, 4, 5, 6, 8] |
| `learning_rate` | [0.01, 0.03, 0.05, 0.1, 0.15] |
| `subsample` | [0.7, 0.8, 0.9, 1.0] |
| `colsample_bytree` | [0.6, 0.7, 0.8, 0.9, 1.0] |
| `min_child_weight` | [1, 3, 5, 7] |
| `reg_alpha` | [0.0, 0.01, 0.1, 1.0] |
| `reg_lambda` | [0.5, 1.0, 2.0, 5.0] |

**Cross-validation:** TimeSeriesSplit (5 folds) — đảm bảo không có data leakage từ tương lai.

---

## 9. Cấu trúc thư mục

```
smart_garden/
├── ai-service/                          # FastAPI AI Service
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                      # Entry point — FastAPI app
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py            # API router aggregator
│   │   │       └── endpoints/
│   │   │           ├── health.py        # GET /health
│   │   │           └── irrigation.py    # POST /ai/predict, /ai/train
│   │   ├── core/
│   │   │   ├── config.py               # Settings (pydantic-settings, .env)
│   │   │   └── logging_config.py       # Logging setup
│   │   ├── models/
│   │   │   ├── common.py               # StatusResponse schema
│   │   │   └── irrigation.py           # Request/Response Pydantic schemas
│   │   ├── services/
│   │   │   ├── anfis_service.py        # Orchestrator: preprocess → RF → post
│   │   │   ├── fao_service.py          # FAO-56 ETo, Kc, multi-layer water balance
│   │   │   ├── preprocessing_service.py # Feature engineering (32 features)
│   │   │   ├── prediction_service.py  # ML (XGB/RF) prediction + decision logic
│   │   │   ├── water_balance.py        # In-memory water balance state store
│   │   │   └── water_balance_db.py     # MySQL-backed water balance (REST API)
│   │   └── ml/
│   │       ├── pipeline_builder.py     # sklearn Pipeline: ColumnTransformer + RF/XGB
│   │       └── models/                 # Saved .joblib model files
│   │           ├── rf_v*.joblib
│   │           └── xgb_v*.joblib
│   ├── tests/
│   │   └── test_fao_hourly.py          # FAO-56 unit tests
│   ├── requirements.txt                # Python dependencies
│   ├── Dockerfile                      # Docker image (python:3.11-slim)
│   ├── docker-compose.yml              # Docker Compose config
│   ├── .env                            # Environment variables (gitignored)
│   ├── .env.example                    # Environment template
│   └── README.md                       # Tài liệu này
│
├── scripts/                             # Data generation & model training
│   ├── generate_dataset.py             # Synthetic data generation (FAO-56 simulation)
│   │                                    #   35,040 rows, 40 features, multi-location
│   ├── generate_training_dataset.py    # Quick sample dataset (1,000 rows)
│   ├── train_rf.py                     # Random Forest training script
│   │                                    #   TimeSeriesSplit, RandomizedSearchCV
│   ├── train_xgb.py                    # XGBoost training script
│   │                                    #   Gradient boosting variant
│   ├── training_dataset_1000.csv       # Sample dataset (1,000 rows × 33 cols)
│   └── sample_train.csv               # Tiny test dataset (100 rows)
│
└── data/                                # Generated training data
    └── rf_training_data.csv            # Full dataset (35,040 rows × 40 cols)
```

### Mô tả vai trò từng file

| File | Dòng code | Vai trò |
|---|---|---|
| `main.py` | ~44 | FastAPI app init, CORS, router |
| `anfis_service.py` | ~113 | Orchestrator: wires preprocess → RF → response |
| `fao_service.py` | ~501 | FAO-56 ETo (daily + hourly), Kc adjustment, multi-layer depletion |
| `preprocessing_service.py` | ~563 | Feature engineering: 32 features + 24h forward sim |
| `prediction_service.py` | ~246 | ML (XGB/RF) predict, train, confidence, decision logic |
| `pipeline_builder.py` | ~196 | sklearn Pipeline: ColumnTransformer + RF/XGB build/save/load |
| `water_balance.py` | ~218 | In-memory state store: multi-layer + lag features 6h |
| `water_balance_db.py` | ~401 | MySQL-backed store via REST API + in-memory cache |
| `generate_dataset.py` | ~877 | Synthetic data: multi-location, AR(1), FAO-56 sim |
| `train_rf.py` | ~757 | RF training: hyperparameter search, hybrid eval |
| `train_xgb.py` | ~562 | XGB training: gradient boosting variant |

---

## 10. Troubleshooting

### Server không khởi động

```
ModuleNotFoundError: No module named 'app'
```

**Nguyên nhân:** Chạy uvicorn từ sai thư mục.
**Giải pháp:**

```bash
# Phải chạy từ thư mục ai-service/
cd ai-service
uvicorn app.main:app --port 5000
```

### Model không load được

```
WARNING | No trained model found — will use stub predictions
```

**Nguyên nhân:** Chưa train model hoặc file `.joblib` không nằm đúng thư mục.
**Giải pháp:**

```bash
# Kiểm tra thư mục models
ls ai-service/app/ml/models/

# Nếu trống, train model trước
cd scripts
python train_rf.py ../data/rf_training_data.csv --out-dir ../ai-service/app/ml/models
```

### Prediction trả confidence thấp (0.4)

**Nguyên nhân:** Đang dùng stub prediction (không có model trained).
**Giải pháp:** Train model RF hoặc XGBoost. Stub prediction dùng heuristic đơn giản và luôn trả confidence = 0.4.

### Water balance state bị reset sau restart

**Nguyên nhân:** Đang dùng in-memory storage (`USE_DB_STORAGE=false`).
**Giải pháp:**

```ini
# Trong .env, bật MySQL storage
USE_DB_STORAGE=true
BACKEND_URL=http://localhost:8081/api
```

Cần backend Spring Boot đang chạy và có endpoint `/devices/{id}/water-balance-state`.

### Lỗi kết nối backend (khi USE_DB_STORAGE=true)

```
ERROR | Failed to fetch state from API for device X: ConnectError
```

**Nguyên nhân:** Backend Spring Boot chưa chạy hoặc URL sai.
**Giải pháp:**

1. Kiểm tra backend đang chạy: `curl http://localhost:8081/api`
2. Kiểm tra `BACKEND_URL` trong `.env`
3. Hệ thống sẽ tự fallback về in-memory cache

### ETo tính ra giá trị bất thường

**Nguyên nhân có thể:**

- `latitude` hoặc `altitude` không đúng (ảnh hưởng lớn đến Rn, sunrise/sunset)
- `solar_radiation` đơn vị sai (cần MJ/m²/day, không phải W/m²)
- `light` (lux) quá cao → solar radiation bất thường

**Giải pháp:** Kiểm tra log output:

```
ETo_hourly=0.185 mm/h (T=30.5 RH=65.0 ws=2.5 Rn=0.432 G=0.043 hour=14 daytime=True)
```

ETo hợp lý: 0.0–0.8 mm/h (ban ngày mùa hè nhiệt đới).

### Training dataset generation chậm

```bash
# Dùng ít mẫu hơn để test nhanh
python generate_dataset.py --n-samples 1000 --out test_data.csv

# Hoặc dùng script đơn giản
python generate_training_dataset.py
```

### XGBoost import error

```
ModuleNotFoundError: No module named 'xgboost'
```

**Giải pháp:**

```bash
pip install xgboost>=2.0
```

### Lỗi Out of Memory khi training

**Giải pháp:**

```bash
# Giảm n_jobs
python train_rf.py data.csv --n-jobs 2

# Giảm n_iter (ít hyperparameter trials hơn)
python train_rf.py data.csv --n-iter 10
```

---

## 11. Hướng phát triển

### Ngắn hạn

- [ ] **Online training endpoint**: Cho phép train từ labeled data thực tế qua API (thay vì offline scripts)
- [ ] **Model versioning UI**: Dashboard hiển thị metrics các version model, A/B testing
- [ ] **Alerting**: Cảnh báo khi confidence thấp hoặc sensor data bất thường
- [ ] **Batch prediction**: Hỗ trợ predict cho nhiều device cùng lúc

### Trung hạn

- [ ] **LSTM / Temporal Fusion Transformer**: Thay RF/XGB bằng mô hình sequence-aware cho time series
- [ ] **Auto-retraining pipeline**: Tự động retrain khi accumulate đủ data mới
- [ ] **Multi-zone support**: Một device quản lý nhiều vùng tưới với soil/crop khác nhau
- [ ] **Real weather integration**: Kết nối trực tiếp OpenWeather API thay vì nhận qua backend

### Dài hạn

- [ ] **Federated Learning**: Học từ nhiều farm mà không cần chia sẻ raw data
- [ ] **Computer Vision**: Tích hợp camera phát hiện bệnh cây, ước lượng Kc từ canopy cover
- [ ] **Digital Twin**: Mô phỏng toàn bộ farm với 3D soil moisture distribution
- [ ] **Edge AI**: Deploy model nhẹ (quantized) trực tiếp lên ESP32-S3 cho offline inference

---

## Tham khảo

- [FAO-56: Crop Evapotranspiration](https://www.fao.org/3/x0490e/x0490e06.htm) — Allen et al., 1998
- [scikit-learn Pipeline Documentation](https://scikit-learn.org/stable/modules/compose.html)
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

*Smart Garden AI Service v0.1.0 — Built with FAO-56 physics and machine learning.*
