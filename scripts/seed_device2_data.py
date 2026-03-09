#!/usr/bin/env python3
"""
Tạo SQL seed data cho device ID=2 (SG-002 — Vườn Cà Chua Hà Nội).

Đảm bảo quy tắc theo generate_dataset.py:
  - AR(1) autocorrelation cho temp / humidity / wind / cloud
  - Markov chain cho rain
  - FAO-56 multi-layer water balance cho soil moisture
  - Diurnal cycle theo Hà Nội tháng 3
  - 10-phút/mẫu (~7 ngày, 1008 bản ghi)

Crop  : Cà chua (Tomato), stage mid-season (Kc=1.15)
Soil  : Đất thịt pha sét (Clay Loam) — FC=36%, WP=20%
Device: SG-002, Vườn Cà Chua Hà Nội, lat=21.03, lon=105.85, alt=12m

Usage:
    python scripts/seed_device2_data.py
    python scripts/seed_device2_data.py --device-id 2 --records 1008 --out data/seed_device2.sql
"""

import argparse
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

# ── Path bootstrap ─────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
AI_SERVICE = REPO_ROOT / "ai-service"
sys.path.insert(0, str(AI_SERVICE))

from app.services.fao_service import FaoService  # noqa: E402

# ═══════════════════════════════════════════════════════════
# CONSTANTS — Hà Nội, tháng 3
# ═══════════════════════════════════════════════════════════
LATITUDE    = 21.03
LONGITUDE   = 105.85
ALTITUDE    = 12.0
MONTH       = 3          # March => base season context

# Monthly climate params (Hanoi, from generate_dataset.py LOCATION_PROFILES)
BASE_TEMP         = 21.0    # °C
DIURNAL_AMPLITUDE = 5.0     # °C peak-to-trough
BASE_RH           = 87.0    # %
WIND_MEAN         = 2.0     # m/s
CC_A, CC_B        = 5, 2    # Beta shape params for cloud cover
SUNRISE           = 6.0     # hour (decimal)
SUNSET            = 18.0
RAIN_PROB         = 0.05    # P(rain starts | was dry)
RAIN_INTENSITY    = 4.0     # mm per rain-event (exponential mean)

# AR(1) params — identical to generate_dataset.py
AR1_RHO   = {"temp": 0.92, "humidity": 0.88, "wind": 0.80, "cloud": 0.93}
AR1_SIGMA = {"temp": 0.8,  "humidity": 4.0,  "wind": 0.6,  "cloud": 0.08}
RAIN_PERSIST_PROB = 0.75

# ── Crop: Cà chua mid-season (FAO-56) ──────────────────────
KC          = 1.15           # Kc mid
ROOT_DEPTH  = 0.40           # m  (mid-season)
CROP_HEIGHT = 0.60           # m  (for aerodynamic resistance — used inside FaoService)

# ── Soil: Đất thịt pha sét (Clay Loam) — V2 seed ID=4 ──────
FC          = 36.0           # % vol
WP          = 20.0           # % vol
INF_SHALLOW = 0.78           # fraction going to shallow layer
DEPL_FRAC   = 0.40           # p-factor (allowed depletion)

# TAW/RAW calculation  (FAO-56 eq. 82)
TAW_TOTAL   = 1000 * (FC - WP) / 100.0 * ROOT_DEPTH    # ~ 64 mm
SHALLOW_TAW = TAW_TOTAL * 0.4                           # ~ 25.6 mm
DEEP_TAW    = TAW_TOTAL * 0.6                           # ~ 38.4 mm
RAW_TOTAL   = DEPL_FRAC * TAW_TOTAL                     # ~ 25.6 mm

# ── Irrigation config ───────────────────────────────────────
PUMP_FLOW_RATE = 0.8   # L/min
NOZZLE_COUNT   = 2
GARDEN_AREA    = 50.0  # m²

# ═══════════════════════════════════════════════════════════
# AR(1) helpers (mirrored from generate_dataset.py)
# ═══════════════════════════════════════════════════════════

def _ar1_step(prev_eps: float, rho: float, sigma: float, rng: np.random.Generator) -> float:
    innovation_scale = sigma * math.sqrt(max(0.0, 1.0 - rho ** 2))
    return rho * prev_eps + innovation_scale * rng.normal()


def _diurnal_temp(hour: int, base: float, amp: float, rng: np.random.Generator,
                  eps: float = 0.0) -> tuple[float, float]:
    phase = 2 * math.pi * (hour - 14) / 24
    new_eps = _ar1_step(eps, AR1_RHO["temp"], AR1_SIGMA["temp"], rng)
    return base + amp * math.cos(phase) + new_eps, new_eps


def _diurnal_humidity(hour: int, base: float, rng: np.random.Generator,
                      eps: float = 0.0) -> tuple[float, float]:
    amp = 12
    phase = 2 * math.pi * (hour - 4) / 24
    new_eps = _ar1_step(eps, AR1_RHO["humidity"], AR1_SIGMA["humidity"], rng)
    rh = base + amp * math.cos(phase) + new_eps
    return float(np.clip(rh, 30, 100)), new_eps


def _ar1_wind(wind_mean: float, rng: np.random.Generator,
              eps: float = 0.0) -> tuple[float, float]:
    new_eps = _ar1_step(eps, AR1_RHO["wind"], AR1_SIGMA["wind"], rng)
    return max(0.3, wind_mean + new_eps), new_eps


def _ar1_cloud(cc_a: float, cc_b: float, rng: np.random.Generator,
               eps: float = 0.0) -> tuple[float, float]:
    base_cc = cc_a / (cc_a + cc_b)
    new_eps = _ar1_step(eps, AR1_RHO["cloud"], AR1_SIGMA["cloud"], rng)
    cc = float(np.clip(base_cc + new_eps, 0.0, 1.0))
    return cc, new_eps


def _markov_rain(prev_raining: bool, base_prob: float, hour: int,
                 rng: np.random.Generator) -> bool:
    if prev_raining:
        return rng.random() < RAIN_PERSIST_PROB
    prob = base_prob
    if 14 <= hour <= 20:
        prob *= 2.0
    elif hour < 6 or hour > 22:
        prob *= 0.3
    return rng.random() < prob


def _solar_radiation_hourly(hour: int, cloud_cover: float,
                             rng: np.random.Generator) -> float:
    if hour < SUNRISE or hour >= SUNSET:
        return 0.0
    midday = (SUNRISE + SUNSET) / 2.0
    half_day = (SUNSET - SUNRISE) / 2.0
    x = (hour - midday) / half_day
    clear_sky = 3.0 * (1 - x ** 2)
    cloud_factor = 1.0 - 0.7 * cloud_cover
    noise = max(0, rng.normal(1.0, 0.05))
    return max(0.0, clear_sky * cloud_factor * noise)


def _lux_from_solar(solar_mj_h: float, rng: np.random.Generator) -> float:
    watt_per_m2 = solar_mj_h * 1e6 / 3600
    lux = watt_per_m2 * 120
    return max(0.0, lux * rng.normal(1.0, 0.03))


def _compute_ks(depletion: float, taw: float, raw: float) -> float:
    if taw <= raw or depletion <= raw:
        return 1.0
    stress_ratio = (taw - depletion) / (taw - raw)
    return max(0.0, stress_ratio ** 1.5)


def _sm_from_depletion(depletion: float, taw: float, noise: float = 0.0) -> float:
    """Convert layer depletion → soil moisture % vol."""
    # SM = FC - (depletion / TAW) * (FC - WP) + noise
    sm = FC - (depletion / max(taw, 1e-6)) * (FC - WP) + noise
    return float(np.clip(sm, WP * 0.5, FC * 1.1))


# ═══════════════════════════════════════════════════════════
# MAIN GENERATOR
# ═══════════════════════════════════════════════════════════

def generate_sensor_rows(n_records: int, seed: int = 7,
                         interval_min: int = 10) -> tuple[list[dict], dict]:
    """
    Trả về:
      - rows: list sensor_data rows (dict)
      - final_wb: final water balance state dict (cho INSERT device_water_balance_state)
    """
    rng = np.random.default_rng(seed)
    fao = FaoService()

    end_time = datetime.now(timezone.utc).replace(second=0, microsecond=0, tzinfo=None)
    start_time = end_time - timedelta(minutes=interval_min * n_records)

    # AR(1) initial state
    eps_temp  = 0.0
    eps_rh    = 0.0
    eps_wind  = 0.0
    eps_cloud = 0.0
    prev_raining = False
    hours_since_last_rain = 72

    # Water-balance initial state (start near fc — typical after recent irrigation)
    shallow_depl = rng.uniform(0.0, SHALLOW_TAW * 0.2)   # light depletion
    deep_depl    = rng.uniform(0.0, DEEP_TAW * 0.2)

    rows = []

    for i in range(n_records):
        ts = start_time + timedelta(minutes=interval_min * i)
        hour  = ts.hour
        minute = ts.minute
        doy   = ts.timetuple().tm_yday

        # ── Weather (AR(1)) ──────────────────────────────
        temp,  eps_temp  = _diurnal_temp(hour, BASE_TEMP, DIURNAL_AMPLITUDE, rng, eps_temp)
        rh,    eps_rh    = _diurnal_humidity(hour, BASE_RH, rng, eps_rh)
        wind,  eps_wind  = _ar1_wind(WIND_MEAN, rng, eps_wind)
        cloud, eps_cloud = _ar1_cloud(CC_A, CC_B, rng, eps_cloud)
        solar  = _solar_radiation_hourly(hour, cloud, rng)
        lux    = _lux_from_solar(solar, rng)

        # ── Rain (Markov) ────────────────────────────────
        has_rain   = _markov_rain(prev_raining, RAIN_PROB, hour, rng)
        prev_raining = has_rain
        rain_amount = 0.0
        if has_rain:
            rain_amount = max(0.5, rng.exponential(RAIN_INTENSITY))
            hours_since_last_rain = 0
        else:
            hours_since_last_rain += interval_min / 60.0

        eff_rain = rain_amount * 0.85 if rain_amount > 0 else 0.0

        # ── FAO-56 ETc for this 10-min step ─────────────
        eto = fao.calculate_hourly_eto(
            temp=temp, humidity=rh,
            wind_speed=wind,
            solar_radiation_hourly=solar,
            day_of_year=doy, hour=hour,
            latitude=LATITUDE, altitude=ALTITUDE,
        )
        # Scale from hourly → per-interval
        interval_fraction = interval_min / 60.0
        eto_step = eto * interval_fraction

        prev_w = 0.6 * deep_depl + 0.4 * shallow_depl
        ks     = _compute_ks(prev_w, TAW_TOTAL, RAW_TOTAL)
        etc_step = eto_step * KC * ks

        # ── Layer update ─────────────────────────────────
        etc_sh = etc_step * 0.4
        etc_dp = etc_step * 0.6
        rain_sh = eff_rain * INF_SHALLOW
        rain_dp = eff_rain * (1 - INF_SHALLOW)

        shallow_depl = max(0.0, min(SHALLOW_TAW,
                            shallow_depl + etc_sh - rain_sh))
        deep_depl    = max(0.0, min(DEEP_TAW,
                            deep_depl    + etc_dp - rain_dp))

        # ── Soil moisture from depletion ─────────────────
        noise_sh = rng.normal(0, 0.8)
        noise_dp = rng.normal(0, 0.6)
        sm1 = round(_sm_from_depletion(shallow_depl, SHALLOW_TAW, noise_sh), 1)
        sm2 = round(_sm_from_depletion(deep_depl,    DEEP_TAW,    noise_dp), 1)

        rows.append({
            "sm1":         sm1,
            "sm2":         sm2,
            "temp":        round(temp, 1),
            "humidity":    round(rh,   1),
            "light":       round(lux,  0),
            "rain":        1 if has_rain else 0,
            "timestamp":   ts.strftime("%Y-%m-%d %H:%M:%S"),
        })

    # Final water balance state after simulation
    weighted_depl = 0.6 * deep_depl + 0.4 * shallow_depl
    final_wb = {
        "shallow_depletion": round(shallow_depl, 3),
        "shallow_taw":       round(SHALLOW_TAW,  3),
        "shallow_raw":       round(RAW_TOTAL * 0.4, 3),
        "deep_depletion":    round(deep_depl,    3),
        "deep_taw":          round(DEEP_TAW,     3),
        "deep_raw":          round(RAW_TOTAL * 0.6, 3),
        "last_irrigation":   round(weighted_depl, 3),
    }
    return rows, final_wb


# ═══════════════════════════════════════════════════════════
# SQL BUILDER
# ═══════════════════════════════════════════════════════════

def build_sql(rows: list[dict], final_wb: dict, device_id_override: int | None) -> str:
    lines = [
        "-- ============================================================",
        "-- Seed data for device 2 (SG-002 — Vườn Cà Chua Hà Nội)",
        "-- Generated by scripts/seed_device2_data.py",
        f"-- Records: {len(rows)} sensor_data + device + weather + crop_season + water_balance + irrigation_config",
        "-- Physics: AR(1) weather, Markov rain, FAO-56 multi-layer water balance",
        "-- Crop: Cà chua mid-season (Kc=1.15) | Soil: Đất thịt pha sét (FC=36%,WP=20%)",
        "-- ============================================================",
        "",
    ]

    if device_id_override is not None:
        # Device already exists → just seed related data
        lines += [
            f"-- Using existing device_id = {device_id_override}",
            f"SET @device_id = {device_id_override};",
            "",
        ]
    else:
        lines += [
            "-- 1. Device SG-002",
            "INSERT INTO devices (device_code, device_name, location, status, latitude, longitude, altitude,",
            "                    garden_area, created_at, updated_at, deleted_at)",
            "SELECT 'SG-002', 'Vườn Cà Chua Hà Nội', 'Hanoi', 'ONLINE', 21.03, 105.85, 12.0, 50.0, NOW(), NOW(), NULL",
            "WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_code = 'SG-002');",
            "",
            "SET @device_id = (SELECT id FROM devices WHERE device_code = 'SG-002' LIMIT 1);",
            "",
        ]

    # 2. Sensor data
    lines += [
        "-- 2. Sensor data — AR(1) / Markov physics, 10-min interval",
        "DELETE FROM sensor_data WHERE device_id = @device_id;  -- fresh seed, replace existing",
        "",
    ]
    for r in rows:
        rain_bool = "true" if r["rain"] else "false"
        payload = (
            f'{{"soilMoisture":{r["sm1"]},'
            f'"soilMoisture2":{r["sm2"]},'
            f'"temperature":{r["temp"]},'
            f'"humidity":{r["humidity"]},'
            f'"lightIntensity":{r["light"]:.0f},'
            f'"rainDetected":{rain_bool}}}'
        )
        lines.append(
            f"INSERT INTO sensor_data "
            f"(device_id, payload, timestamp, created_at, updated_at, deleted_at) VALUES "
            f"(@device_id, '{payload}', '{r['timestamp']}', NOW(), NOW(), NULL);"
        )

    # 3. Weather data
    lines += [
        "",
        "-- 3. Weather data (Hanoi, tháng 3)",
        "INSERT INTO weather_data (location, temperature, humidity, precipitation, precipitation_probability,",
        "    wind_speed, uv_index, forecast_time, solar_radiation, sunshine_hours, wind_speed_2m,",
        "    atmospheric_pressure, created_at, updated_at, deleted_at)",
        "SELECT 'Hanoi', 24.5, 87.0, 1.2, 0.25, 2.0, 5.0, NOW(), 14.0, 5.5, 2.0, 101.5, NOW(), NOW(), NULL",
        "WHERE NOT EXISTS (SELECT 1 FROM weather_data WHERE location = 'Hanoi');",
        "",
        "-- 4. Daily forecast (3 ngày — tháng 3, Hà Nội)",
        "INSERT INTO daily_weather_forecast (location, forecast_date, temp_min, temp_max, temp_avg,",
        "    humidity_avg, wind_speed_avg, total_rain, precip_prob_avg, avg_clouds,",
        "    created_at, updated_at, deleted_at)",
        "VALUES",
        "  ('Hanoi', CURDATE(),                       20.0, 25.0, 21.5, 87.0, 2.0, 1.5, 0.25, 0.70, NOW(), NOW(), NULL),",
        "  ('Hanoi', CURDATE() + INTERVAL 1 DAY,      20.5, 26.0, 22.0, 85.0, 2.2, 0.5, 0.20, 0.60, NOW(), NOW(), NULL),",
        "  ('Hanoi', CURDATE() + INTERVAL 2 DAY,      19.0, 24.5, 21.0, 88.0, 1.8, 3.0, 0.35, 0.75, NOW(), NOW(), NULL)",
        "ON DUPLICATE KEY UPDATE temp_avg = VALUES(temp_avg), total_rain = VALUES(total_rain);",
        "",
        "-- 5. Crop season — Cà chua mid-season, Đất thịt pha sét",
        "SET @crop_id2 = (SELECT id FROM crop_library WHERE name LIKE '%Cà chua%' LIMIT 1);",
        "SET @soil_id2 = (SELECT id FROM soil_library WHERE name LIKE '%pha sét%' LIMIT 1);",
        "",
        "INSERT INTO crop_season (device_id, crop_id, soil_id, start_date, initial_root_depth, status,",
        "    created_at, updated_at, deleted_at)",
        "SELECT @device_id, @crop_id2, @soil_id2, DATE_SUB(CURDATE(), INTERVAL 70 DAY), 0.15, 'ACTIVE',",
        "       NOW(), NOW(), NULL",
        "WHERE @device_id IS NOT NULL AND @crop_id2 IS NOT NULL AND @soil_id2 IS NOT NULL",
        "  AND NOT EXISTS (SELECT 1 FROM crop_season WHERE device_id = @device_id AND status = 'ACTIVE');",
    ]

    # 6. Water balance state
    wb = final_wb
    lines += [
        "",
        "-- 6. Water balance state — kết quả từ 7 ngày mô phỏng FAO-56",
        "INSERT INTO device_water_balance_state",
        "    (device_id, shallow_depletion, shallow_taw, shallow_raw,",
        "     deep_depletion, deep_taw, deep_raw, last_irrigation,",
        f"    soil_moist_history, depletion_history, etc_history,",
        "     created_at, updated_at, deleted_at)",
        f"SELECT @device_id,",
        f"    {wb['shallow_depletion']}, {wb['shallow_taw']}, {wb['shallow_raw']},",
        f"    {wb['deep_depletion']},   {wb['deep_taw']},    {wb['deep_raw']},",
        f"    {wb['last_irrigation']},",
        "    '[]', '[]', '[]',",
        "    NOW(), NOW(), NULL",
        "WHERE @device_id IS NOT NULL",
        "  AND NOT EXISTS (SELECT 1 FROM device_water_balance_state WHERE device_id = @device_id);",
    ]

    # 7. Irrigation config
    lines += [
        "",
        "-- 7. Irrigation config — ai_enabled, pump_flow_rate, nozzle_count",
        "INSERT INTO irrigation_config",
        "    (device_id, soil_moisture_min, soil_moisture_max, soil_moisture_optimal,",
        "     temp_min, temp_max, light_threshold,",
        "     irrigation_duration_min, irrigation_duration_max,",
        f"    fuzzy_enabled, auto_mode, ai_enabled,",
        f"    pump_flow_rate, nozzle_count,",
        "     created_at, updated_at, deleted_at)",
        f"SELECT @device_id,",
        "    20.0, 60.0, 40.0,",
        "    15.0, 38.0, 1000.0,",
        "    30, 1800,",
        "    1, 1, 1,",
        f"    {PUMP_FLOW_RATE}, {NOZZLE_COUNT},",
        "    NOW(), NOW(), NULL",
        "WHERE @device_id IS NOT NULL",
        "  AND NOT EXISTS (SELECT 1 FROM irrigation_config WHERE device_id = @device_id);",
        "",
        "-- Done. Verify with:",
        "-- SELECT COUNT(*) FROM sensor_data WHERE device_id = @device_id;",
        "-- SELECT * FROM device_water_balance_state WHERE device_id = @device_id;",
    ]

    return "\n".join(lines) + "\n"


# ═══════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(
        description="Generate SQL seed data for device 2 following generate_dataset.py physics rules.",
    )
    ap.add_argument(
        "--device-id", type=int, default=None,
        help="Nếu device đã tồn tại trong DB, truyền ID để bỏ qua INSERT devices. "
             "Mặc định: tự INSERT SG-002.",
    )
    ap.add_argument(
        "--records", type=int, default=1008,
        help="Số bản ghi sensor_data (mặc định 1008 = 7 ngày × 144 bản ghi/ngày).",
    )
    ap.add_argument(
        "--interval", type=int, default=10,
        help="Khoảng cách giữa các mẫu sensor (phút, mặc định 10).",
    )
    ap.add_argument(
        "--seed", type=int, default=7,
        help="Random seed cho tái tạo dữ liệu.",
    )
    ap.add_argument(
        "--out", type=Path, default=None,
        help="File SQL đầu ra (mặc định: data/seed_device2.sql).",
    )
    args = ap.parse_args()

    out_path = args.out or (REPO_ROOT / "data" / "seed_device2.sql")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[seed_device2] Generating {args.records} sensor rows "
          f"({args.interval}-min interval, seed={args.seed}) ...")

    rows, final_wb = generate_sensor_rows(
        n_records=args.records,
        seed=args.seed,
        interval_min=args.interval,
    )

    sql = build_sql(rows, final_wb, device_id_override=args.device_id)
    out_path.write_text(sql, encoding="utf-8")

    # Summary
    temps  = [r["temp"]     for r in rows]
    rhs    = [r["humidity"] for r in rows]
    sm1s   = [r["sm1"]      for r in rows]
    sm2s   = [r["sm2"]      for r in rows]
    lights = [r["light"]    for r in rows]
    rains  = sum(r["rain"]  for r in rows)

    print(f"\n{'='*55}")
    print(f"  Output        : {out_path}")
    print(f"  Sensor rows   : {len(rows)}")
    print(f"  Time range    : {rows[0]['timestamp']} → {rows[-1]['timestamp']}")
    print(f"  Temp (°C)     : min={min(temps):.1f}  mean={sum(temps)/len(temps):.1f}  max={max(temps):.1f}")
    print(f"  Humidity (%)  : min={min(rhs):.1f}  mean={sum(rhs)/len(rhs):.1f}  max={max(rhs):.1f}")
    print(f"  SM-1 (%)      : min={min(sm1s):.1f}  mean={sum(sm1s)/len(sm1s):.1f}  max={max(sm1s):.1f}")
    print(f"  SM-2 (%)      : min={min(sm2s):.1f}  mean={sum(sm2s)/len(sm2s):.1f}  max={max(sm2s):.1f}")
    print(f"  Light (lux)   : min={min(lights):.0f}  max={max(lights):.0f}")
    print(f"  Rain events   : {rains} / {len(rows)} records")
    print(f"  Water balance : shallow_depl={final_wb['shallow_depletion']} mm, "
          f"deep_depl={final_wb['deep_depletion']} mm")
    print(f"{'='*55}")
    print(f"\nRun SQL:")
    print(f"  mysql -u USER -p YOUR_DB < {out_path}")
    print(f"\nOr with device_id override:")
    print(f"  python scripts/seed_device2_data.py --device-id 2")


if __name__ == "__main__":
    main()
