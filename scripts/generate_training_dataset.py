#!/usr/bin/env python3
"""
Sinh bộ dataset mẫu ~1000 bản ghi cho train RF, mô phỏng sát thực tế.

Bao quát:
- Chu kỳ ngày/đêm: temp (thấp đêm, cao trưa), light (0 đêm, cao giữa ngày), humidity
- Ngày khô vs ngày mưa: ~35% ngày có mưa (forecast_rain, effective rain), còn lại khô
- Nhiều tháng: mùa nắng (4-5 nóng), mùa mưa (6-9 mát hơn), mùa khô mát (11-12)
- Nhiều loại cây/đất/giai đoạn: 8 khối thời gian, mỗi khối 1 bộ (crop_type, soil_type, growth_stage)
- Depletion/soil moisture: cập nhật theo ETc (giờ), mưa (giảm depletion), tưới (giảm depletion)
- Tưới mô phỏng: khi depletion_ratio > 0.6 và ban ngày thì tưới một phần RAW
- Target actual_irrigation_mm_next_24h = tổng irrigation thực tế từ T đến T+24h
- Target depletion_after_24h = depletion tại thời điểm T+24h (tùy chọn)

Chạy: python scripts/generate_training_dataset.py
Output: scripts/training_dataset_1000.csv
"""

import csv
import random
from datetime import datetime, timedelta
from pathlib import Path

# Reproducible
random.seed(42)

# ── Feature names (khớp pipeline_builder) ──
NUMERIC = [
    "temp", "humidity", "light",
    "wind_speed", "forecast_rain",
    "forecast_rain_d0", "forecast_rain_d1", "forecast_rain_d2",
    "soil_moist_shallow", "soil_moist_deep",
    "soil_moist_avg", "soil_moist_diff",
    "soil_moist_ratio", "soil_moist_trend_1h",
    "eto", "etc", "kc",
    "depletion", "depletion_ratio",
    "depletion_shallow", "depletion_deep",
    "taw", "raw",
    "soil_moist_deficit",
    "temp_x_humidity", "solar_x_temp", "soil_x_depletion",
]
CAT_ORD = ["growth_stage"]
CAT_NOM = ["crop_type", "soil_type"]
GROWTH_STAGES = ["initial", "development", "mid", "end"]
CROP_TYPES = ["rice", "vegetable", "corn", "fruit"]
SOIL_TYPES = ["loam", "clay", "sandy", "silt_loam"]

# ── Tham số mô phỏng ──
HOURS_TOTAL = 1000
BASE_DATE = datetime(2025, 1, 1, 0, 0, 0)
# Tỷ lệ ngày có mưa (để có cả mùa khô và mùa mưa)
RAINY_DAY_RATIO = 0.35
# TAW điển hình (mm) theo loại đất
TAW_BY_SOIL = {"loam": 120, "clay": 150, "sandy": 80, "silt_loam": 130}
# Kc theo giai đoạn (FAO-56)
KC_BY_STAGE = {"initial": 0.55, "development": 0.75, "mid": 1.0, "end": 0.85}


def hourly_temp_c(day_of_year: int, hour: int) -> float:
    """Nhiệt độ theo giờ trong ngày và mùa (VN)."""
    # Mùa: 1-3 mát, 4-5 nóng, 6-10 mưa (mát hơn), 11-12 khô mát
    month = (day_of_year - 1) // 30 + 1
    if month in (6, 7, 8, 9):
        base = 28.0  # mùa mưa
    elif month in (4, 5):
        base = 32.0  # nóng
    else:
        base = 29.0
    # Diurnal: thấp lúc 5h, cao lúc 13-14h
    t = hour + (day_of_year % 7) * 0.1  # chút nhiễu theo ngày
    diurnal = -6 * ((t - 14) ** 2) / 100 + 5
    return round(base + diurnal + random.gauss(0, 1.2), 1)


def hourly_humidity( temp: float, hour: int, is_rainy_day: bool) -> float:
    """Độ ẩm không khí: cao đêm/sáng, thấp trưa; cao hơn ngày mưa."""
    base = 85 - temp * 0.8  # inverse with temp
    if 5 <= hour <= 8:
        base += 10
    if is_rainy_day:
        base += 8
    return round(max(40, min(98, base + random.gauss(0, 5))), 1)


def hourly_light_lux(hour: int, is_cloudy: bool) -> float:
    """Ánh sáng (lux): 0 ban đêm, cao giữa trưa."""
    if hour < 6 or hour >= 18:
        return round(random.uniform(0, 50), 0)
    # 6-18: parabola peak at 12
    progress = (hour - 6) / 12.0
    if hour > 12:
        progress = (18 - hour) / 6.0
    else:
        progress = (hour - 6) / 6.0
    peak = 80000 if not is_cloudy else 25000
    lux = progress * peak + random.gauss(0, 500)
    return round(max(0.0, lux), 0)


def hourly_eto_mm( temp: float, humidity: float, light: float, hour: int) -> float:
    """ETo mm/hour đơn giản (theo hướng FAO-56 hourly)."""
    if hour < 6 or hour >= 18:
        return round(random.uniform(0, 0.05), 4)
    # Daytime: higher temp + lower humidity + more light → higher ETo
    factor = (temp - 20) * 0.02 + (100 - humidity) * 0.002 + (light / 100000) * 0.5
    return round(max(0, min(0.5, factor + random.gauss(0, 0.03))), 4)


def main():
    out_path = Path(__file__).parent / "training_dataset_1000.csv"
    rows: list[dict] = []

    # Luân phiên crop/soil/stage theo từng khối để dataset bao quát đủ trường hợp
    block_size = HOURS_TOTAL // 8  # 8 khối ~125h mỗi khối
    def get_context(i: int):
        block = i // block_size
        crops = CROP_TYPES * 2
        soils = SOIL_TYPES * 2
        stages = GROWTH_STAGES * 2
        crop = crops[block % len(crops)]
        soil = soils[(block // 2) % len(soils)]
        stage = stages[(block // 2) % len(stages)]
        taw = TAW_BY_SOIL.get(soil, 120)
        raw = taw * 0.5
        kc = KC_BY_STAGE.get(stage, 0.8)
        return crop, soil, stage, taw, raw, kc

    # Trạng thái tích lũy (mô phỏng theo giờ)
    depletion = 0.0
    soil_shallow = 45.0
    soil_deep = 50.0
    fc = 35.0
    wp = 15.0

    # Đánh dấu ngày mưa (trước khi quét từng giờ)
    rainy_days: set[int] = set()
    for d in range(HOURS_TOTAL // 24 + 2):
        if random.random() < RAINY_DAY_RATIO:
            rainy_days.add(d)

    # Lịch “tưới” mô phỏng: mỗi giờ quyết định có tưới hay không (sau này dùng làm target)
    # Thực tế target = tổng irrigation từ T đến T+24h. Ta sẽ tính ngược: trước khi ghi row,
    # ta cần biết "trong 24h tới có bao nhiêu mm tưới". Cách đơn giản: mô phỏng từng giờ,
    # mỗi giờ có thể tưới một lượng (dựa trên depletion), rồi với mỗi timestamp T,
    # target[T] = sum(irrigation từ T đến T+24h).
    irrigation_log: list[tuple[int, float]] = []  # (hour_index, mm)

    for i in range(HOURS_TOTAL):
        crop, soil, stage, taw, raw, kc = get_context(i)
        t = BASE_DATE + timedelta(hours=i)
        day_idx = i // 24
        hour = t.hour
        doy = t.timetuple().tm_yday
        is_rainy_day = day_idx in rainy_days
        is_cloudy = is_rainy_day and random.random() < 0.7

        temp = hourly_temp_c(doy, hour)
        humidity = hourly_humidity(temp, hour, is_rainy_day)
        light = hourly_light_lux(hour, is_cloudy)
        wind_speed = round(random.uniform(1.0, 5.0), 1)
        if is_rainy_day:
            forecast_rain = round(random.uniform(5, 25), 1)
            forecast_d0 = round(random.uniform(3, 20), 1)
            forecast_d1 = round(random.uniform(0, 15), 1)
            forecast_d2 = round(random.uniform(0, 10), 1)
        else:
            forecast_rain = round(random.uniform(0, 2), 1)
            forecast_d0 = round(random.uniform(0, 1), 1)
            forecast_d1 = round(random.uniform(0, 1), 1)
            forecast_d2 = 0.0

        eto = hourly_eto_mm(temp, humidity, light, hour)
        etc = round(eto * kc, 4)

        # Mưa hiệu quả (đơn giản: nếu ngày mưa và ban ngày thì có mưa rơi vài mm/giờ)
        effective_rain_this_hour = 0.0
        if is_rainy_day and 8 <= hour <= 17 and random.random() < 0.4:
            effective_rain_this_hour = round(random.uniform(0.5, 3.0), 2)

        # Cập nhật depletion (FAO-56: depletion += ETc - rain - irrigation)
        irrigation_this_hour = 0.0
        depletion_ratio = depletion / taw if taw > 0 else 0
        if depletion_ratio > 0.6 and hour >= 6 and hour <= 18:
            # Quyết định tưới: lượng = một phần RAW
            irrigation_this_hour = round(min(raw * 0.4, depletion * 0.5), 2)
            irrigation_this_hour = min(irrigation_this_hour, 5.0)
        depletion = depletion + etc - effective_rain_this_hour - irrigation_this_hour
        depletion = max(0.0, min(taw, depletion))

        irrigation_log.append((i, irrigation_this_hour))

        # Soil moisture phản ánh depletion (đơn giản: tỷ lệ nghịch với depletion_ratio)
        soil_shallow = max(15, min(55, 50 - depletion_ratio * 35 + random.gauss(0, 3)))
        soil_deep = max(18, min(55, 52 - depletion_ratio * 30 + random.gauss(0, 2)))
        soil_avg = (soil_shallow + soil_deep) / 2
        soil_diff = soil_shallow - soil_deep
        soil_ratio = soil_shallow / (soil_deep + 1e-6)
        soil_trend_1h = round(random.gauss(0, 0.5), 2)
        depletion_shallow = depletion * 0.4
        depletion_deep = depletion * 0.6
        soil_moist_deficit = max(0, fc - soil_avg)
        temp_x_humidity = round(temp * humidity, 1)
        solar_x_temp = round((light / 1000) * temp, 2)
        soil_x_depletion = round(soil_avg * depletion_ratio, 2)

        # Target: tổng irrigation từ giờ này đến +24h
        actual_next_24h = sum(mm for (idx, mm) in irrigation_log if idx > i and idx <= i + 24)
        # Chưa có tương lai → tính trong pass sau. Ở đây ta dùng “đã tưới trong 24h qua” cho đơn giản,
        # hoặc tính trước toàn bộ irrigation_log rồi mới gán target. Cách đúng: sau khi có đủ irrigation_log,
        # với mỗi i, target[i] = sum(irrigation_log[j] for j in range(i+1, min(i+25, HOURS_TOTAL))).
        # Ta sẽ tính target ở pass thứ hai: duyệt lại rows và gán target từ irrigation_log.
        # Đơn giản hơn: tính ngay target từ “tương lai” đã mô phỏng. Nhưng tại i ta chưa có irrigation ở i+1..i+24.
        # Cách làm: đầu tiên chạy mô phỏng và lưu irrigation_log; sau đó duyệt i từ 0 đến HOURS_TOTAL,
        # với mỗi i tính target[i] = sum(irrigation_log[j][1] for j in range(i+1, min(i+25, HOURS_TOTAL))).
        # Vậy cần 2 pass: pass 1 chỉ build irrigation_log; pass 2 build rows và dùng irrigation_log để target.
        # Hiện tại pass 1 đang vừa build irrigation_log vừa build row. Ta tách: pass 1 chỉ tính irrigation_log,
        # pass 2 với mỗi i lấy state tại i (cần lưu state từng bước) hoặc tính lại state và dùng target từ log.
        # Đơn giản nhất: trong 1 pass, với mỗi i ta đã có irrigation_log[0..i]. Target tại i = tổng tưới từ i+1 đến i+24.
        # Vậy ta cần “nhìn tương lai”: tại i, target = sum(irrigation từ i+1 đến i+24). Trong 1 pass ta không có tương lai.
        # → Cần 2 pass:
        # Pass 1: chỉ mô phỏng và lưu list (hour_index, depletion, soil_*, irrigation_this_hour, ...) cho từng i.
        # Pass 2: với mỗi i, target[i] = sum(irrigation[j] for j in i+1..i+24), rồi ghi row.
        # Tôi sẽ đổi: pass 1 chỉ thu thập irrigation_log và lưu các state (temp, depletion, ...) vào list records.
        # Pass 2: với mỗi record i, target = sum(irrigation_log[j] for j in range(i+1, min(i+25, HOURS_TOTAL))), rồi ghi CSV.
        records_i = {
            "timestamp": t.strftime("%Y-%m-%d %H:%M:%S"),
            "temp": temp,
            "humidity": humidity,
            "light": light,
            "wind_speed": wind_speed,
            "forecast_rain": forecast_rain,
            "forecast_rain_d0": forecast_d0,
            "forecast_rain_d1": forecast_d1,
            "forecast_rain_d2": forecast_d2,
            "soil_moist_shallow": round(soil_shallow, 1),
            "soil_moist_deep": round(soil_deep, 1),
            "soil_moist_avg": round(soil_avg, 1),
            "soil_moist_diff": round(soil_diff, 1),
            "soil_moist_ratio": round(soil_ratio, 2),
            "soil_moist_trend_1h": soil_trend_1h,
            "eto": eto,
            "etc": etc,
            "kc": kc,
            "depletion": round(depletion, 2),
            "depletion_ratio": round(depletion_ratio, 3),
            "depletion_shallow": round(depletion_shallow, 2),
            "depletion_deep": round(depletion_deep, 2),
            "taw": taw,
            "raw": round(raw, 2),
            "soil_moist_deficit": round(soil_moist_deficit, 2),
            "temp_x_humidity": temp_x_humidity,
            "solar_x_temp": solar_x_temp,
            "soil_x_depletion": soil_x_depletion,
            "crop_type": crop,
            "growth_stage": stage,
            "soil_type": soil,
            "_irrigation": irrigation_this_hour,
        }
        rows.append(records_i)

    # Target: actual_irrigation_mm_next_24h = tổng irrigation từ giờ tiếp theo đến +24h
    for i, r in enumerate(rows):
        total = 0.0
        for j in range(i + 1, min(i + 25, len(rows))):
            total += rows[j]["_irrigation"]
        r["actual_irrigation_mm_next_24h"] = round(total, 2)
        # depletion_after_24h = depletion tại thời điểm i+24 (để train target thay thế)
        if i + 24 < len(rows):
            r["depletion_after_24h"] = rows[i + 24]["depletion"]
        else:
            r["depletion_after_24h"] = r["depletion"]
        del r["_irrigation"]

    # Ghi CSV
    fieldnames = ["timestamp"] + NUMERIC + CAT_ORD + CAT_NOM + ["actual_irrigation_mm_next_24h", "depletion_after_24h"]
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"Generated {len(rows)} rows -> {out_path}")
    print(f"Target stats: min={min(r['actual_irrigation_mm_next_24h'] for r in rows):.2f}, "
          f"max={max(r['actual_irrigation_mm_next_24h'] for r in rows):.2f}, "
          f"mean={sum(r['actual_irrigation_mm_next_24h'] for r in rows)/len(rows):.2f}")


if __name__ == "__main__":
    main()
