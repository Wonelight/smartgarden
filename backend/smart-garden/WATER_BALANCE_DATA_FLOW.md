# Luồng Dữ Liệu Water Balance với MySQL Storage

## Tổng quan

Sau khi chuyển từ in-memory sang MySQL database, luồng dữ liệu hoạt động như sau:

```
ESP32 → Backend → AI Service → Backend API → MySQL Database
         ↓                              ↑
    Sensor Data                    Water Balance State
```

## Luồng Chi Tiết

### 1. **Khởi tạo Request (Backend → AI Service)**

```
Backend (AiPredictionServiceImpl)
  ↓
POST http://localhost:5000/api/v1/ai/predict
  ↓
Payload: {
  device_id: 1,
  sensors: {...},
  openweather: {...},
  crop: {...}
}
  ↓
AI Service (AnfisStubService.predict)
```

**File liên quan:**
- `backend/.../service/impl/AiPredictionServiceImpl.java`
- `ai-service/app/services/anfis_service.py`

---

### 2. **Preprocessing - Tính toán Water Balance**

```
AnfisStubService.predict()
  ↓
PreprocessingService.transform()
  ↓
[1] Tính ETo, ETc (FAO-56)
[2] Tính TAW/RAW cho shallow & deep layers
[3] LẤY STATE HIỆN TẠI từ database
```

**Bước 3 - Lấy State từ Database:**

```python
# ai-service/app/services/preprocessing_service.py:183
wb_state = self.wb.get_state(request.device_id)
```

**Nếu USE_DB_STORAGE=true:**

```
water_balance_store.get_state(device_id)
  ↓
[Kiểm tra cache in-memory]
  ↓ (nếu không có trong cache)
GET http://localhost:8081/api/devices/{deviceId}/water-balance-state
  ↓
Backend (WaterBalanceStateController.getState)
  ↓
WaterBalanceStateService.getState()
  ↓
DeviceWaterBalanceStateRepository.findByDeviceId()
  ↓
MySQL: SELECT * FROM device_water_balance_state WHERE device_id = ?
  ↓
[Trả về state hoặc tạo mới nếu chưa có]
  ↓
Response: {
  shallowDepletion: 5.2,
  deepDepletion: 8.1,
  shallowTaw: 20.0,
  deepTaw: 30.0,
  ...
}
```

**File liên quan:**
- `ai-service/app/services/water_balance_db.py` (method `get_state()`)
- `backend/.../controller/WaterBalanceStateController.java`
- `backend/.../service/impl/WaterBalanceStateServiceImpl.java`

---

### 3. **Tính toán Depletion mới**

```python
# ai-service/app/services/preprocessing_service.py:205-223
# Sử dụng state cũ để tính depletion mới

new_shallow_depl = calculate_layer_depletion(
    prev_depletion=wb_state.shallow.depletion,  # Từ database
    etc=etc_shallow,
    effective_rain=rain_shallow,
    irrigation=irr_shallow,
    soil_moisture_pct=soil_shallow,
    ...
)

new_deep_depl = calculate_layer_depletion(
    prev_depletion=wb_state.deep.depletion,  # Từ database
    etc=etc_deep,
    ...
)
```

---

### 4. **Cập nhật State vào Database**

```python
# ai-service/app/services/preprocessing_service.py:229-238
self.wb.update_state(
    device_id=request.device_id,
    shallow_depletion=new_shallow_depl,
    deep_depletion=new_deep_depl,
    shallow_taw=shallow_taw,
    deep_taw=deep_taw,
    shallow_raw=shallow_raw,
    deep_raw=deep_raw,
    soil_moist_avg=soil_avg,
)
```

**Luồng cập nhật:**

```
water_balance_store.update_state(...)
  ↓
[1] Cập nhật cache in-memory ngay lập tức (non-blocking)
  ↓
[2] Gọi API để sync với database (background)
  ↓
PUT http://localhost:8081/api/devices/{deviceId}/water-balance-state
  ↓
Payload: {
  shallowDepletion: 5.2,
  deepDepletion: 8.1,
  shallowTaw: 20.0,
  deepTaw: 30.0,
  shallowRaw: 10.0,
  deepRaw: 15.0,
  lastIrrigation: 5.0,
  soilMoisAvg: 45.5,
  soilMoisHistory: [
    {"timestamp": "2024-01-01T10:00:00", "value": 45.5}
  ]
}
  ↓
Backend (WaterBalanceStateController.updateState)
  ↓
WaterBalanceStateService.updateState()
  ↓
[1] Tìm state hiện tại hoặc tạo mới
[2] Cập nhật các giá trị
[3] Xử lý soil moisture history (limit TREND_WINDOW=6)
  ↓
DeviceWaterBalanceStateRepository.save()
  ↓
MySQL: UPDATE device_water_balance_state SET ... WHERE device_id = ?
  ↓
Response: Updated state
```

**File liên quan:**
- `ai-service/app/services/water_balance_db.py` (method `update_state()`)
- `backend/.../service/impl/WaterBalanceStateServiceImpl.java` (method `updateState()`)

---

### 5. **Tính Soil Moisture Trend**

```python
# ai-service/app/services/preprocessing_service.py:241
soil_trend = self.wb.get_soil_moist_trend(request.device_id)
```

**Luồng:**

```
get_soil_moist_trend(device_id)
  ↓
[Lấy state từ cache hoặc database]
  ↓
[Tính toán từ soil_mois_history]
  ↓
trend = (newest_val - oldest_val) / elapsed_hours
```

**Hoặc từ Backend:**

```
Backend tính trend trong WaterBalanceStateServiceImpl.calculateSoilMoisTrend()
  ↓
Trả về trong response
```

---

### 6. **Hoàn thành Prediction**

```
PreprocessingService.transform() → DataFrame với features
  ↓
PredictionService.predict() → water_mm, confidence
  ↓
Post-processing (check depletion threshold)
  ↓
AiPredictResponse → Trả về cho Backend
```

---

## So sánh: In-Memory vs Database Storage

### **In-Memory (Cũ)**
```
Request → Get state từ RAM → Update RAM → Return
         ↑                                    ↓
    [Mất dữ liệu khi restart]          [Không persist]
```

### **Database Storage (Mới)**
```
Request → Get state từ DB → Update DB → Return
         ↑                      ↓
    [Persistent]          [Lưu vĩnh viễn]
         ↑                      ↓
    [Có cache]            [Có backup]
```

## Điểm Quan Trọng

### 1. **Cache Layer**
- AI service vẫn giữ cache in-memory để tăng tốc
- Cache được sync với database trong background
- Nếu API lỗi → fallback về cache

### 2. **Non-blocking Updates**
- `update_state()` cập nhật cache ngay lập tức
- Sync với database chạy background (không block request)

### 3. **State Initialization**
- Nếu device chưa có state → tự động tạo với giá trị mặc định
- Giá trị mặc định: tất cả = 0.0

### 4. **Soil Moisture History**
- Lưu tối đa 6 readings (TREND_WINDOW)
- Format JSON: `[{"timestamp": "...", "value": 45.5}, ...]`
- Tự động trim khi vượt quá limit

## Sequence Diagram

```
ESP32          Backend          AI Service         MySQL DB
  │               │                  │                │
  │──sensor data─>│                  │                │
  │               │──predict req───> │                │
  │               │                  │                │
  │               │                  │──get state───> │
  │               │                  │<──state─────── │
  │               │                  │                │
  │               │                  │[calculate]     │
  │               │                  │                │
  │               │                  │──update──────> │
  │               │                  │<──updated───── │
  │               │                  │                │
  │               │<──prediction────│                │
  │               │                  │                │
```

## Lợi ích của Luồng Mới

1. **Persistence**: State không mất khi restart service
2. **Scalability**: Nhiều AI service instances có thể share cùng state
3. **Monitoring**: Query state từ database để phân tích
4. **Reliability**: Fallback về cache nếu API lỗi
5. **Consistency**: State được đồng bộ giữa các instances

## Troubleshooting

### Nếu API không khả dụng:
- AI service tự động fallback về in-memory cache
- Logs sẽ cảnh báo: `"Failed to fetch state from API"`
- Prediction vẫn hoạt động nhưng không persist

### Nếu database lỗi:
- Backend trả về error
- AI service fallback về cache
- State được lưu trong cache cho đến khi database khôi phục
