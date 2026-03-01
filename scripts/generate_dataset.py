#!/usr/bin/env python3
"""
Tạo synthetic dataset để train mô hình ML dự đoán depletion_after_24h.

Hỗ trợ nhiều vị trí (configurable climate):
  - Hà Nội (21°N): khí hậu 4 mùa, biên độ nhiệt lớn, mùa đông lạnh
  - TP.HCM (10.8°N): khí hậu nhiệt đới gió mùa, 2 mùa mưa/khô

Mô phỏng:
  - Nhiều loại cây trồng × loại đất × giai đoạn sinh trưởng
  - Chu kỳ ngày/đêm (nhiệt độ, bức xạ, ETo) theo vùng
  - Mưa stochastic theo mùa (Markov chain)
  - Cân bằng nước FAO-56 (multi-layer)
  - AR(1) autocorrelation cho weather drivers (temp, humidity, wind, cloud)
    để phản ánh tính liên tục thời gian thực tế trong nông nghiệp

Output: CSV sẵn sàng cho scripts/train_rf.py hoặc train_xgb.py

Usage:
    python scripts/generate_dataset.py --location hanoi
    python scripts/generate_dataset.py --location hcm --n-samples 5000
    python scripts/generate_dataset.py --out data/training_data.csv
"""

import argparse
import logging
import math
import sys
from collections import deque
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

# Thêm ai-service vào path
_REPO_ROOT = Path(__file__).resolve().parent.parent
_AI_SERVICE = _REPO_ROOT / "ai-service"
sys.path.insert(0, str(_AI_SERVICE))

from app.ml.pipeline_builder import NUMERIC_FEATURES, CATEGORICAL_FEATURES
from app.services.fao_service import FaoService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════
# CROP PROFILES — Kc, root depth, growth stage durations
# ═══════════════════════════════════════════════════════════

CROP_PROFILES = {
    "tomato": {
        "kc_stages": {"initial": 0.60, "development": 0.80, "mid": 1.15, "end": 0.80},
        "root_depth": {"initial": 0.15, "development": 0.25, "mid": 0.40, "end": 0.40},
        "stage_days": {"initial": 30, "development": 40, "mid": 50, "end": 30},
        "crop_height": {"initial": 0.15, "development": 0.40, "mid": 0.60, "end": 0.60},
    },
    "lettuce": {
        "kc_stages": {"initial": 0.70, "development": 0.85, "mid": 1.00, "end": 0.95},
        "root_depth": {"initial": 0.10, "development": 0.15, "mid": 0.25, "end": 0.25},
        "stage_days": {"initial": 20, "development": 25, "mid": 30, "end": 15},
        "crop_height": {"initial": 0.10, "development": 0.20, "mid": 0.30, "end": 0.30},
    },
    "pepper": {
        "kc_stages": {"initial": 0.60, "development": 0.75, "mid": 1.05, "end": 0.90},
        "root_depth": {"initial": 0.15, "development": 0.30, "mid": 0.50, "end": 0.50},
        "stage_days": {"initial": 25, "development": 35, "mid": 45, "end": 25},
        "crop_height": {"initial": 0.15, "development": 0.35, "mid": 0.50, "end": 0.50},
    },
    "cucumber": {
        "kc_stages": {"initial": 0.60, "development": 0.80, "mid": 1.00, "end": 0.75},
        "root_depth": {"initial": 0.10, "development": 0.20, "mid": 0.35, "end": 0.35},
        "stage_days": {"initial": 20, "development": 30, "mid": 35, "end": 15},
        "crop_height": {"initial": 0.20, "development": 0.40, "mid": 0.60, "end": 0.60},
    },
    "rice": {
        "kc_stages": {"initial": 1.05, "development": 1.10, "mid": 1.20, "end": 0.90},
        "root_depth": {"initial": 0.10, "development": 0.20, "mid": 0.30, "end": 0.30},
        "stage_days": {"initial": 30, "development": 30, "mid": 60, "end": 30},
        "crop_height": {"initial": 0.15, "development": 0.40, "mid": 0.80, "end": 0.80},
    },
}

# ═══════════════════════════════════════════════════════════
# SOIL PROFILES — FC, WP, infiltration physics
# ═══════════════════════════════════════════════════════════

SOIL_PROFILES = {
    "sandy": {
        "field_capacity": 18.0,    # % vol
        "wilting_point": 8.0,      # % vol
        "infiltration_shallow_ratio": 0.55,  # sand → water percolates deeper
    },
    "loam": {
        "field_capacity": 28.0,
        "wilting_point": 13.0,
        "infiltration_shallow_ratio": 0.70,  # default
    },
    "clay": {
        "field_capacity": 38.0,
        "wilting_point": 22.0,
        "infiltration_shallow_ratio": 0.85,  # clay → water stays shallow
    },
    "sandy_loam": {
        "field_capacity": 23.0,
        "wilting_point": 10.0,
        "infiltration_shallow_ratio": 0.60,
    },
    "clay_loam": {
        "field_capacity": 33.0,
        "wilting_point": 18.0,
        "infiltration_shallow_ratio": 0.78,
    },
}

# ═══════════════════════════════════════════════════════════
# LOCATION PROFILES — configurable climate per region
# ═══════════════════════════════════════════════════════════

LOCATION_PROFILES = {
    # ── Hà Nội: 21.03°N, 4 mùa rõ rệt ──────────────────
    "hanoi": {
        "latitude": 21.03,
        "altitude": 12.0,
        "temp_mean_by_month": {
            1: 17.0, 2: 18.0, 3: 21.0, 4: 24.5,
            5: 28.0, 6: 29.5, 7: 29.5, 8: 28.5,
            9: 27.5, 10: 25.0, 11: 21.5, 12: 18.0,
        },
        "humidity_base_by_month": {
            1: 72, 2: 82, 3: 87, 4: 85,
            5: 80, 6: 82, 7: 83, 8: 85,
            9: 82, 10: 78, 11: 74, 12: 72,
        },
        "rain_prob_by_month": {
            1: 0.03, 2: 0.04, 3: 0.05, 4: 0.07,
            5: 0.10, 6: 0.14, 7: 0.16, 8: 0.15,
            9: 0.12, 10: 0.07, 11: 0.04, 12: 0.02,
        },
        "rain_intensity_by_month": {
            1: 2.0, 2: 3.0, 3: 4.0, 4: 6.0,
            5: 8.0, 6: 12.0, 7: 15.0, 8: 14.0,
            9: 10.0, 10: 6.0, 11: 3.0, 12: 2.0,
        },
        "diurnal_temp_amplitude_by_month": {
            1: 7.0, 2: 5.5, 3: 5.0, 4: 5.5,
            5: 5.0, 6: 4.5, 7: 4.0, 8: 4.0,
            9: 5.0, 10: 6.0, 11: 7.0, 12: 7.5,
        },
        "wind_speed_mean_by_month": {
            1: 2.5, 2: 2.2, 3: 2.0, 4: 2.0,
            5: 2.0, 6: 1.8, 7: 1.8, 8: 1.8,
            9: 2.0, 10: 2.5, 11: 2.8, 12: 3.0,
        },
        "cloud_cover_params_by_month": {
            1: (3, 3), 2: (4, 2), 3: (5, 2), 4: (4, 2),
            5: (3, 3), 6: (3, 2), 7: (3, 2), 8: (3, 2),
            9: (3, 3), 10: (2, 3), 11: (2, 4), 12: (3, 3),
        },
        "sunrise_hour_by_month": {
            1: 6.6, 2: 6.4, 3: 6.0, 4: 5.6,
            5: 5.3, 6: 5.2, 7: 5.3, 8: 5.5,
            9: 5.7, 10: 5.8, 11: 6.1, 12: 6.4,
        },
        "sunset_hour_by_month": {
            1: 17.4, 2: 17.7, 3: 18.0, 4: 18.2,
            5: 18.5, 6: 18.7, 7: 18.6, 8: 18.4,
            9: 18.0, 10: 17.6, 11: 17.3, 12: 17.2,
        },
    },
    # ── TP.HCM: 10.8°N, 2 mùa mưa/khô ──────────────────
    "hcm": {
        "latitude": 10.8,
        "altitude": 10.0,
        "temp_mean_by_month": {
            1: 26.0, 2: 27.0, 3: 28.5, 4: 29.5,
            5: 29.0, 6: 28.0, 7: 27.5, 8: 27.5,
            9: 27.0, 10: 27.0, 11: 27.0, 12: 26.0,
        },
        "humidity_base_by_month": {
            1: 65, 2: 63, 3: 63, 4: 67,
            5: 75, 6: 78, 7: 78, 8: 78,
            9: 80, 10: 78, 11: 75, 12: 68,
        },
        "rain_prob_by_month": {
            1: 0.02, 2: 0.01, 3: 0.02, 4: 0.05,
            5: 0.12, 6: 0.15, 7: 0.15, 8: 0.16,
            9: 0.18, 10: 0.16, 11: 0.10, 12: 0.04,
        },
        "rain_intensity_by_month": {
            1: 3.0, 2: 2.0, 3: 3.0, 4: 5.0,
            5: 8.0, 6: 10.0, 7: 10.0, 8: 10.0,
            9: 12.0, 10: 10.0, 11: 7.0, 12: 4.0,
        },
        "diurnal_temp_amplitude_by_month": {
            1: 3.5, 2: 3.5, 3: 3.5, 4: 3.5,
            5: 3.5, 6: 3.5, 7: 3.5, 8: 3.5,
            9: 3.5, 10: 3.5, 11: 3.5, 12: 3.5,
        },
        "wind_speed_mean_by_month": {
            1: 2.0, 2: 2.0, 3: 2.0, 4: 2.0,
            5: 2.0, 6: 2.0, 7: 2.0, 8: 2.0,
            9: 2.0, 10: 2.0, 11: 2.0, 12: 2.0,
        },
        "cloud_cover_params_by_month": {
            1: (2, 3), 2: (2, 3), 3: (2, 3), 4: (2, 3),
            5: (3, 2), 6: (3, 2), 7: (3, 2), 8: (3, 2),
            9: (3, 2), 10: (3, 2), 11: (3, 2), 12: (2, 3),
        },
        "sunrise_hour_by_month": {
            1: 6.3, 2: 6.2, 3: 6.0, 4: 5.8,
            5: 5.6, 6: 5.6, 7: 5.7, 8: 5.8,
            9: 5.8, 10: 5.8, 11: 5.9, 12: 6.2,
        },
        "sunset_hour_by_month": {
            1: 17.6, 2: 17.8, 3: 18.0, 4: 18.1,
            5: 18.2, 6: 18.3, 7: 18.3, 8: 18.2,
            9: 17.9, 10: 17.7, 11: 17.5, 12: 17.5,
        },
    },
}

DEFAULT_LOCATION = "hanoi"

# ═══════════════════════════════════════════════════════════
# AR(1) AUTOCORRELATION COEFFICIENTS
# Typical lag-1 autocorrelation (ρ) for hourly agricultural weather.
# X(t) = deterministic_base(t) + ε(t)
# ε(t) = ρ * ε(t-1) + σ * √(1-ρ²) * z(t),  z ~ N(0,1)
# This ensures Corr(ε(t), ε(t-k)) = ρ^k  and  Var(ε) = σ²
# ═══════════════════════════════════════════════════════════

AR1_RHO = {
    "temp": 0.92,         # temperature very persistent hour-to-hour
    "humidity": 0.88,     # RH slightly less persistent
    "wind": 0.80,         # wind shifts more frequently
    "cloud": 0.93,        # cloud cover very persistent
}
AR1_SIGMA = {
    "temp": 0.8,          # innovation std (°C) — controls hourly variability
    "humidity": 4.0,      # innovation std (% RH)
    "wind": 0.6,          # innovation std (m/s)
    "cloud": 0.08,        # innovation std (fraction 0-1)
}

# Rain Markov chain: P(rain_t | rain_{t-1})
RAIN_PERSIST_PROB = 0.75   # P(rain | was raining last hour)
RAIN_STOP_PROB = 0.25      # P(no rain | was raining last hour)


def _ar1_step(prev_epsilon: float, rho: float, sigma: float,
              rng: np.random.Generator) -> float:
    """One step of an AR(1) process: ε(t) = ρ·ε(t-1) + σ·√(1-ρ²)·z."""
    innovation_scale = sigma * math.sqrt(max(0, 1.0 - rho ** 2))
    return rho * prev_epsilon + innovation_scale * rng.normal()


def _diurnal_temp(hour: int, base_temp: float, amplitude: float,
                  rng: np.random.Generator, eps: float = 0.0) -> tuple[float, float]:
    """
    Nhiệt độ theo giờ với AR(1) autocorrelation.
    Returns: (temperature, new_epsilon)
    """
    phase = 2 * math.pi * (hour - 14) / 24
    new_eps = _ar1_step(eps, AR1_RHO["temp"], AR1_SIGMA["temp"], rng)
    temp = base_temp + amplitude * math.cos(phase) + new_eps
    return temp, new_eps


def _diurnal_temp_noiseless(hour: int, base_temp: float,
                            amplitude: float) -> float:
    """Deterministic diurnal temperature (no random noise)."""
    phase = 2 * math.pi * (hour - 14) / 24
    return base_temp + amplitude * math.cos(phase)


def _diurnal_humidity(hour: int, base_rh: float,
                      rng: np.random.Generator, eps: float = 0.0) -> tuple[float, float]:
    """Độ ẩm theo giờ với AR(1) autocorrelation."""
    amplitude = 12
    phase = 2 * math.pi * (hour - 4) / 24
    new_eps = _ar1_step(eps, AR1_RHO["humidity"], AR1_SIGMA["humidity"], rng)
    rh = base_rh + amplitude * math.cos(phase) + new_eps
    return float(np.clip(rh, 30, 100)), new_eps


def _diurnal_humidity_noiseless(hour: int, base_rh: float) -> float:
    """Deterministic diurnal humidity (no random noise)."""
    amplitude = 12
    phase = 2 * math.pi * (hour - 4) / 24
    return float(np.clip(base_rh + amplitude * math.cos(phase), 30, 100))


def _ar1_wind(wind_mean: float, rng: np.random.Generator,
              eps: float = 0.0) -> tuple[float, float]:
    """Wind speed with AR(1) autocorrelation."""
    new_eps = _ar1_step(eps, AR1_RHO["wind"], AR1_SIGMA["wind"], rng)
    return max(0.3, wind_mean + new_eps), new_eps


def _ar1_cloud(cc_a: float, cc_b: float, rng: np.random.Generator,
               eps: float = 0.0) -> tuple[float, float]:
    """Cloud cover with AR(1) autocorrelation around Beta-distributed mean."""
    base_cc = cc_a / (cc_a + cc_b)
    new_eps = _ar1_step(eps, AR1_RHO["cloud"], AR1_SIGMA["cloud"], rng)
    cc = float(np.clip(base_cc + new_eps, 0.0, 1.0))
    return cc, new_eps


def _markov_rain(prev_raining: bool, base_rain_prob: float, hour: int,
                 rng: np.random.Generator) -> bool:
    """
    Rain occurrence via Markov chain (persistence).
    If was raining: P(continue) = RAIN_PERSIST_PROB
    If was dry:     P(start) = base_rain_prob (with diurnal modulation)
    """
    if prev_raining:
        return rng.random() < RAIN_PERSIST_PROB
    # Diurnal rain probability modulation (afternoon peak)
    prob = base_rain_prob
    if 14 <= hour <= 20:
        prob *= 2.0
    elif hour < 6 or hour > 22:
        prob *= 0.3
    return rng.random() < prob


def _solar_radiation_hourly(hour: int, sunrise: float, sunset: float,
                            cloud_cover: float,
                            rng: np.random.Generator) -> float:
    """
    Bức xạ mặt trời theo giờ (MJ/m²/h).
    Sunrise/sunset from location profile. Peak at solar noon.
    """
    if hour < sunrise or hour >= sunset:
        return 0.0
    midday = (sunrise + sunset) / 2.0
    half_day = (sunset - sunrise) / 2.0
    x = (hour - midday) / half_day  # [-1, 1]
    clear_sky = 3.0 * (1 - x ** 2)
    cloud_factor = 1.0 - 0.7 * cloud_cover
    noise = max(0, rng.normal(1.0, 0.05))
    return max(0.0, clear_sky * cloud_factor * noise)


def _solar_radiation_hourly_noiseless(hour: int, sunrise: float,
                                      sunset: float,
                                      cloud_cover: float) -> float:
    """Deterministic hourly solar radiation (no random noise)."""
    if hour < sunrise or hour >= sunset:
        return 0.0
    midday = (sunrise + sunset) / 2.0
    half_day = (sunset - sunrise) / 2.0
    x = (hour - midday) / half_day
    clear_sky = 3.0 * (1 - x ** 2)
    cloud_factor = 1.0 - 0.7 * cloud_cover
    return max(0.0, clear_sky * cloud_factor)


def _lux_from_solar(solar_mj_h: float, rng: np.random.Generator) -> float:
    """Convert MJ/m²/h → lux (approximate). 1 W/m² ≈ 120 lux."""
    watt_per_m2 = solar_mj_h * 1e6 / 3600
    lux = watt_per_m2 * 120
    return max(0.0, lux * rng.normal(1.0, 0.03))


def get_growth_stage(day_in_season: int, crop_type: str) -> str:
    """Xác định giai đoạn sinh trưởng dựa trên ngày trong mùa."""
    profile = CROP_PROFILES[crop_type]
    durations = profile["stage_days"]
    cum = 0
    for stage in ["initial", "development", "mid", "end"]:
        cum += durations[stage]
        if day_in_season < cum:
            return stage
    return "end"


def _hourly_cloud_cover(base_cc: float, hour: int) -> float:
    """Diurnal cloud variation: clearer mornings, cloudier afternoons (tropical)."""
    if 6 <= hour < 12:
        return min(1.0, base_cc * 0.8)
    elif 12 <= hour < 18:
        return min(1.0, base_cc * 1.2)
    return min(1.0, base_cc)


def _compute_ks(depletion: float, taw: float, raw: float) -> float:
    """Non-linear water stress coefficient Ks. Ks=1 when Dr<=RAW. Returns an exponential curve."""
    if taw <= raw or depletion <= raw:
        return 1.0
    # Roots experience sudden shutdown near wilting point (nonlinear)
    stress_ratio = (taw - depletion) / (taw - raw)
    return max(0.0, stress_ratio ** 1.5)


def generate_dataset(
    n_samples: int = 35040,
    start_date: datetime | None = None,
    interval_hours: int = 1,
    seed: int = 42,
    location: str = DEFAULT_LOCATION,
) -> pd.DataFrame:
    """
    Tạo synthetic dataset cho RF training.

    Args:
        n_samples: Số dòng dữ liệu cần tạo
        start_date: Thời điểm bắt đầu (mặc định 2024-01-01)
        interval_hours: Khoảng cách giữa các mẫu (giờ)
        seed: Random seed
        location: Tên vùng khí hậu ("hanoi" hoặc "hcm")

    Returns:
        DataFrame sẵn sàng cho train_rf.py
    """
    if location not in LOCATION_PROFILES:
        raise ValueError(f"Unknown location '{location}'. Choose from: {list(LOCATION_PROFILES)}")

    loc = LOCATION_PROFILES[location]
    latitude = loc["latitude"]
    altitude = loc["altitude"]

    rng = np.random.default_rng(seed)
    fao = FaoService()

    logger.info("Location: %s (lat=%.2f, alt=%.0fm)", location, latitude, altitude)

    if start_date is None:
        start_date = datetime(2024, 1, 1, 0, 0, 0)  # 4 năm liên tục

    crop_types = list(CROP_PROFILES.keys())
    soil_types = list(SOIL_PROFILES.keys())

    # Round-robin qua tất cả crop × soil combinations
    combinations = [(c, s) for c in crop_types for s in soil_types]
    rng.shuffle(combinations)

    # Mỗi combo được phân bổ ~ n_samples / n_combos mẫu
    samples_per_combo = max(48, n_samples // len(combinations))  # ít nhất 2 ngày

    rows = []
    # Seasons chạy liên tục theo thời gian (4 năm)
    # Vì có 25 crop×soil combos, mỗi combo chiếm ~1400 giờ (~58 ngày)
    # → tổng ~4 năm → train/test đều cover đủ representative data mỗi mùa
    current_time = start_date

    sample_idx = 0
    season_id = 0
    combo_idx = 0

    while sample_idx < n_samples:
        crop_type, soil_type = combinations[combo_idx % len(combinations)]
        combo_idx += 1

        # Thời gian chạy liên tục — KHÔNG random month
        depl_buffer = deque(maxlen=24)
        rain_buffer = deque(maxlen=24)
        etc_buffer = deque(maxlen=24)
        light_buffer = deque(maxlen=24)
        wind_buffer = deque(maxlen=24)
        hours_since_last_rain = 72  # Assume land has been dry for 3 days

        # AR(1) state for autocorrelated weather (ε starts at 0 = climatological mean)
        eps_temp = 0.0
        eps_rh = 0.0
        eps_wind = 0.0
        eps_cloud = 0.0
        prev_raining = False

        profile = CROP_PROFILES[crop_type]
        soil = SOIL_PROFILES[soil_type]

        fc = soil["field_capacity"]
        wp = soil["wilting_point"]
        inf_shallow_ratio = soil["infiltration_shallow_ratio"]

        total_season_days = sum(profile["stage_days"].values())
        season_hours = total_season_days * 24
        depletion_frac = 0.5  # p factor

        # TAW/RAW multi-layer
        root_depth_max = profile["root_depth"]["mid"]
        taw_total = 1000 * (fc - wp) / 100.0 * root_depth_max
        shallow_taw = taw_total * 0.4
        deep_taw = taw_total * 0.6
        raw_total = depletion_frac * taw_total

        # Initial state: start near field capacity (light depletion)
        shallow_depl = rng.uniform(0, shallow_taw * 0.3)
        deep_depl = rng.uniform(0, deep_taw * 0.2)
        prev_soil_avg = fc - (0.6 * deep_depl + 0.4 * shallow_depl) / (taw_total + 1e-6) * (fc - wp)

        # Bắt đầu từ ngày ngẫu nhiên trong mùa vụ → đảm bảo đủ 4 growth stages
        start_day_offset = rng.integers(0, total_season_days)

        logger.info(
            "Season %d: %s on %s soil, %d days (offset +%d), starting at %s",
            season_id, crop_type, soil_type, total_season_days, start_day_offset,
            current_time.strftime("%Y-%m-%d"),
        )

        for hour_in_season in range(0, min(season_hours, samples_per_combo * interval_hours, (n_samples - sample_idx) * interval_hours), interval_hours):
            current_time += timedelta(hours=interval_hours)
            day_in_season = (start_day_offset + hour_in_season // 24) % total_season_days
            hour = current_time.hour
            month = current_time.month

            # ── Growth stage & Kc ──
            growth_stage = get_growth_stage(day_in_season, crop_type)
            kc = profile["kc_stages"][growth_stage]
            root_depth = profile["root_depth"][growth_stage]
            crop_height = profile["crop_height"][growth_stage]

            # ── Weather with AR(1) autocorrelation ──
            base_temp = loc["temp_mean_by_month"][month]
            temp_amp = loc["diurnal_temp_amplitude_by_month"][month]
            temp, eps_temp = _diurnal_temp(hour, base_temp, temp_amp, rng, eps_temp)

            base_rh = loc["humidity_base_by_month"][month]
            humidity, eps_rh = _diurnal_humidity(hour, base_rh, rng, eps_rh)

            wind_mean = loc["wind_speed_mean_by_month"][month]
            wind_speed, eps_wind = _ar1_wind(wind_mean, rng, eps_wind)

            cc_a, cc_b = loc["cloud_cover_params_by_month"][month]
            cloud_cover, eps_cloud = _ar1_cloud(cc_a, cc_b, rng, eps=eps_cloud)
            sunrise = loc["sunrise_hour_by_month"][month]
            sunset = loc["sunset_hour_by_month"][month]
            solar_rad_h = _solar_radiation_hourly(hour, sunrise, sunset, cloud_cover, rng)
            light = _lux_from_solar(solar_rad_h, rng)

            # ── Rain (Markov chain — autocorrelated) ──
            rain_prob = loc["rain_prob_by_month"][month]
            has_rain = _markov_rain(prev_raining, rain_prob, hour, rng)
            prev_raining = has_rain
            rain_amount = 0.0
            if has_rain:
                mean_intensity = loc["rain_intensity_by_month"][month]
                rain_amount = max(0.5, rng.exponential(mean_intensity))

            expected_daily = loc["rain_intensity_by_month"][month] * loc["rain_prob_by_month"][month] * 24
            forecast_rain_d0 = max(0, rng.normal(expected_daily, expected_daily * 0.3))
            forecast_rain_d1 = max(0, rng.normal(expected_daily, expected_daily * 0.4))
            forecast_rain_d2 = max(0, rng.normal(expected_daily, expected_daily * 0.5))

            # Effective rain for water balance
            if rain_amount > 0:
                eff_rain = rain_amount * (0.80 if rain_amount > 5 else 0.85)
                hours_since_last_rain = 0
            else:
                eff_rain = 0.0
                hours_since_last_rain += 1

            # ── ETo / ETc (via FaoService for consistency with inference) ──
            doy = current_time.timetuple().tm_yday
            eto = fao.calculate_hourly_eto(
                temp=temp, humidity=humidity,
                wind_speed=wind_speed,
                solar_radiation_hourly=solar_rad_h,
                day_of_year=doy, hour=hour,
                latitude=latitude, altitude=altitude,
            )
            prev_weighted_depl = 0.6 * deep_depl + 0.4 * shallow_depl
            ks = _compute_ks(prev_weighted_depl, taw_total, raw_total)
            etc = eto * kc * ks

            # ── Superficial Runoff Physics ──
            # Heavy rain causes runoff, reducing water entering the deep soil layer.
            current_inf_shallow = inf_shallow_ratio
            if eff_rain > 15.0:
                current_inf_shallow = min(0.95, inf_shallow_ratio * 1.3)
            elif eff_rain > 5.0 and soil_avg > fc * 0.9:
                current_inf_shallow = min(0.90, inf_shallow_ratio * 1.2)

            # ── Water balance update (per-layer) ──
            etc_shallow = etc * 0.4
            etc_deep = etc * 0.6
            rain_shallow = eff_rain * current_inf_shallow
            rain_deep = eff_rain * (1 - current_inf_shallow)

            # Occasional irrigation (when depletion > RAW)
            irrigation = 0.0
            if prev_weighted_depl > raw_total * 0.8:
                irrigation = prev_weighted_depl * rng.uniform(0.6, 1.0)

            irr_shallow = irrigation * inf_shallow_ratio
            irr_deep = irrigation * (1 - inf_shallow_ratio)

            # Update layer depletions
            shallow_depl = max(0.0, min(shallow_taw,
                               shallow_depl + etc_shallow - rain_shallow - irr_shallow))
            deep_depl = max(0.0, min(deep_taw,
                           deep_depl + etc_deep - rain_deep - irr_deep))

            weighted_depl = 0.6 * deep_depl + 0.4 * shallow_depl

            # ── Soil moisture (derived from depletion state) ──
            # SM = FC - (depletion / TAW) * (FC - WP) + noise
            sm_noise = rng.normal(0, 1.0)
            soil_moist_shallow = np.clip(
                fc - (shallow_depl / max(shallow_taw, 1e-6)) * (fc - wp) + sm_noise,
                wp * 0.5, fc * 1.1
            )
            soil_moist_deep = np.clip(
                fc - (deep_depl / max(deep_taw, 1e-6)) * (fc - wp) + rng.normal(0, 0.8),
                wp * 0.5, fc * 1.1
            )
            soil_avg = (soil_moist_shallow + soil_moist_deep) / 2.0

            # Trend
            soil_trend = soil_avg - prev_soil_avg
            prev_soil_avg = soil_avg

            # ── Lag features (multi-window: 6h / 12h / 24h) ──
            depl_buffer.append(weighted_depl)
            rain_buffer.append(rain_amount)
            etc_buffer.append(etc)
            light_buffer.append(light)
            wind_buffer.append(wind_speed)

            def _buf_trend(buf, window):
                if len(buf) < 2:
                    return 0.0
                start = max(0, len(buf) - window)
                return buf[-1] - buf[start]

            def _buf_sum(buf, window):
                start = max(0, len(buf) - window)
                return sum(list(buf)[start:])

            def _buf_mean(buf, window):
                start = max(0, len(buf) - window)
                sl = list(buf)[start:]
                return sum(sl) / len(sl) if sl else 0.0

            depletion_trend_6h = _buf_trend(depl_buffer, 6)
            rain_last_6h = _buf_sum(rain_buffer, 6)
            etc_rolling_6h = _buf_mean(etc_buffer, 6)
            depletion_trend_12h = _buf_trend(depl_buffer, 12)
            rain_last_12h = _buf_sum(rain_buffer, 12)
            etc_rolling_12h = _buf_mean(etc_buffer, 12)
            depletion_trend_24h = _buf_trend(depl_buffer, 24)
            rain_last_24h = _buf_sum(rain_buffer, 24)
            light_rolling_24h = _buf_sum(light_buffer, 24)
            wind_rolling_24h = _buf_mean(wind_buffer, 24)

            # ── Derived features ──
            depletion_ratio = weighted_depl / max(taw_total, 1e-6)
            soil_moist_deficit = fc - soil_avg

            temp_x_humidity = temp * humidity
            solar_x_temp = solar_rad_h * temp

            # Cyclic time
            hour_sin = math.sin(2 * math.pi * hour / 24)
            hour_cos = math.cos(2 * math.pi * hour / 24)
            month_sin = math.sin(2 * math.pi * month / 12)
            month_cos = math.cos(2 * math.pi * month / 12)

            # ══════════════════════════════════════════════════
            # TARGET: depletion_after_24h
            # Dự đoán: depletion sẽ là bao nhiêu sau 24h nữa?
            # Dùng simplified forward simulation (24 bước 1h)
            # ══════════════════════════════════════════════════
            future_shallow = shallow_depl
            future_deep = deep_depl
            # Forward AR(1) state — continues from current epsilon
            fwd_eps_t, fwd_eps_rh, fwd_eps_w = eps_temp, eps_rh, eps_wind
            fwd_eps_cc = eps_cloud
            fwd_raining = prev_raining
            for fh in range(24):
                future_hour = (hour + fh + 1) % 24
                future_doy = doy + (hour + fh + 1) // 24
                future_temp, fwd_eps_t = _diurnal_temp(
                    future_hour, base_temp, temp_amp, rng, fwd_eps_t)
                future_rh, fwd_eps_rh = _diurnal_humidity(
                    future_hour, base_rh, rng, fwd_eps_rh)
                future_wind, fwd_eps_w = _ar1_wind(wind_mean, rng, fwd_eps_w)
                future_cc, fwd_eps_cc = _ar1_cloud(
                    cc_a, cc_b, rng, eps=fwd_eps_cc)
                future_cc = _hourly_cloud_cover(future_cc, future_hour)
                future_solar = _solar_radiation_hourly(
                    future_hour, sunrise, sunset, future_cc, rng)
                future_eto = fao.calculate_hourly_eto(
                    temp=future_temp, humidity=future_rh,
                    wind_speed=future_wind,
                    solar_radiation_hourly=future_solar,
                    day_of_year=future_doy, hour=future_hour,
                    latitude=latitude, altitude=altitude,
                )
                future_w = 0.6 * future_deep + 0.4 * future_shallow
                future_ks = _compute_ks(future_w, taw_total, raw_total)
                future_etc = future_eto * kc * future_ks

                # Future rain (Markov chain, based on forecast)
                future_rain = 0.0
                fwd_raining = _markov_rain(fwd_raining, rain_prob, future_hour, rng)
                if fwd_raining:
                    if fh < 12:
                        daily_expected = forecast_rain_d0 / 24.0
                    else:
                        daily_expected = forecast_rain_d1 / 24.0
                    future_rain = max(0, rng.exponential(daily_expected + 0.1))
                    future_rain *= 0.85

                f_etc_sh = future_etc * 0.4
                f_etc_dp = future_etc * 0.6
                f_rain_sh = future_rain * inf_shallow_ratio
                f_rain_dp = future_rain * (1 - inf_shallow_ratio)

                future_shallow = max(0, min(shallow_taw, future_shallow + f_etc_sh - f_rain_sh))
                future_deep = max(0, min(deep_taw, future_deep + f_etc_dp - f_rain_dp))

            depletion_after_24h = 0.6 * future_deep + 0.4 * future_shallow

            # ══════════════════════════════════════════════════
            # DETERMINISTIC FAO-56 FORWARD SIMULATION
            # Uses expected weather (no noise) and expected rain
            # (forecast / 24) instead of stochastic realizations.
            # This mirrors what the FAO-56 engine computes at
            # inference time with only forecast data available.
            # ══════════════════════════════════════════════════
            det_shallow = shallow_depl
            det_deep = deep_depl
            etc_cumulative_24h = 0.0

            for fh in range(24):
                fh_hour = (hour + fh + 1) % 24
                fh_doy = doy + (hour + fh + 1) // 24
                fh_temp = _diurnal_temp_noiseless(fh_hour, base_temp, temp_amp)
                fh_rh = _diurnal_humidity_noiseless(fh_hour, base_rh)
                fh_cc = _hourly_cloud_cover(cloud_cover, fh_hour)
                fh_solar = _solar_radiation_hourly_noiseless(fh_hour, sunrise, sunset, fh_cc)
                fh_eto = fao.calculate_hourly_eto(
                    temp=fh_temp, humidity=fh_rh,
                    wind_speed=wind_speed,
                    solar_radiation_hourly=fh_solar,
                    day_of_year=fh_doy, hour=fh_hour,
                    latitude=latitude, altitude=altitude,
                )
                det_w = 0.6 * det_deep + 0.4 * det_shallow
                det_ks = _compute_ks(det_w, taw_total, raw_total)
                fh_etc = fh_eto * kc * det_ks
                etc_cumulative_24h += fh_etc

                if fh < 12:
                    expected_hourly_rain = (forecast_rain_d0 / 24.0) * 0.85
                else:
                    expected_hourly_rain = (forecast_rain_d1 / 24.0) * 0.85

                fh_etc_sh = fh_etc * 0.4
                fh_etc_dp = fh_etc * 0.6
                fh_rain_sh = expected_hourly_rain * inf_shallow_ratio
                fh_rain_dp = expected_hourly_rain * (1 - inf_shallow_ratio)

                det_shallow = max(0, min(shallow_taw, det_shallow + fh_etc_sh - fh_rain_sh))
                det_deep = max(0, min(deep_taw, det_deep + fh_etc_dp - fh_rain_dp))

            fao_pred_24h = 0.6 * det_deep + 0.4 * det_shallow

            # ── Hybrid features ──
            expected_rain_24h = (forecast_rain_d0 * 0.5 + forecast_rain_d1 * 0.5) * 0.85
            net_water_loss_24h = etc_cumulative_24h - expected_rain_24h
            stress_ratio = weighted_depl / max(raw_total, 1e-6)
            residual_target = depletion_after_24h - fao_pred_24h

            # ── Build row (matches pipeline_builder.NUMERIC_FEATURES) ──
            # NOTE: depletion_shallow/deep, soil_moist_avg/diff/ratio,
            #       soil_x_depletion REMOVED — see pipeline_builder.py
            row = {
                "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                # Atmospheric
                "temp": round(temp, 1),
                "humidity": round(humidity, 1),
                "light": round(light, 0),
                "wind_speed": round(wind_speed, 2),
                "forecast_rain_d0": round(forecast_rain_d0, 1),
                "forecast_rain_d1": round(forecast_rain_d1, 1),
                "forecast_rain_d2": round(forecast_rain_d2, 1),
                # Soil sensors
                "soil_moist_shallow": round(soil_moist_shallow, 1),
                "soil_moist_deep": round(soil_moist_deep, 1),
                "soil_moist_trend_1h": round(soil_trend, 3),
                # Agro-physics
                "etc": round(etc, 4),
                "kc": round(kc, 2),
                # Water balance
                "raw": round(raw_total, 2),
                "soil_moist_deficit": round(soil_moist_deficit, 1),
                # Forward-looking features (hybrid FAO-56 + RF)
                "etc_cumulative_24h": round(etc_cumulative_24h, 4),
                "net_water_loss_24h": round(net_water_loss_24h, 4),
                "stress_ratio": round(stress_ratio, 4),
                # Interactions
                "temp_x_humidity": round(temp_x_humidity, 1),
                "solar_x_temp": round(solar_x_temp, 2),
                # Seasonal interactions (season × forward-looking)
                "season_x_stress": round(month_sin * stress_ratio, 6),
                "season_x_rain": round(month_sin * net_water_loss_24h, 4),
                "season_x_etc": round(month_cos * etc_cumulative_24h, 4),
                # Cyclic time
                "hour_sin": round(hour_sin, 6),
                "hour_cos": round(hour_cos, 6),
                "month_sin": round(month_sin, 6),
                # Lag features (6h / 12h / 24h)
                "depletion_trend_6h": round(depletion_trend_6h, 4),
                "rain_last_6h": round(rain_last_6h, 2),
                "etc_rolling_6h": round(etc_rolling_6h, 4),
                "depletion_trend_12h": round(depletion_trend_12h, 4),
                "rain_last_12h": round(rain_last_12h, 2),
                "etc_rolling_12h": round(etc_rolling_12h, 4),
                "depletion_trend_24h": round(depletion_trend_24h, 4),
                "rain_last_24h": round(rain_last_24h, 2),
                "light_rolling_24h": round(light_rolling_24h, 0),
                "wind_rolling_24h": round(wind_rolling_24h, 2),
                "hours_since_last_rain": min(hours_since_last_rain, 168), # Cap at 1 week
                # Categorical
                "crop_type": crop_type,
                "growth_stage": growth_stage,
                "soil_type": soil_type,
                # FAO-56 baseline & targets
                "fao_pred_24h": round(fao_pred_24h, 4),
                "depletion_after_24h": round(depletion_after_24h, 4),
                "residual_target": round(residual_target, 4),
            }
            rows.append(row)
            sample_idx += 1
            current_time += timedelta(hours=interval_hours)

            if sample_idx >= n_samples:
                break

        season_id += 1

    df = pd.DataFrame(rows)
    logger.info("Generated %d samples across %d seasons", len(df), season_id)
    return df


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic training dataset for RF irrigation model.",
    )
    parser.add_argument(
        "--n-samples", type=int, default=35040,
        help="Số mẫu cần tạo (mặc định 35040 = 4 năm hourly).",
    )
    parser.add_argument(
        "--out", type=str, default=None,
        help="Đường dẫn file CSV output (mặc định: data/rf_training_data.csv).",
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed cho reproducibility.",
    )
    parser.add_argument(
        "--interval", type=int, default=1,
        help="Khoảng cách giữa các mẫu (giờ, mặc định 1).",
    )
    parser.add_argument(
        "--location", type=str,
        choices=list(LOCATION_PROFILES.keys()),
        default=DEFAULT_LOCATION,
        help=f"Vùng khí hậu (mặc định: {DEFAULT_LOCATION}).",
    )
    args = parser.parse_args()

    out_path = Path(args.out) if args.out else _REPO_ROOT / "data" / "rf_training_data.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = generate_dataset(
        n_samples=args.n_samples,
        interval_hours=args.interval,
        seed=args.seed,
        location=args.location,
    )

    # Summary stats
    logger.info("========== DATASET SUMMARY ==========")
    logger.info("Shape: %s", df.shape)
    logger.info("Time range: %s → %s", df["timestamp"].iloc[0], df["timestamp"].iloc[-1])
    logger.info("Crop types: %s", df["crop_type"].value_counts().to_dict())
    logger.info("Soil types: %s", df["soil_type"].value_counts().to_dict())
    logger.info("Growth stages: %s", df["growth_stage"].value_counts().to_dict())
    logger.info("Target (depletion_after_24h) stats:")
    logger.info("  min=%.2f  mean=%.2f  max=%.2f  std=%.2f",
                df["depletion_after_24h"].min(),
                df["depletion_after_24h"].mean(),
                df["depletion_after_24h"].max(),
                df["depletion_after_24h"].std())
    logger.info("FAO-56 baseline (fao_pred_24h) stats:")
    logger.info("  min=%.2f  mean=%.2f  max=%.2f  std=%.2f",
                df["fao_pred_24h"].min(),
                df["fao_pred_24h"].mean(),
                df["fao_pred_24h"].max(),
                df["fao_pred_24h"].std())
    logger.info("Residual target (actual - fao) stats:")
    logger.info("  min=%.2f  mean=%.2f  max=%.2f  std=%.2f",
                df["residual_target"].min(),
                df["residual_target"].mean(),
                df["residual_target"].max(),
                df["residual_target"].std())

    df.to_csv(out_path, index=False)
    logger.info("Saved to %s", out_path)

    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
