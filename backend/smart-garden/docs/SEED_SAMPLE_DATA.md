# Dữ liệu mẫu ~1k bản ghi

Để hệ thống chạy được predict (AI, dashboard) khi chưa có dữ liệu thật, có thể import dữ liệu mẫu theo một trong hai cách sau.

## 1. Flyway migration (khuyến nghị)

Migration **V6__seed_sample_data.sql** tự chạy khi ứng dụng khởi động (nếu Flyway bật):

- **1 device**: SG-001, Vườn mẫu Hà Nội, location=Hanoi, có latitude/longitude/altitude.
- **~1000 sensor_data**: 10 phút/lần, ~7 ngày, có temperature, humidity, soil_moisture, light, rain_detected.
- **weather_data**: 1 bản ghi cho location Hanoi.
- **daily_weather_forecast**: 3 ngày cho Hanoi.
- **crop_season**: ACTIVE, Lúa + Đất thịt (dùng crop_library/soil_library đã seed ở V2).
- **device_water_balance_state**: state mặc định cho device.
- **irrigation_config**: ai_enabled=1 để gọi predict.

Điều kiện:

- Bảng `devices`, `sensor_data`, `weather_data`, `crop_library`, `soil_library`, `crop_season`, `device_water_balance_state`, `irrigation_config`, `daily_weather_forecast` đã tồn tại (schema từ Hibernate hoặc migration trước).
- Seed chỉ chạy khi chưa có device nào (điều kiện `WHERE NOT EXISTS`).

Sau khi seed, có thể gọi API predict với `deviceId=1` (hoặc id device vừa tạo) và `sensorDataId` là id một bản ghi sensor_data bất kỳ.

## 2. Script Python (sinh file SQL)

Khi không dùng Flyway hoặc muốn tái sinh dữ liệu:

```bash
# Từ repo root
python scripts/seed_sample_data.py --out data/seed_sample.sql --records 1000
```

Sinh file SQL chứa:

- 1 device + ~1000 sensor_data + weather + daily_forecast + crop_season + water_balance + irrigation_config.

Chạy vào DB (cần có sẵn schema và seed V2 cho crop_library/soil_library):

```bash
mysql -u user -p your_database < data/seed_sample.sql
```

Lưu ý: Script chèn device trước rồi dùng `LAST_INSERT_ID()` cho các bảng còn lại; cần chạy trong cùng một session (một file SQL).

## 3. Sinh dataset cho train ML (không phải import DB)

Script **scripts/generate_dataset.py** sinh file CSV cho train mô hình (train_rf.py, train_xgb.py), **không** ghi vào DB:

```bash
python scripts/generate_dataset.py --n-samples 1000 --out data/rf_training_data.csv
```

File CSV đó dùng để train model, không dùng để import vào database backend.
