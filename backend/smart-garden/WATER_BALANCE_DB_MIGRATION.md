# Water Balance Database Migration Guide

## Tổng quan

Hệ thống đã được nâng cấp từ lưu trữ in-memory (RAM) sang lưu trữ persistent trên MySQL database cho Water Balance State.

## Thay đổi

### Backend (Java/Spring Boot)

1. **Migration SQL**: `V3__device_water_balance_state.sql`
   - Tạo bảng `device_water_balance_state` để lưu trữ state theo device_id
   - Hỗ trợ multi-layer (shallow + deep) với các trường: depletion, TAW, RAW
   - Lưu trữ lịch sử độ ẩm đất dưới dạng JSON

2. **Entity**: `DeviceWaterBalanceState.java`
   - JPA entity mapping với bảng database
   - Computed properties: weightedDepletion, totalTaw, totalRaw

3. **Repository**: `DeviceWaterBalanceStateRepository.java`
   - CRUD operations cho water balance state

4. **Service**: `WaterBalanceStateService` và `WaterBalanceStateServiceImpl`
   - Business logic để quản lý state
   - Tính toán soil moisture trend từ history

5. **Controller**: `WaterBalanceStateController.java`
   - REST API endpoints:
     - `GET /api/devices/{deviceId}/water-balance-state` - Lấy state
     - `PUT /api/devices/{deviceId}/water-balance-state` - Cập nhật state

### AI Service (Python)

1. **Module mới**: `water_balance_db.py`
   - HTTP client để gọi REST API từ backend
   - Hỗ trợ cả synchronous và asynchronous operations
   - Fallback về in-memory cache nếu API không khả dụng

2. **Module cập nhật**: `water_balance.py`
   - Thêm feature flag `USE_DB_STORAGE` để chọn storage mode
   - Tự động load DB-backed store nếu flag được bật

## Cách sử dụng

### Kích hoạt Database Storage

1. **Backend**: Migration sẽ tự động chạy khi khởi động ứng dụng (Flyway)

2. **AI Service**: Set environment variable:
   ```bash
   export USE_DB_STORAGE=true
   ```
   Hoặc trong `.env` file:
   ```
   USE_DB_STORAGE=true
   ```

### API Endpoints

#### Lấy Water Balance State
```http
GET /api/devices/{deviceId}/water-balance-state
```

Response:
```json
{
  "success": true,
  "data": {
    "deviceId": 1,
    "shallowDepletion": 5.2,
    "deepDepletion": 8.1,
    "shallowTaw": 20.0,
    "deepTaw": 30.0,
    "shallowRaw": 10.0,
    "deepRaw": 15.0,
    "weightedDepletion": 7.06,
    "totalTaw": 50.0,
    "totalRaw": 25.0,
    "lastIrrigation": 5.0,
    "soilMoisHistory": [
      {"timestamp": "2024-01-01T10:00:00", "value": 45.5}
    ],
    "soilMoisTrend": 0.5,
    "lastUpdated": "2024-01-01T10:00:00"
  }
}
```

#### Cập nhật Water Balance State
```http
PUT /api/devices/{deviceId}/water-balance-state
Content-Type: application/json

{
  "shallowDepletion": 5.2,
  "deepDepletion": 8.1,
  "shallowTaw": 20.0,
  "deepTaw": 30.0,
  "shallowRaw": 10.0,
  "deepRaw": 15.0,
  "lastIrrigation": 5.0,
  "soilMoisAvg": 45.5,
  "soilMoisHistory": [
    {"timestamp": "2024-01-01T10:00:00", "value": 45.5}
  ]
}
```

## Lợi ích

1. **Persistence**: State được lưu trữ vĩnh viễn, không mất khi restart
2. **Scalability**: Có thể scale horizontal với nhiều AI service instances
3. **Monitoring**: Có thể query và phân tích state từ database
4. **Backup**: Dễ dàng backup và restore state

## Fallback Behavior

- Nếu API không khả dụng, AI service sẽ fallback về in-memory cache
- State vẫn hoạt động bình thường nhưng không được persist
- Logs sẽ cảnh báo khi fallback xảy ra

## Migration Notes

- Migration tự động chạy khi backend khởi động
- Không cần migrate dữ liệu từ in-memory (state sẽ được tạo mới khi cần)
- Có thể rollback bằng cách set `USE_DB_STORAGE=false` trong AI service
