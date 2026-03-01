# Backend: Single Source of Truth (Water Balance State)

## Nguyên tắc

**Backend là nơi duy nhất lưu và phát hành water balance state.**  
State được lưu trong DB (`device_water_balance_state`); AI service không giữ state lâu dài và không ghi trực tiếp vào DB. Mọi cập nhật state sau predict đều do backend thực hiện.

---

## Luồng dữ liệu

```
                    ┌─────────────────────────────────────────┐
                    │  Backend (Single Source of Truth)         │
                    │  - DB: device_water_balance_state         │
                    │  - WaterBalanceStateService.getState()    │
                    │  - WaterBalanceStateService.updateState() │
                    └──────────────────┬──────────────────────┘
                                       │
    1. Predict request                 │ 2. Gửi payload (có water_balance từ DB)
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  AI Service (Stateless)                  │
                    │  - Nhận water_balance trong request      │
                    │  - Không GET state từ backend            │
                    │  - Có thể trả updated_water_balance     │
                    └──────────────────┬──────────────────────┘
                                       │
    3. Response (predicted_duration,   │ 4. Optional: updated_water_balance
       optional updated_water_balance) │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │  Backend                                 │
                    │  - Lưu MlPrediction                       │
                    │  - Nếu có updated_water_balance →        │
                    │    updateState(deviceId, ...)            │
                    │  - Chỉ backend ghi vào DB                │
                    └─────────────────────────────────────────┘
```

---

## Triển khai hiện tại

### 1. Backend gửi `water_balance` trong request predict

- Trong `AiPredictionServiceImpl.predict()`:
  - Gọi `waterBalanceStateService.getState(deviceId)` — đọc từ DB (single source of truth).
  - `buildWaterBalancePayload(response)` chuyển sang snake_case cho contract Python.
  - `payload.put("water_balance", ...)` trước khi gọi AI.

- AI service nhận đủ dữ liệu trong request, không cần gọi GET `/devices/{id}/water-balance-state`.

### 2. Backend persist state từ AI response (khi có)

- Nếu AI trả về `updated_water_balance` trong response:
  - `persistUpdatedWaterBalanceFromResponse(deviceId, pythonResponse)` parse và gọi `waterBalanceStateService.updateState(deviceId, request)`.
  - Chỉ backend ghi vào DB; AI không gọi PUT về backend.

- Nếu AI chưa trả về `updated_water_balance`: bỏ qua, không lỗi (tương thích ngược).

### 3. API hiện có

- **GET** `/api/devices/{deviceId}/water-balance-state`: đọc state (cho monitoring, debug).
- **PUT** `/api/devices/{deviceId}/water-balance-state`: cập nhật state (gọi từ backend nội bộ sau khi nhận `updated_water_balance` từ AI, hoặc từ job/tool khác).  
  AI service có thể **ngừng** gọi PUT này khi đã chuyển sang trả state trong response và backend đã persist.

---

## Lợi ích

- **Một nguồn sự thật**: state chỉ ở DB, dễ audit và replay.
- **AI stateless**: scale ngang, restart không mất state.
- **Đồng bộ rõ ràng**: mỗi request predict dùng state tại thời điểm backend gửi.
- **Giảm phụ thuộc**: AI không phụ thuộc GET/PUT backend trong luồng predict.

---

## File liên quan

- `AiPredictionServiceImpl`: `buildWaterBalancePayload()`, `persistUpdatedWaterBalanceFromResponse()`, inject `WaterBalanceStateService`.
- `WaterBalanceStateService` / `WaterBalanceStateServiceImpl`: getState (từ DB), updateState (ghi DB).
- `DeviceWaterBalanceState` (entity), `WaterBalanceStateResponse`, `UpdateWaterBalanceStateRequest`.
