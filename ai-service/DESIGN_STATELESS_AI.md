# Thiết kế AI Service stateless — Backend gửi đủ data trong payload predict

## 1. Kết luận ngắn

- **Nên** thiết kế để backend gửi **đủ dữ liệu dùng cho predict** trong payload (gồm water balance snapshot), thay vì để AI phải request lại backend để GET state.
- Việc lưu state trong memory ở AI service **tiềm ẩn nhiều rủi ro** khi scale; chuyển sang stateless (backend gửi + nhận state) là hướng nên làm.

---

## 2. Rủi ro khi lưu state trong memory (water_balance_db)

| Rủi ro | Mô tả |
|--------|--------|
| **Mất state khi restart** | AI restart → cache trống → predict dùng default state, sai lệch đến khi “ấm” lại. |
| **Multi-instance không nhất quán** | Nhiều replica AI → mỗi instance một cache khác nhau → cùng device_id có state khác nhau tùy instance. |
| **Tăng độ trễ & phụ thuộc** | Nếu dùng GET từ backend trước predict: thêm round-trip, backend down/trễ thì predict chậu hoặc lỗi. |
| **Memory growth** | Số device lớn × (state + history 24h) → RAM tăng, khó scale ngang. |
| **Khó debug / audit** | Nguồn sự thật (source of truth) nằm rải rác: DB (sau PUT) + cache từng instance. |

---

## 3. Hướng thiết kế đề xuất: Backend gửi đủ data trong payload

### Nguyên tắc

- **Backend** là nơi duy nhất lưu state (DB). Mỗi lần cần predict, backend **gửi kèm** water balance (và nếu cần lag features) trong request.
- **AI service** không GET state, không giữ cache state lâu dài; có thể trả về **state mới sau predict** trong response để backend persist một lần.

### Luồng mới (stateless)

```
Backend (có state trong DB)
    │
    │  POST /ai/predict
    │  Body: device_id, sensor_data_id, sensors, openweather, crop, water_balance
    ▼
AI Service
    │  Dùng request.water_balance để tính features → predict
    │  (Không gọi GET backend, không update cache persistent)
    │  Trả response kèm updated_state (optional) để backend lưu
    ▼
Backend nhận response → lưu state mới vào DB (một nguồn sự thật)
```

### Payload request (đã thêm vào contract)

- **water_balance** (optional): snapshot state tại thời điểm backend gọi predict.
  - Base: `shallow_depletion`, `deep_depletion`, `shallow_taw`, `deep_taw`, `shallow_raw`, `deep_raw`, `last_irrigation`, `last_updated`, `soil_moist_history`.
  - Tuỳ chọn: lag features (`depletion_trend_6h`, `rain_last_6h`, …) nếu backend đã tính sẵn để giảm logic trùng lặp hoặc giảm kích thước history gửi đi.

Schema Pydantic: `WaterBalanceSnapshot` (và `SoilMoisHistoryEntry`) trong `app/models/irrigation.py`.

### Payload response (gợi ý mở rộng)

- Thêm field optional, ví dụ: `updated_water_balance: Optional[WaterBalanceSnapshot]`.
- Backend sau predict sẽ lưu `updated_water_balance` vào DB thay vì để AI gọi PUT riêng. Như vậy AI không cần gọi lại backend để lưu state.

---

## 4. Lợi ích

- **AI stateless**: không cache state → scale ngang nhiều instance, restart không mất state.
- **Một nguồn sự thật**: chỉ backend/DB giữ state; dễ audit, debug, replay.
- **Giảm phụ thuộc**: AI không cần gọi GET (và có thể bỏ PUT) tới backend trong luồng predict.
- **Đồng bộ rõ ràng**: state luôn đúng với DB tại thời điểm backend gửi request.

---

## 5. Migration (thực hiện dần)

1. **Backend**: Khi gọi `/ai/predict`, đọc state từ DB (water-balance cho device_id), serialize vào `water_balance` trong body. (Có thể thêm lag features sau.)
2. **AI**:  
   - Nếu `request.water_balance` có: dùng trực tiếp để build features (preprocessing không gọi `water_balance_store.get_state()`); không gọi GET/PUT.  
   - Nếu không có (legacy): fallback như hiện tại (get_state/update_state + cache, có thể vẫn PUT backend).
3. **Response**: (Tuỳ chọn) AI tính state sau predict, trả về `updated_water_balance`; backend lưu vào DB và không cần AI gọi PUT.
4. **Bước cuối**: Khi mọi client đã gửi `water_balance`, có thể bỏ hoặc thu nhỏ `WaterBalanceStore` (chỉ dùng cho fallback hoặc tool nội bộ).

---

## 6. File liên quan

- `app/models/irrigation.py`: `WaterBalanceSnapshot`, `SoilMoisHistoryEntry`, `AiPredictRequest.water_balance`.
- `app/services/preprocessing_service.py`: cần nhánh “nếu request.water_balance có thì dùng snapshot, else fallback store”.
- `app/services/water_balance_db.py`: giữ cho legacy/fallback; sau có thể chỉ dùng khi không có `water_balance` trong request.
