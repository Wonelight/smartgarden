# Các Khái Niệm FAO-56 trong Water Balance

## Tổng quan

Hệ thống sử dụng **FAO-56 (Food and Agriculture Organization Paper No. 56)** - tiêu chuẩn quốc tế để tính toán nhu cầu nước cho cây trồng. Tài liệu này giải thích các khái niệm cốt lõi.

---

## 1. DEPLETION (DC) - Lượng Nước Thiếu Hụt

### Định nghĩa FAO-56

**Depletion (DC)** là lượng nước đã bị mất đi từ vùng rễ cây do:
- **ETc (Crop Evapotranspiration)**: Cây hút nước và bay hơi
- **Trừ đi**: Mưa hiệu quả và lượng tưới

### Công thức FAO-56

```
DC(i) = DC(i-1) + ETc - Rain_effective - Irrigation
```

Trong đó:
- `DC(i-1)`: Depletion ngày hôm trước (mm)
- `ETc`: Lượng nước cây cần (mm/day hoặc mm/hour)
- `Rain_effective`: Mưa hiệu quả (mm)
- `Irrigation`: Lượng tưới (mm)

### Ví dụ

```
Ngày 1: DC = 0 mm (đất đầy nước)
Ngày 2: ETc = 5mm, Rain = 2mm, Irrigation = 0mm
        → DC = 0 + 5 - 2 - 0 = 3 mm
Ngày 3: ETc = 5mm, Rain = 0mm, Irrigation = 0mm
        → DC = 3 + 5 - 0 - 0 = 8 mm
```

### Ý nghĩa

- **DC = 0**: Đất đầy nước (Field Capacity)
- **DC tăng**: Đất khô dần
- **DC = TAW**: Đất khô hoàn toàn (Wilting Point)

### Trong hệ thống

```python
# ai-service/app/services/fao_service.py:425
def calculate_layer_depletion(
    prev_depletion: float,  # DC(i-1)
    etc: float,             # ETc
    effective_rain: float,  # Rain_effective
    irrigation: float,       # Irrigation
    ...
) -> float:
    calc_depletion = max(0.0, prev_depletion + etc - effective_rain - irrigation)
```

**Đặc biệt**: Hệ thống kết hợp với sensor để điều chỉnh:
- Nếu sensor đo độ ẩm cao → giảm depletion
- Nếu sensor đo độ ẩm thấp → tăng depletion

---

## 2. SHALLOW và DEEP LAYERS - Phân Tầng Đất

### Tại sao phân tầng?

Trong thực tế, rễ cây không hút nước đều ở mọi độ sâu:
- **Tầng nông (Shallow)**: Rễ hút nhiều nước hơn, dễ khô
- **Tầng sâu (Deep)**: Rễ hút ít hơn, giữ nước lâu hơn

### Hai loại tỷ lệ — không nhầm lẫn

| Khái niệm | Tỷ lệ | Ý nghĩa |
|-----------|--------|---------|
| **TAW (dung tích tầng)** | Shallow 40%, Deep 60% | Hình học vùng rễ: 40% độ sâu = tầng nông, 60% = tầng sâu. Quyết định *sức chứa* (mm) mỗi tầng. |
| **Thẩm thấu (mưa / tưới)** | Shallow 70%, Deep 30% | Nước từ trên xuống: bề mặt ướt trước, ít thấm xuống sâu. *Cùng cơ chế* nên mưa và tưới dùng chung 70-30. |

TAW 40-60 **không** mô tả “70% nước vào tầng nông” — nó chỉ nói tầng nông chiếm 40% dung tích. Phân bổ nước *vào* từng tầng khi mưa/tưới là tỷ lệ thẩm thấu 70-30.

### Tỷ lệ phân chia trong hệ thống

```python
# ai-service/app/services/fao_service.py
SHALLOW_LAYER_RATIO = 0.4  # Top 40% của vùng rễ → 40% TAW
DEEP_LAYER_RATIO = 0.6     # Bottom 60% của vùng rễ → 60% TAW
```

### Ví dụ

Nếu root_depth = 0.5m (500mm):
- **Shallow layer**: 0 - 200mm (40% × 500mm)
- **Deep layer**: 200 - 500mm (60% × 500mm)

### ETc phân chia

```python
# ai-service/app/services/preprocessing_service.py:192-194
etc_shallow = etc * 0.4  # Shallow layer nhận 40% ETc
etc_deep = etc * 0.6     # Deep layer nhận 60% ETc
```

**Lý do**: Tầng sâu có nhiều rễ hơn nên hút nhiều nước hơn.

### Mưa và tưới phân chia — tỷ lệ thẩm thấu theo loại đất

```python
# Tỷ lệ theo loại đất: SoilLibrary.infiltration_shallow_ratio (mặc định 0.70)
inf_shallow = c.infiltration_shallow_ratio or INFILTRATION_SHALLOW_RATIO  # clamp 0.2–0.9
inf_deep = 1.0 - inf_shallow
rain_shallow = effective_rain * inf_shallow
rain_deep = effective_rain * inf_deep
irr_shallow = irrigation * inf_shallow
irr_deep = irrigation * inf_deep
```

**Theo loại đất (V4):** Đất cát 0.55, cát pha 0.60, thịt 0.70, thịt pha sét 0.75, sét 0.80, phù sa 0.70. Mưa và tưới dùng chung tỷ lệ; tỷ lệ thay đổi theo SoilLibrary, không set cứng.

**Tại sao mưa và tưới cùng 70-30?**

- **TAW 40-60** mô tả **dung tích** từng tầng (hình học vùng rễ): tầng nông = 40% độ sâu, tầng sâu = 60%. Đây không phải tỷ lệ nước “rơi vào” từng tầng.
- **Mưa và tưới** đều là nước từ trên xuống (bề mặt ướt trước, sau đó thẩm thấu). Cùng cơ chế thẩm thấu nên dùng chung một tỷ lệ: phần lớn làm ướt tầng nông (70%), phần ít hơn thấm xuống tầng sâu (30%). Hệ thống áp dụng **cùng tỷ lệ 70-30 cho cả mưa và tưới** để nhất quán với vật lý thẩm thấu.

### Depletion Weighted

```python
# ai-service/app/services/water_balance.py:46-48
weighted_depletion = 0.6 * deep_depletion + 0.4 * shallow_depletion
```

**Lý do**: Tầng sâu quan trọng hơn (60% weight) vì có nhiều rễ hơn.

---

## 3. TAW (Total Available Water) - Tổng Lượng Nước Khả Dụng

### Định nghĩa FAO-56

**TAW** là tổng lượng nước mà đất có thể giữ và cây có thể hút được, tính từ **Field Capacity (FC)** đến **Wilting Point (WP)**.

### Công thức FAO-56

```
TAW = 1000 × (FC - WP) × root_depth
```

Trong đó:
- **FC (Field Capacity)**: Độ ẩm đất khi đầy nước (%)
- **WP (Wilting Point)**: Độ ẩm đất khi cây héo (%)
- **root_depth**: Độ sâu vùng rễ (m)
- **1000**: Hệ số chuyển đổi (m → mm)

### Ví dụ

```
FC = 30% (đất thịt)
WP = 15% (đất thịt)
root_depth = 0.5m

TAW = 1000 × (0.30 - 0.15) × 0.5
    = 1000 × 0.15 × 0.5
    = 75 mm
```

### TAW cho từng tầng

```python
# ai-service/app/services/fao_service.py:352-366
def calculate_layer_taw(
    field_capacity: float,
    wilting_point: float,
    root_depth: float,
    layer_ratio: float,  # 0.4 cho shallow, 0.6 cho deep
) -> float:
    TAW_layer = 1000 × (FC - WP) × root_depth × layer_ratio
```

**Ví dụ**:
- Shallow TAW = 75 × 0.4 = **30 mm**
- Deep TAW = 75 × 0.6 = **45 mm**
- Total TAW = 30 + 45 = **75 mm**

### Ý nghĩa

- **TAW = 0**: Đất không giữ được nước (cát thuần)
- **TAW lớn**: Đất giữ nhiều nước (sét)
- **Depletion ≤ TAW**: Luôn đúng (đất không thể khô hơn WP)

---

## 4. RAW (Readily Available Water) - Lượng Nước Dễ Hấp Thụ

### Định nghĩa FAO-56

**RAW** là lượng nước mà cây có thể hút **dễ dàng** mà không bị stress. Đây là ngưỡng để quyết định **khi nào cần tưới**.

### Công thức FAO-56

```
RAW = p × TAW
```

Trong đó:
- **p (depletion fraction)**: Hệ số cạn kiệt cho phép (0.2 - 0.6)
- **TAW**: Total Available Water

### Hệ số p (depletion fraction)

Giá trị p phụ thuộc vào loại cây:
- **Cây nhạy cảm với khô hạn**: p = 0.2 - 0.3 (tưới sớm)
- **Cây chịu hạn tốt**: p = 0.5 - 0.6 (tưới muộn)

**Ví dụ từ FAO-56**:
- Lúa: p = 0.20 (nhạy cảm)
- Ngô: p = 0.55 (chịu hạn tốt)
- Cà chua: p = 0.40 (trung bình)

### Ví dụ

```
TAW = 75 mm
p = 0.5 (cây trung bình)

RAW = 0.5 × 75 = 37.5 mm
```

### RAW cho từng tầng

```python
# ai-service/app/services/fao_service.py:386-387
shallow_raw = shallow_taw * depletion_fraction
deep_raw = deep_taw * depletion_fraction
```

**Ví dụ**:
- Shallow RAW = 30 × 0.5 = **15 mm**
- Deep RAW = 45 × 0.5 = **22.5 mm**
- Total RAW = 15 + 22.5 = **37.5 mm**

### Quy tắc tưới FAO-56

```
Nếu Depletion < RAW → KHÔNG cần tưới (đất còn đủ nước)
Nếu Depletion ≥ RAW → CẦN tưới (đất đã khô)
```

### Trong hệ thống

```python
# ai-service/app/services/anfis_service.py:52-58
if raw > 0 and depletion < 0.5 * raw:
    water_mm = 0.0
    logger.info("Depletion %.1f < 50%% RAW (%.1f) → skipping irrigation")
```

**Lưu ý**: Hệ thống sử dụng **50% RAW** làm ngưỡng để an toàn hơn.

---

## 5. Mối Quan Hệ Giữa Các Khái Niệm

### Sơ đồ tổng quan

```
┌─────────────────────────────────────────┐
│         FIELD CAPACITY (FC)            │ ← Đất đầy nước
│              Depletion = 0              │
├─────────────────────────────────────────┤
│                                         │
│              TAW (Total)                │ ← Tổng nước khả dụng
│                                         │
├─────────────────────────────────────────┤
│              RAW (Readily)              │ ← Ngưỡng tưới
├─────────────────────────────────────────┤
│                                         │
│         Depletion tăng dần              │ ← Đất khô dần
│                                         │
├─────────────────────────────────────────┤
│         WILTING POINT (WP)              │ ← Cây héo
│         Depletion = TAW                │
└─────────────────────────────────────────┘
```

### Công thức liên quan

```
TAW = 1000 × (FC - WP) × root_depth
RAW = p × TAW
Depletion = DC(i-1) + ETc - Rain - Irrigation

Điều kiện:
  0 ≤ Depletion ≤ TAW
  RAW ≤ TAW
```

### Ví dụ thực tế

**Cây cà chua**:
- FC = 30%, WP = 15%, root_depth = 0.5m, p = 0.4
- TAW = 1000 × (0.30 - 0.15) × 0.5 = **75 mm**
- RAW = 0.4 × 75 = **30 mm**

**Tình huống**:
- Ngày 1: Depletion = 0 mm → Đất đầy nước
- Ngày 5: Depletion = 25 mm → Vẫn < RAW (30mm) → Chưa cần tưới
- Ngày 7: Depletion = 35 mm → > RAW (30mm) → **CẦN TƯỚI**
- Sau tưới: Depletion = 0 mm → Reset về FC

---

## 6. Multi-Layer Water Balance trong Hệ Thống

### Luồng tính toán

```
1. Tính TAW/RAW cho từng tầng:
   ├─ Shallow TAW = 1000 × (FC-WP) × root_depth × 0.4
   └─ Deep TAW = 1000 × (FC-WP) × root_depth × 0.6

2. Tính Depletion cho từng tầng:
   ├─ Shallow Depletion = DC_prev + ETc×0.4 - Rain×0.7 - Irrigation×0.7
   └─ Deep Depletion = DC_prev + ETc×0.6 - Rain×0.3 - Irrigation×0.3
   (Mưa và tưới cùng tỷ lệ thẩm thấu 70-30)

3. Tính Weighted Depletion:
   Weighted = 0.6 × Deep_Depletion + 0.4 × Shallow_Depletion

4. Quyết định tưới:
   Nếu Weighted_Depletion < 50% × Total_RAW → Không tưới
   Nếu Weighted_Depletion ≥ 50% × Total_RAW → Tưới
```

### Code thực tế

```python
# ai-service/app/services/preprocessing_service.py:185-238

# 1. Tính TAW/RAW
(shallow_taw, deep_taw, shallow_raw, deep_raw, total_taw, total_raw) = 
    self.fao.calculate_multi_layer(fc, wp, root_depth, depletion_frac)

# 2. Tính Depletion mới
new_shallow_depl = self.fao.calculate_layer_depletion(
    prev_depletion=wb_state.shallow.depletion,
    etc=etc_shallow,
    effective_rain=rain_shallow,
    irrigation=irr_shallow,
    ...
)

new_deep_depl = self.fao.calculate_layer_depletion(...)

# 3. Weighted Depletion
weighted_depletion = 0.6 * new_deep_depl + 0.4 * new_shallow_depl

# 4. Depletion Ratio
depletion_ratio = weighted_depletion / total_taw
```

---

## 7. Các Tính Toán Chi Tiết trong Hệ Thống

### 7.1. ETo (Reference Evapotranspiration) - Penman-Monteith

**Công thức FAO-56:**

```
ET₀ = [0.408Δ(Rn-G) + γ(900/(T+273))u₂(es-ea)] / [Δ + γ(1+0.34u₂)]
```

**Các thành phần:**

1. **Atmospheric Pressure (P)**:
   ```
   P = 101.3 × ((293.0 - 0.0065 × altitude) / 293.0)^5.26
   ```

2. **Psychrometric Constant (γ)**:
   ```
   γ = 0.665 × 10⁻³ × P
   ```

3. **Saturation Vapour Pressure (es)**:
   ```
   es = 0.6108 × exp(17.27T / (T + 237.3))
   ```

4. **Actual Vapour Pressure (ea)**:
   ```
   ea = es × RH / 100
   ```

5. **Slope of Saturation Vapour Pressure Curve (Δ)**:
   ```
   Δ = 4098.0 × es / (T + 237.3)²
   ```

6. **Net Radiation (Rn)**:
   ```
   Rn = Rns - Rnl
   Rns = (1 - α) × Rs  (α = 0.23 albedo)
   Rnl = σ × Tk⁴ × (0.34 - 0.14√ea) × (1.35Rs/Rso - 0.35)
   ```

**Code thực tế:**

```python
# ai-service/app/services/fao_service.py:38-97
def calculate_eto(
    temp: float,
    humidity: float,
    wind_speed: Optional[float] = None,
    solar_radiation: Optional[float] = None,
    ...
) -> float:
    # Tính các thành phần
    P = 101.3 * ((293.0 - 0.0065 * altitude) / 293.0) ** 5.26
    gamma = 0.000665 * P
    es = 0.6108 * math.exp(17.27 * temp / (temp + 237.3))
    ea = es * humidity / 100.0
    delta = 4098.0 * es / (temp + 237.3) ** 2
    Rn = self._calc_net_radiation(...)
    
    # Penman-Monteith
    numerator = (0.408 * delta * (Rn - G)
                 + gamma * (900.0 / (temp + 273.0)) * ws * (es - ea))
    denominator = delta + gamma * (1.0 + 0.34 * ws)
    eto = max(0.0, numerator / denominator)
    return eto  # mm/day
```

---

### 7.2. ETo Hourly (FAO-56 Eq. 53)

**Khác biệt với daily:**

- **Constants**: Cn = 37, Cd = 0.24 (daytime) hoặc 0.96 (nighttime)
- **Soil heat flux G**: 
  - Daytime: G = 0.1 × Rn
  - Nighttime: G = 0.5 × Rn
- **Công thức**:
  ```
  ET₀_h = [0.408Δ(Rn-G) + γ(Cn/(T+273))u₂(es-ea)] / [Δ + γ(1+Cd×u₂)]
  ```

**Lý do dùng hourly:**

- Tránh tích lũy sai số khi service chạy mỗi giờ
- Nếu dùng mm/day → sẽ tích lũy 24× khi chạy mỗi giờ

**Code:**

```python
# ai-service/app/services/fao_service.py:155-233
def calculate_hourly_eto(...) -> float:
    Cn = 37.0
    Cd = 0.24 if is_daytime else 0.96
    G = 0.1 * Rn if is_daytime else 0.5 * Rn
    
    numerator = (0.408 * delta * (Rn - G)
                 + gamma * (Cn / (temp + 273.0)) * ws * (es - ea))
    denominator = delta + gamma * (1.0 + Cd * ws)
    eto_h = max(0.0, numerator / denominator)
    return eto_h  # mm/hour
```

---

### 7.3. ETc (Crop Evapotranspiration)

**Công thức FAO-56:**

```
ETc = ET₀ × Kc
```

**Kc (Crop Coefficient):**

- Phụ thuộc giai đoạn sinh trưởng:
  - Initial: Kc_ini
  - Development: Kc_dev (interpolate)
  - Mid-season: Kc_mid
  - End-season: Kc_end

**Kc Climatic Adjustment (FAO-56 Eq. 62):**

Chỉ áp dụng cho mid/end season:

```
Kc_adj = Kc_table + [0.04(u₂-2) - 0.004(RHmin-45)] × (h/3)^0.3
```

Trong đó:
- u₂: Wind speed tại 2m (m/s), clamp 1.0-6.0
- RHmin: Minimum relative humidity (%), clamp 20-80
- h: Crop height (m), clamp 0.1-10.0

**Code:**

```python
# ai-service/app/services/fao_service.py:314-353
def adjust_kc_for_climate(
    kc_table: float,
    wind_speed_2m: float,
    rh_min: float,
    crop_height: float = 0.5,
    growth_stage: str = "mid",
) -> float:
    if growth_stage not in ("mid", "end", "late"):
        return kc_table
    
    u2 = max(1.0, min(wind_speed_2m, 6.0))
    rh_min_c = max(20.0, min(rh_min, 80.0))
    h = max(0.1, min(crop_height, 10.0))
    
    adjustment = (0.04 * (u2 - 2.0) - 0.004 * (rh_min_c - 45.0)) * (h / 3.0) ** 0.3
    kc_adj = kc_table + adjustment
    return max(0.1, kc_adj)
```

---

### 7.4. Effective Rain (Mưa Hiệu Quả)

**Công thức:**

Kết hợp cảm biến mưa (binary) và dự báo từ OpenWeather:

```python
# ai-service/app/services/water_balance.py:131-152
def compute_effective_rain(
    sensor_rain: int,           # 0/1 (binary detection)
    forecast_rain_mm: Optional[float],  # mm từ OpenWeather
) -> float:
    eff = 0.0
    
    # Forecast rain: 85% effectiveness (> 5mm → 80%)
    if forecast_rain_mm is not None and forecast_rain_mm > 0:
        factor = 0.80 if forecast_rain_mm > 5 else 0.85
        eff += forecast_rain_mm * factor
    
    # Sensor detects rain but no forecast → assume 2mm baseline
    if sensor_rain == 1 and eff == 0:
        eff = 2.0
    
    return eff
```

**Lý do hiệu quả < 100%:**

- Một phần mưa bị chảy tràn (runoff)
- Một phần bốc hơi trước khi thấm vào đất
- Mưa lớn (>5mm) → hiệu quả thấp hơn (80%)

---

### 7.5. Sensor-Informed Depletion Calculation

**Đặc điểm:**

Hệ thống kết hợp tính toán water balance với sensor để điều chỉnh:

**Bước 1: Tính Depletion từ Water Balance**

```python
calc_depletion = max(0.0, prev_depletion + etc - effective_rain - irrigation)
```

**Bước 2: Tính Depletion từ Sensor**

```python
fc_frac = field_capacity / 100.0
sm_frac = soil_moisture_pct / 100.0
sensor_depletion = max(0.0, (fc_frac - sm_frac) × layer_taw / fc_frac)
```

**Bước 3: Reset nếu Sensor ≥ FC**

```python
if sm_frac >= fc_frac:
    return 0.0  # Reset depletion về 0
```

**Bước 4: Dynamic Blending**

Trọng số phụ thuộc độ ẩm đất:

- **Đất ướt** (sm ≥ 0.9×FC): Tin sensor nhiều hơn
  - Weight: 0.2 calc + 0.8 sensor
- **Đất khô** (sm ≤ 0.3×FC): Tin calculation nhiều hơn
  - Weight: 0.8 calc + 0.2 sensor
- **Bình thường**: Interpolate tuyến tính

**Code:**

```python
# ai-service/app/services/fao_service.py:430-486
def calculate_layer_depletion(...) -> float:
    # Pure calculation
    calc_depletion = max(0.0, prev_depletion + etc - effective_rain - irrigation)
    
    # Sensor estimate
    sensor_depletion = max(0.0, (fc_frac - sm_frac) × layer_taw / fc_frac)
    
    # Reset if sensor ≥ FC
    if sm_frac >= fc_frac:
        return 0.0
    
    # Dynamic weight
    wetness_ratio = sm_frac / fc_frac
    sensor_weight = 0.2 + (0.6 / 0.6) × max(0.0, min(wetness_ratio - 0.3, 0.6))
    sensor_weight = max(0.2, min(0.8, sensor_weight))
    calc_weight = 1.0 - sensor_weight
    
    # Blend
    blended = calc_weight × calc_depletion + sensor_weight × sensor_depletion
    return max(0.0, min(blended, layer_taw))  # Clamp ≤ TAW
```

---

### 7.6. Soil Moisture Trend

**Mục đích:**

Tính xu hướng thay đổi độ ẩm đất trong ~1 giờ để dự đoán nhu cầu tưới.

**Công thức:**

```python
# ai-service/app/services/water_balance.py:109-128
def get_soil_moist_trend(device_id: int) -> float:
    history = state.soil_moist_history  # Deque với maxlen=6
    
    if len(history) < 2:
        return 0.0
    
    oldest_time, oldest_val = history[0]
    newest_time, newest_val = history[-1]
    
    elapsed_hours = (newest_time - oldest_time).total_seconds() / 3600.0
    if elapsed_hours < 0.01:  # < 36 seconds
        return 0.0
    
    trend = (newest_val - oldest_val) / elapsed_hours
    return trend  # mm/h equivalent
```

**Ý nghĩa:**

- **trend > 0**: Đất đang ướt lên (mưa/tưới)
- **trend < 0**: Đất đang khô đi (ETc)
- **trend ≈ 0**: Ổn định

**Lưu trữ:**

- Lưu tối đa 6 readings (TREND_WINDOW)
- Mỗi prediction cycle thêm 1 reading mới
- Tự động trim khi vượt quá limit

---

### 7.7. Multi-Layer TAW/RAW Calculation

**Tính TAW cho từng tầng:**

```python
# ai-service/app/services/fao_service.py:357-371
def calculate_layer_taw(
    field_capacity: float,
    wilting_point: float,
    root_depth: float,
    layer_ratio: float,  # 0.4 cho shallow, 0.6 cho deep
) -> float:
    fc = field_capacity / 100.0 if field_capacity > 1 else field_capacity
    wp = wilting_point / 100.0 if wilting_point > 1 else wilting_point
    return max(0.0, 1000.0 * (fc - wp) * root_depth * layer_ratio)
```

**Tính RAW cho từng tầng:**

```python
# ai-service/app/services/fao_service.py:373-397
def calculate_multi_layer(...) -> Tuple:
    shallow_taw = calculate_layer_taw(fc, wp, root_depth, 0.4)
    deep_taw = calculate_layer_taw(fc, wp, root_depth, 0.6)
    
    shallow_raw = shallow_taw * depletion_fraction
    deep_raw = deep_taw * depletion_fraction
    
    total_taw = shallow_taw + deep_taw
    total_raw = shallow_raw + deep_raw
    
    return (shallow_taw, deep_taw, shallow_raw, deep_raw, total_taw, total_raw)
```

---

### 7.8. Weighted Depletion

**Công thức:**

```python
# ai-service/app/services/water_balance.py:46-48
weighted_depletion = 0.6 × deep_depletion + 0.4 × shallow_depletion
```

**Lý do:**

- Tầng sâu có nhiều rễ hơn (60% weight)
- Tầng nông ít rễ hơn (40% weight)
- Phản ánh tầm quan trọng của từng tầng

**Depletion Ratio:**

```python
depletion_ratio = weighted_depletion / total_taw
```

- **depletion_ratio = 0**: Đất đầy nước (FC)
- **depletion_ratio = 1**: Đất khô hoàn toàn (WP)
- **depletion_ratio > 0.5**: Đất khô, cần tưới

---

### 7.9. Luồng Tính Toán Đầy Đủ

**Pipeline trong preprocessing_service.py:**

```
1. Input: Sensor data, Weather, Crop context
   ↓
2. Tính ETo (hourly):
   ├─ Net radiation (Rn)
   ├─ Vapour pressure (es, ea)
   ├─ Penman-Monteith hourly
   └─ ET₀ (mm/hour)
   ↓
3. Tính ETc:
   ├─ Kc từ growth stage
   ├─ Kc climatic adjustment (nếu mid/end)
   └─ ETc = ET₀ × Kc_adj
   ↓
4. Tính Effective Rain:
   ├─ Forecast rain × effectiveness factor
   └─ Sensor rain baseline (nếu có)
   ↓
5. Tính TAW/RAW cho từng tầng:
   ├─ Shallow TAW = 1000 × (FC-WP) × root_depth × 0.4
   ├─ Deep TAW = 1000 × (FC-WP) × root_depth × 0.6
   ├─ Shallow RAW = Shallow TAW × p
   └─ Deep RAW = Deep TAW × p
   ↓
6. Phân chia ETc, Rain, Irrigation:
   ├─ ETc_shallow = ETc × 0.4
   ├─ ETc_deep = ETc × 0.6
   ├─ Rain_shallow = Effective_rain × infiltration_shallow_ratio
   ├─ Rain_deep = Effective_rain × infiltration_deep_ratio
   ├─ Irr_shallow = Irrigation × infiltration_shallow_ratio
   └─ Irr_deep = Irrigation × infiltration_deep_ratio
   ↓
7. Tính Depletion mới cho từng tầng:
   ├─ Shallow: Sensor-informed blending
   └─ Deep: Sensor-informed blending
   ↓
8. Tính Weighted Depletion:
   └─ Weighted = 0.6 × Deep + 0.4 × Shallow
   ↓
9. Tính Soil Moisture Trend:
   └─ Trend từ history (6 readings)
   ↓
10. Update Water Balance State:
    └─ Lưu vào database hoặc cache
```

---

## 8. Tài Liệu Tham Khảo FAO-56

### Các công thức chính

1. **TAW** (FAO-56 Eq. 22):
   ```
   TAW = 1000 × (θFC - θWP) × Zr
   ```

2. **RAW** (FAO-56 Eq. 23):
   ```
   RAW = p × TAW
   ```

3. **Depletion** (FAO-56 Eq. 77):
   ```
   Dr,i = Dr,i-1 - (P - RO)i - Ii - CRi + ETc,i + DPi
   ```

### Tài liệu gốc

- **FAO Irrigation and Drainage Paper No. 56**
- Link: https://www.fao.org/3/x0490e/x0490e06.htm
- Chapter 8: Water Requirements và Chapter 9: Irrigation Scheduling

---

## 9. Tóm Tắt

| Khái niệm | Ký hiệu | Công thức | Đơn vị | Ý nghĩa |
|-----------|---------|-----------|--------|---------|
| **Field Capacity** | FC | - | % | Độ ẩm đất khi đầy nước |
| **Wilting Point** | WP | - | % | Độ ẩm đất khi cây héo |
| **Total Available Water** | TAW | `1000 × (FC-WP) × root_depth` | mm | Tổng nước khả dụng |
| **Readily Available Water** | RAW | `p × TAW` | mm | Ngưỡng tưới |
| **Depletion** | DC | `DC(i-1) + ETc - Rain - Irrigation` | mm | Lượng nước thiếu hụt |
| **Depletion Fraction** | p | 0.2 - 0.6 | - | Hệ số cạn kiệt cho phép |

### Quy tắc vàng

1. **Depletion = 0** → Đất đầy nước (FC)
2. **Depletion < RAW** → Chưa cần tưới
3. **Depletion ≥ RAW** → Cần tưới
4. **Depletion = TAW** → Đất khô hoàn toàn (WP)

### Trong hệ thống

- **Shallow layer**: 40% vùng rễ, nhận 40% ETc
- **Deep layer**: 60% vùng rễ, nhận 60% ETc
- **Infiltration ratio**: Phụ thuộc loại đất (cát 0.55, sét 0.80), có thể override ở CropSeason
- **Weighted Depletion**: 60% deep + 40% shallow
- **Ngưỡng tưới**: 50% RAW (an toàn hơn FAO-56 chuẩn)
- **ETo**: Tính hourly (mm/hour) để tránh tích lũy sai số
- **Sensor blending**: Kết hợp water balance với sensor reading
- **Soil moisture trend**: Tính từ 6 readings gần nhất (~1h)

---

## 10. Các Hằng Số và Tỷ Lệ trong Hệ Thống

### Hằng số vật lý (FAO-56)

```python
# ai-service/app/services/fao_service.py:18-23
SOLAR_CONSTANT = 0.0820        # MJ/m²/min
STEFAN_BOLTZMANN = 4.903e-9    # MJ/m²/day/K⁴
STEFAN_BOLTZMANN_H = 2.042e-10 # MJ/m²/hour/K⁴
ALBEDO = 0.23                  # Hệ số phản xạ bề mặt
KELVIN_OFFSET = 273.16         # Chuyển đổi °C → K
```

### Tỷ lệ phân tầng (Geometry)

```python
SHALLOW_LAYER_RATIO = 0.4  # Top 40% của vùng rễ
DEEP_LAYER_RATIO = 0.6     # Bottom 60% của vùng rễ
```

### Tỷ lệ ETc phân chia

```python
ETc_shallow = ETc × 0.4  # Shallow nhận 40%
ETc_deep = ETc × 0.6     # Deep nhận 60%
```

**Lý do**: Tầng sâu có nhiều rễ hơn nên hút nhiều nước hơn.

### Tỷ lệ thẩm thấu (Infiltration) - Theo loại đất

**Fallback 3 tầng:**

1. **CropSeason.infiltration_shallow_ratio** (nếu có override)
2. **SoilLibrary.infiltration_shallow_ratio** (theo loại đất)
3. **Default 0.70** (hardcoded)

**Giá trị điển hình:**

| Loại đất | infiltration_shallow_ratio | Giải thích |
|----------|---------------------------|------------|
| Đất cát | 0.55 | Thấm nhanh xuống sâu |
| Đất cát pha | 0.60 | |
| Đất thịt | 0.70 | Mặc định |
| Đất thịt pha sét | 0.75 | |
| Đất sét | 0.80 | Giữ nhiều ở bề mặt |
| Đất phù sa | 0.70 | |

### Tỷ lệ Weighted Depletion

```python
weighted_depletion = 0.6 × deep_depletion + 0.4 × shallow_depletion
```

**Lý do**: Tầng sâu quan trọng hơn (60% weight).

### Ngưỡng tưới

```python
if depletion < 0.5 × RAW:
    skip_irrigation = True
```

**Lý do**: An toàn hơn FAO-56 chuẩn (thường là 100% RAW).

### Trend Window

```python
TREND_WINDOW = 6  # Lưu 6 readings gần nhất (~1h nếu mỗi 10 phút đọc 1 lần)
```

---

## 11. Ví Dụ Tính Toán Đầy Đủ

### Input

```
Device: ID = 1
Crop: Cà chua, growth_stage = "mid", root_depth = 0.5m
Soil: Đất thịt, FC = 30%, WP = 15%, infiltration_shallow_ratio = 0.70
Weather: T = 28°C, RH = 65%, wind = 2.5 m/s, solar_rad = 20 MJ/m²/day
Sensor: soil_moist1 = 35%, soil_moist2 = 32%, rain = 0
Previous state: shallow_depletion = 5mm, deep_depletion = 8mm
```

### Bước 1: Tính ETo (hourly)

```
Hour = 12 (noon), is_daytime = True
P = 101.3 × ((293 - 0.0065×10)/293)^5.26 = 101.0 kPa
γ = 0.000665 × 101.0 = 0.0672
es = 0.6108 × exp(17.27×28/(28+237.3)) = 3.78 kPa
ea = 3.78 × 65/100 = 2.46 kPa
Δ = 4098 × 3.78 / (28+237.3)² = 0.223
Rn = ... (tính từ solar radiation)
ET₀ = [0.408×0.223×(Rn-0.1Rn) + 0.0672×(900/(28+273))×2.5×(3.78-2.46)] 
      / [0.223 + 0.0672×(1+0.24×2.5)]
ET₀ ≈ 0.25 mm/hour
```

### Bước 2: Tính ETc

```
Kc_table = 1.15 (mid-season cà chua)
Kc_adj = 1.15 + [0.04×(2.5-2) - 0.004×(65-45)] × (0.5/3)^0.3
       = 1.15 + [0.02 - 0.08] × 0.55
       = 1.15 - 0.033 = 1.117
ETc = 0.25 × 1.117 = 0.279 mm/hour
```

### Bước 3: Tính TAW/RAW

```
TAW_total = 1000 × (0.30 - 0.15) × 0.5 = 75 mm
Shallow TAW = 75 × 0.4 = 30 mm
Deep TAW = 75 × 0.6 = 45 mm

p = 0.4 (cà chua)
Shallow RAW = 30 × 0.4 = 12 mm
Deep RAW = 45 × 0.4 = 18 mm
Total RAW = 30 mm
```

### Bước 4: Phân chia ETc, Rain, Irrigation

```
ETc_shallow = 0.279 × 0.4 = 0.112 mm/hour
ETc_deep = 0.279 × 0.6 = 0.167 mm/hour

Effective_rain = 0 (không mưa)
Rain_shallow = 0 × 0.70 = 0
Rain_deep = 0 × 0.30 = 0

Irrigation = 0 (chưa tưới)
Irr_shallow = 0 × 0.70 = 0
Irr_deep = 0 × 0.30 = 0
```

### Bước 5: Tính Depletion mới

**Shallow layer:**

```
calc_depletion = 5.0 + 0.112 - 0 - 0 = 5.112 mm
sensor_depletion = (0.30 - 0.35) × 30 / 0.30 = -5.0 → 0 mm
wetness_ratio = 0.35 / 0.30 = 1.17 (> 0.9) → sensor_weight = 0.8
blended = 0.2 × 5.112 + 0.8 × 0 = 1.02 mm
new_shallow_depl = min(1.02, 30) = 1.02 mm
```

**Deep layer:**

```
calc_depletion = 8.0 + 0.167 - 0 - 0 = 8.167 mm
sensor_depletion = (0.30 - 0.32) × 45 / 0.30 = -3.0 → 0 mm
wetness_ratio = 0.32 / 0.30 = 1.07 (> 0.9) → sensor_weight = 0.8
blended = 0.2 × 8.167 + 0.8 × 0 = 1.63 mm
new_deep_depl = min(1.63, 45) = 1.63 mm
```

### Bước 6: Weighted Depletion

```
weighted_depletion = 0.6 × 1.63 + 0.4 × 1.02 = 1.386 mm
depletion_ratio = 1.386 / 75 = 0.0185 (1.85%)
```

### Bước 7: Quyết định tưới

```
50% × RAW = 0.5 × 30 = 15 mm
Depletion (1.386 mm) < 15 mm → KHÔNG cần tưới
```

---

## 12. Code Reference

### File chính

1. **`ai-service/app/services/fao_service.py`**:
   - `calculate_eto()`: ETo daily (Penman-Monteith)
   - `calculate_hourly_eto()`: ETo hourly (FAO-56 Eq. 53)
   - `adjust_kc_for_climate()`: Kc adjustment (FAO-56 Eq. 62)
   - `calculate_layer_taw()`: TAW cho từng tầng
   - `calculate_multi_layer()`: TAW/RAW cho cả 2 tầng
   - `calculate_layer_depletion()`: Depletion với sensor blending

2. **`ai-service/app/services/water_balance.py`**:
   - `WaterBalanceStore`: Quản lý state (in-memory hoặc DB)
   - `get_soil_moist_trend()`: Tính xu hướng độ ẩm
   - `compute_effective_rain()`: Tính mưa hiệu quả

3. **`ai-service/app/services/preprocessing_service.py`**:
   - `transform()`: Pipeline đầy đủ từ input → features
   - Tích hợp tất cả các tính toán trên

4. **`backend/.../service/impl/AiPredictionServiceImpl.java`**:
   - `buildCropPayload()`: Build payload với infiltration fallback
   - Logic fallback: CropSeason → SoilLibrary → Default

---

## 13. Tài Liệu Tham Khảo FAO-56

### Các công thức chính

1. **TAW** (FAO-56 Eq. 22):
   ```
   TAW = 1000 × (θFC - θWP) × Zr
   ```

2. **RAW** (FAO-56 Eq. 23):
   ```
   RAW = p × TAW
   ```

3. **Depletion** (FAO-56 Eq. 77):
   ```
   Dr,i = Dr,i-1 - (P - RO)i - Ii - CRi + ETc,i + DPi
   ```

4. **ET₀ Daily** (FAO-56 Penman-Monteith):
   ```
   ET₀ = [0.408Δ(Rn-G) + γ(900/(T+273))u₂(es-ea)] / [Δ + γ(1+0.34u₂)]
   ```

5. **ET₀ Hourly** (FAO-56 Eq. 53):
   ```
   ET₀_h = [0.408Δ(Rn-G) + γ(Cn/(T+273))u₂(es-ea)] / [Δ + γ(1+Cd×u₂)]
   ```
   - Cn = 37, Cd = 0.24 (daytime) hoặc 0.96 (nighttime)

6. **Kc Adjustment** (FAO-56 Eq. 62):
   ```
   Kc_adj = Kc_table + [0.04(u₂-2) - 0.004(RHmin-45)] × (h/3)^0.3
   ```

### Tài liệu gốc

- **FAO Irrigation and Drainage Paper No. 56**
- Link: https://www.fao.org/3/x0490e/x0490e06.htm
- **Chapter 3**: ET₀ Calculation (Penman-Monteith)
- **Chapter 6**: ETc Calculation (Crop Coefficients)
- **Chapter 8**: Water Requirements
- **Chapter 9**: Irrigation Scheduling

### Các phương trình liên quan

- **Net Radiation** (FAO-56 Eq. 38-39):
  ```
  Rns = (1 - α) × Rs
  Rnl = σ × Tk⁴ × (0.34 - 0.14√ea) × (1.35Rs/Rso - 0.35)
  Rn = Rns - Rnl
  ```

- **Saturation Vapour Pressure** (FAO-56 Eq. 11):
  ```
  es = 0.6108 × exp(17.27T / (T + 237.3))
  ```

- **Slope of Vapour Pressure Curve** (FAO-56 Eq. 13):
  ```
  Δ = 4098 × es / (T + 237.3)²
  ```

- **Psychrometric Constant** (FAO-56 Eq. 8):
  ```
  γ = 0.665 × 10⁻³ × P
  ```

### Tài liệu bổ sung

- **Allen et al. (1998)**: "Crop evapotranspiration - Guidelines for computing crop water requirements"
- **Jensen et al. (1990)**: "Evapotranspiration and Irrigation Water Requirements"
- **Doorenbos & Pruitt (1977)**: "Crop Water Requirements" (FAO-24)

---

## 14. Changelog

### Version 1.0 (2026-02-18)

- Tổng hợp tất cả các tính toán từ `fao_service.py` và `water_balance.py`
- Bổ sung chi tiết về:
  - ETo calculation (daily và hourly)
  - ETc calculation với Kc adjustment
  - Effective rain calculation
  - Sensor-informed depletion blending
  - Soil moisture trend
  - Multi-layer TAW/RAW calculation
  - Weighted depletion
  - Ví dụ tính toán đầy đủ
  - Code reference
  - Tài liệu tham khảo FAO-56

---

**Tài liệu này được tạo để hỗ trợ hiểu rõ các tính toán FAO-56 trong hệ thống Smart Garden.**
