# Hướng dẫn loại bỏ code legacy (water balance store)

Sau khi **backend luôn gửi `water_balance`** trong request predict và AI đã dùng nhánh stateless, có thể thu gọn hoặc xóa code cũ theo từng bước.

---

## Trạng thái hiện tại

- **Preprocessing**: Nếu `request.water_balance` có → dùng snapshot (stateless), không gọi store. Nếu không có → fallback store (get_state / update_state).
- **Backend**: Đã gửi `water_balance` trong payload; có thể persist `updated_water_balance` từ response khi AI trả về.

---

## Code có thể loại bỏ / thu gọn (khi đã chắc backend luôn gửi water_balance)

### 1. Không xóa ngay — giữ fallback

- **Lý do**: Gọi predict cũ (không có `water_balance`) vẫn hoạt động.
- **Khi nào xóa**: Sau khi mọi client (backend, job, test) đều gửi `water_balance` và không còn nhu cầu tương thích ngược.

---

### 2. Có thể loại bỏ sau khi migration xong

| Vị trí | Nội dung | Ghi chú |
|--------|----------|--------|
| `app/services/water_balance_db.py` | `WaterBalanceStore`: `_fetch_state`, `get_state_async`, `_update_state_api`, `update_state` (gọi PUT backend), `httpx.AsyncClient`, `backend_url` | Khi AI không còn GET/PUT backend: xóa toàn bộ HTTP client và logic sync DB. |
| `app/services/water_balance_db.py` | In-memory cache `_cache`, `get_state()` trả từ cache, `update_state()` cập nhật cache + async PUT | Có thể thay bằng class nhỏ chỉ build state từ `WaterBalanceSnapshot` (không cache, không HTTP). |
| `app/services/preprocessing_service.py` | Nhánh `else` (khi không có `request.water_balance`): `self.wb.get_state()`, `self.wb.update_state()`, `self.wb.get_soil_moist_trend()`, `get_depletion_trend_6h`, … | Xóa khi chấp nhận request luôn có `water_balance`. |
| `app/services/water_balance.py` | `water_balance_store = WaterBalanceStore()` (instance toàn cục) | Khi không còn consumer dùng store: xóa hoặc thay bằng stub. |
| `app/core/config.py` | `BACKEND_URL` (dùng cho water balance GET/PUT) | Có thể giữ nếu còn API khác gọi backend; nếu chỉ dùng cho water balance thì có thể bỏ. |

---

### 3. Giữ lại (không xóa)

| Vị trí | Lý do |
|--------|--------|
| `app/services/water_balance_db.py` | `WaterBalanceState`, `LayerState`, `compute_effective_rain`, các helper `_lag_trend`, `_lag_sum`, `_lag_mean` | Dùng trong preprocessing (tính depletion, lag). Có thể tách sang module `water_balance_math.py` nếu bỏ hết store. |
| `app/models/irrigation.py` | `WaterBalanceSnapshot`, `SoilMoisHistoryEntry`, `AiPredictRequest.water_balance` | Contract stateless. |
| `app/services/preprocessing_service.py` | `_state_from_snapshot`, `_soil_trend_from_snapshot`, nhánh `if use_snapshot` | Luồng stateless chính. |

---

## Thứ tự thực hiện gợi ý

1. **Bước 1**: Đảm bảo backend luôn gửi `water_balance` và AI trả `updated_water_balance` (nếu cần); kiểm tra production không còn request thiếu `water_balance`.
2. **Bước 2**: Trong preprocessing, xóa nhánh `else` (fallback store): luôn dùng `request.water_balance`, nếu `None` thì dùng default (hoặc trả lỗi).
3. **Bước 3**: Trong `water_balance_db.py`, xóa: `WaterBalanceStore` (hoặc bỏ hết phần HTTP + cache), giữ lại dataclass `WaterBalanceState`/`LayerState`, `compute_effective_rain`, và các hàm lag nếu vẫn dùng.
4. **Bước 4**: Cập nhật `water_balance.py`: bỏ export `WaterBalanceStore`, `water_balance_store`; cập nhật import trong preprocessing (nếu vẫn cần chỉ `WaterBalanceState`/`LayerState` từ một module chung).
5. **Bước 5** (tuỳ chọn): Xóa hoặc không dùng `BACKEND_URL` trong ai-service nếu không còn gọi backend từ water balance.

---

## Tóm tắt

- **Không bắt buộc xóa ngay**: Giữ fallback store cho đến khi chắc mọi request đều có `water_balance`.
- **Có thể xóa sau**: Toàn bộ logic GET/PUT backend và in-memory cache trong `WaterBalanceStore`; nhánh fallback trong preprocessing; biến toàn cục `water_balance_store`.
- **Luôn giữ**: Contract `WaterBalanceSnapshot`, helper build state từ snapshot, và các kiểu/hàm tính toán (state, lag, effective rain) dùng trong stateless path.
