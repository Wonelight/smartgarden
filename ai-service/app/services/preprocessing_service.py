"""
Preprocessing Service — transforms AiPredictRequest → pd.DataFrame.

Multi-layer soil moisture: shallow (sensor 1) + deep (sensor 2).
Pipeline: cleaning → multi-layer water balance → feature engineering.
Output DataFrame ready for sklearn Pipeline (ColumnTransformer + ML model).

Hourly time-step: ETo is computed in mm/hour (not mm/day) to avoid
24× over-accumulation of depletion when the service runs every hour.

Location-aware: latitude/altitude from CropPayload drive ETo, sunrise/sunset,
and diurnal temperature amplitude for the 24h forward simulation.
"""

import logging
import math
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

DEFAULT_LATITUDE = 21.03   # Hanoi
DEFAULT_ALTITUDE = 12.0    # Hanoi

from app.models.irrigation import AiPredictRequest, WaterBalanceSnapshot
from app.services.fao_service import (
    FaoService,
    SHALLOW_LAYER_RATIO,
    DEEP_LAYER_RATIO,
    INFILTRATION_SHALLOW_RATIO,
    INFILTRATION_DEEP_RATIO,
)
from app.services.water_balance import (
    WaterBalanceStore,
    LayerState,
    WaterBalanceState,
    compute_effective_rain,
    water_balance_store,
)

logger = logging.getLogger(__name__)

# ── Feature column definitions ───────────────────────────
# Must match pipeline_builder.py exactly

NUMERIC_FEATURES = [
    # Atmospheric
    "temp", "humidity", "light",
    "wind_speed",
    "forecast_rain_d0", "forecast_rain_d1", "forecast_rain_d2",
    # Soil moisture (sensor-based)
    "soil_moist_shallow", "soil_moist_deep", "soil_moist_trend_1h",
    # Agro-physics
    "etc", "kc",
    # Water balance
    "raw",
    "soil_moist_deficit",
    # Forward-looking features (hybrid FAO-56 + ML)
    "etc_cumulative_24h",
    "net_water_loss_24h",
    "stress_ratio",
    # Interaction features
    "temp_x_humidity", "solar_x_temp",
    # Seasonal interaction features
    "season_x_stress", "season_x_rain", "season_x_etc",
    # Cyclic time features (month_cos removed — importance < 0.5%)
    "hour_sin", "hour_cos", "month_sin",
    # Lag features — multi-window short-term memory
    "depletion_trend_6h", "rain_last_6h", "etc_rolling_6h",
    "depletion_trend_12h", "rain_last_12h", "etc_rolling_12h",
    "depletion_trend_24h", "rain_last_24h",
]

CATEGORICAL_FEATURES = [
    "growth_stage",
]

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def _state_from_snapshot(snapshot: WaterBalanceSnapshot) -> WaterBalanceState:
    """Build WaterBalanceState from backend snapshot (stateless path)."""
    state = WaterBalanceState()
    state.shallow = LayerState(
        depletion=snapshot.shallow_depletion,
        taw=snapshot.shallow_taw,
        raw=snapshot.shallow_raw,
    )
    state.deep = LayerState(
        depletion=snapshot.deep_depletion,
        taw=snapshot.deep_taw,
        raw=snapshot.deep_raw,
    )
    state.last_irrigation = snapshot.last_irrigation
    return state


def _soil_trend_from_snapshot(snapshot: WaterBalanceSnapshot) -> float:
    """Soil moisture trend ~1h from snapshot.soil_moist_history if present."""
    hist = snapshot.soil_moist_history
    if not hist or len(hist) < 2:
        return 0.0
    try:
        t0 = datetime.fromisoformat(hist[0].timestamp.replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(hist[-1].timestamp.replace("Z", "+00:00"))
        elapsed_h = (t1 - t0).total_seconds() / 3600.0
        if elapsed_h < 0.01:
            return 0.0
        return (hist[-1].value - hist[0].value) / elapsed_h
    except Exception:
        return 0.0


def _compute_sunrise_sunset(latitude: float, day_of_year: int) -> tuple:
    """
    Approximate sunrise/sunset hours from latitude and day of year.
    Based on solar declination angle and hour angle geometry.
    """
    decl = 23.45 * math.sin(math.radians(360.0 / 365.0 * (day_of_year - 81)))
    lat_rad = math.radians(latitude)
    decl_rad = math.radians(decl)
    cos_ha = -math.tan(lat_rad) * math.tan(decl_rad)
    cos_ha = max(-1.0, min(1.0, cos_ha))
    ha = math.degrees(math.acos(cos_ha))
    daylight_hours = 2.0 * ha / 15.0
    solar_noon = 12.0
    return solar_noon - daylight_hours / 2.0, solar_noon + daylight_hours / 2.0


def _estimate_diurnal_amplitude(latitude: float, month: int) -> float:
    """
    Estimate diurnal temperature amplitude from latitude and month.

    Near equator (~10N): ~3.5C year-round.
    Higher latitudes (~21N): 4-5C summer, 7-8C winter (drier air = bigger swing).
    """
    base = 3.5 + abs(latitude - 10.0) * 0.2
    winter_factor = 1.0 + 0.25 * math.cos(2.0 * math.pi * (month - 1) / 12.0)
    return base * winter_factor


def _hourly_cloud_cover(base_cc: float, hour: int) -> float:
    """Diurnal cloud variation: clearer mornings, cloudier afternoons (tropical)."""
    if 6 <= hour < 12:
        return min(1.0, base_cc * 0.8)
    elif 12 <= hour < 18:
        return min(1.0, base_cc * 1.2)
    return min(1.0, base_cc)


def _compute_ks(depletion: float, taw: float, raw: float) -> float:
    """FAO-56 water stress coefficient Ks (Eq. 84). Ks=1 when Dr<=RAW."""
    if taw <= raw or depletion <= raw:
        return 1.0
    return max(0.0, (taw - depletion) / (taw - raw))


class PreprocessingService:
    """Transform raw request → engineered feature DataFrame (multi-layer)."""

    def __init__(
        self,
        fao: Optional[FaoService] = None,
        wb_store: Optional[WaterBalanceStore] = None,
    ):
        self.fao = fao or FaoService()
        self.wb = wb_store or water_balance_store

    def transform(self, request: AiPredictRequest) -> pd.DataFrame:
        """
        Full preprocessing pipeline:
        1. Cleaning (multi-layer soil mapping, domain clamp)
        2. Feature engineering (ETo, ETc, multi-layer water balance)
        3. Soil interaction features
        4. Return single-row DataFrame with ALL_FEATURES columns
        """
        s = request.sensors
        w = request.openweather
        c = request.crop

        # ── 1. Cleaning ──────────────────────────────────

        # Map capacitive sensors: sensor1 = shallow, sensor2 = deep
        soil_shallow = s.soil_moist1 if s.soil_moist1 is not None else None
        soil_deep = s.soil_moist2 if s.soil_moist2 is not None else None

        # Handle missing: if only one sensor, use it for both
        if soil_shallow is None and soil_deep is not None:
            soil_shallow = soil_deep
        elif soil_deep is None and soil_shallow is not None:
            soil_deep = soil_shallow
        elif soil_shallow is None and soil_deep is None:
            soil_shallow = 50.0
            soil_deep = 50.0

        # Soil derived features
        soil_avg = (soil_shallow + soil_deep) / 2.0
        soil_diff = soil_shallow - soil_deep
        soil_ratio = soil_shallow / (soil_deep + 1e-6)
        soil_ratio = max(0.1, min(10.0, soil_ratio))  # clamp to avoid outliers

        temp = s.temp if s.temp is not None else 25.0
        humidity = s.humidity if s.humidity is not None else 60.0
        light = s.light if s.light is not None else 0.0
        rain_sensor = s.rain if s.rain is not None else 0

        # Weather defaults
        wind_speed = w.wind_speed if w and w.wind_speed is not None else 2.0
        
        # New lag features from backend
        wind_rolling_24h = w.wind_rolling_24h if w and getattr(w, 'wind_rolling_24h', None) is not None else wind_speed
        light_rolling_24h = w.light_rolling_24h if w and getattr(w, 'light_rolling_24h', None) is not None else (light * 24.0)
        hours_since_last_rain = w.hours_since_last_rain if w and getattr(w, 'hours_since_last_rain', None) is not None else 72

        # Legacy single-day forecast (keep for backward compat or immediate input)
        forecast_rain = w.forecast_rain if w and w.forecast_rain is not None else 0.0
        
        # Flatten Daily Forecasts
        forecast_rain_d0 = 0.0
        forecast_rain_d1 = 0.0
        forecast_rain_d2 = 0.0
        if w and w.daily_forecasts:
            sorted_forecasts = sorted(w.daily_forecasts, key=lambda x: x.date)
            if len(sorted_forecasts) > 0:
                forecast_rain_d0 = sorted_forecasts[0].total_rain or 0.0
            if len(sorted_forecasts) > 1:
                forecast_rain_d1 = sorted_forecasts[1].total_rain or 0.0
            if len(sorted_forecasts) > 2:
                forecast_rain_d2 = sorted_forecasts[2].total_rain or 0.0
        
        effective_rain_input = max(forecast_rain, forecast_rain_d0)

        solar_rad_hourly = self._get_solar_radiation_hourly(w, light)
        atm_pressure = w.atmospheric_pressure if w and w.atmospheric_pressure is not None else None

        # Crop defaults
        kc = c.kc_current if c and c.kc_current is not None else 1.0
        root_depth = c.root_depth if c and c.root_depth is not None else 0.3
        fc = c.field_capacity if c and c.field_capacity is not None else 30.0
        wp = c.wilting_point if c and c.wilting_point is not None else 15.0
        depletion_frac = c.depletion_fraction if c and c.depletion_fraction is not None else 0.5
        crop_type = c.type if c and c.type is not None else "unknown"
        growth_stage = c.growth_stage if c and c.growth_stage is not None else "initial"
        soil_type = c.soil_type if c and c.soil_type is not None else "unknown"
        crop_height = c.crop_height if c and c.crop_height is not None else 0.5
        latitude = c.latitude if c and c.latitude is not None else DEFAULT_LATITUDE
        altitude = c.altitude if c and c.altitude is not None else DEFAULT_ALTITUDE

        inf_shallow = c.infiltration_shallow_ratio if c and c.infiltration_shallow_ratio is not None else INFILTRATION_SHALLOW_RATIO
        inf_shallow = max(0.2, min(0.9, float(inf_shallow)))
        inf_deep = 1.0 - inf_shallow

        # ── 2. ETo / ETc (hourly) ──────────────────────────────

        now = datetime.now()
        day_of_year = now.timetuple().tm_yday
        hour = now.hour
        month = now.month
        is_daytime = 6 <= hour < 20

        eto = self.fao.calculate_hourly_eto(
            temp=temp,
            humidity=humidity,
            wind_speed=wind_speed,
            solar_radiation_hourly=solar_rad_hourly,
            atmospheric_pressure=atm_pressure,
            day_of_year=day_of_year,
            hour=hour,
            is_daytime=is_daytime,
            latitude=latitude,
            altitude=altitude,
        )

        # Kc climatic adjustment (FAO-56 Eq. 62) for mid/end stages
        kc_adj = self.fao.adjust_kc_for_climate(
            kc_table=kc,
            wind_speed_2m=wind_speed,
            rh_min=humidity,
            crop_height=crop_height,
            growth_stage=growth_stage,
        )

        etc = eto * kc_adj

        # ── 3. Multi-layer water balance ──────────────────

        effective_rain = compute_effective_rain(rain_sensor, effective_rain_input)
        use_snapshot = request.water_balance is not None
        if use_snapshot:
            wb_state = _state_from_snapshot(request.water_balance)
        else:
            wb_state = self.wb.get_state(request.device_id)

        (shallow_taw, deep_taw,
         shallow_raw, deep_raw,
         total_taw, total_raw) = self.fao.calculate_multi_layer(
            fc, wp, root_depth, depletion_frac,
        )

        etc_shallow = etc * SHALLOW_LAYER_RATIO
        etc_deep = etc * DEEP_LAYER_RATIO

        rain_shallow = effective_rain * inf_shallow
        rain_deep = effective_rain * inf_deep

        irr = wb_state.last_irrigation
        irr_shallow = irr * inf_shallow
        irr_deep = irr * inf_deep

        new_shallow_depl = self.fao.calculate_layer_depletion(
            prev_depletion=wb_state.shallow.depletion,
            etc=etc_shallow,
            effective_rain=rain_shallow,
            irrigation=irr_shallow,
            soil_moisture_pct=soil_shallow,
            field_capacity=fc,
            layer_taw=shallow_taw,
        )
        new_deep_depl = self.fao.calculate_layer_depletion(
            prev_depletion=wb_state.deep.depletion,
            etc=etc_deep,
            effective_rain=rain_deep,
            irrigation=irr_deep,
            soil_moisture_pct=soil_deep,
            field_capacity=fc,
            layer_taw=deep_taw,
        )

        weighted_depletion = 0.6 * new_deep_depl + 0.4 * new_shallow_depl

        # Update state chỉ khi dùng store (legacy). Stateless: backend persist từ response.
        if not use_snapshot:
            self.wb.update_state(
                device_id=request.device_id,
                shallow_depletion=new_shallow_depl,
                deep_depletion=new_deep_depl,
                shallow_taw=shallow_taw,
                deep_taw=deep_taw,
                shallow_raw=shallow_raw,
                deep_raw=deep_raw,
                soil_moist_avg=soil_avg,
                rain=effective_rain,
                etc=etc,
            )

        # Soil moisture trend (~1h) và lag features (6h/12h/24h)
        if use_snapshot:
            soil_trend = _soil_trend_from_snapshot(request.water_balance)
            depletion_trend_6h = request.water_balance.depletion_trend_6h or 0.0
            rain_last_6h = request.water_balance.rain_last_6h or 0.0
            etc_rolling_6h = request.water_balance.etc_rolling_6h or 0.0
            depletion_trend_12h = request.water_balance.depletion_trend_12h or 0.0
            rain_last_12h = request.water_balance.rain_last_12h or 0.0
            etc_rolling_12h = request.water_balance.etc_rolling_12h or 0.0
            depletion_trend_24h = request.water_balance.depletion_trend_24h or 0.0
            rain_last_24h = request.water_balance.rain_last_24h or 0.0
        else:
            soil_trend = self.wb.get_soil_moist_trend(request.device_id)
            depletion_trend_6h = self.wb.get_depletion_trend_6h(request.device_id)
            rain_last_6h = self.wb.get_rain_last_6h(request.device_id)
            etc_rolling_6h = self.wb.get_etc_rolling_6h(request.device_id)
            depletion_trend_12h = self.wb.get_depletion_trend_12h(request.device_id)
            rain_last_12h = self.wb.get_rain_last_12h(request.device_id)
            etc_rolling_12h = self.wb.get_etc_rolling_12h(request.device_id)
            depletion_trend_24h = self.wb.get_depletion_trend_24h(request.device_id)
            rain_last_24h = self.wb.get_rain_last_24h(request.device_id)

        # ── 4. Forward FAO-56 simulation (24h) ────────────

        cloud_cover = 0.5
        if w and w.daily_forecasts and len(w.daily_forecasts) > 0:
            cc = w.daily_forecasts[0].avg_clouds
            if cc is not None:
                cloud_cover = min(1.0, cc / 100.0) if cc > 1 else cc

        sunrise, sunset = _compute_sunrise_sunset(latitude, day_of_year)
        temp_amplitude = _estimate_diurnal_amplitude(latitude, month)

        base_temp = temp - temp_amplitude * math.cos(2 * math.pi * (hour - 14) / 24)
        base_rh = humidity - 12 * math.cos(2 * math.pi * (hour - 4) / 24)
        base_rh = max(30.0, min(100.0, base_rh))

        fao_pred_24h, etc_cumulative_24h = self._forward_simulate_24h(
            current_hour=hour,
            day_of_year=day_of_year,
            temp=base_temp,
            humidity=base_rh,
            wind_speed=wind_speed,
            kc=kc,
            shallow_depl=new_shallow_depl,
            deep_depl=new_deep_depl,
            shallow_taw=shallow_taw,
            deep_taw=deep_taw,
            total_taw=total_taw,
            total_raw=total_raw,
            forecast_rain_d0=forecast_rain_d0,
            forecast_rain_d1=forecast_rain_d1,
            inf_shallow=inf_shallow,
            cloud_cover=cloud_cover,
            latitude=latitude,
            altitude=altitude,
            temp_amplitude=temp_amplitude,
            sunrise=sunrise,
            sunset=sunset,
        )

        expected_rain_24h = (forecast_rain_d0 * 0.5 + forecast_rain_d1 * 0.5) * 0.85
        net_water_loss_24h = etc_cumulative_24h - expected_rain_24h
        stress_ratio = weighted_depletion / max(total_raw, 1e-6)

        # ── 5. Derived features ───────────────────────────

        depletion_ratio = weighted_depletion / total_taw if total_taw > 0 else 0.0
        soil_moist_deficit = fc - soil_avg

        temp_x_humidity = temp * humidity
        solar_x_temp = (solar_rad_hourly if solar_rad_hourly else 0) * temp

        # Cyclic time features
        hour_sin = math.sin(2 * math.pi * hour / 24)
        hour_cos = math.cos(2 * math.pi * hour / 24)
        month_sin = math.sin(2 * math.pi * month / 12)

        # ── 6. Build DataFrame ────────────────────────────

        row = {
            # Atmospheric
            "temp": temp,
            "humidity": humidity,
            "light": light,
            "wind_speed": wind_speed,
            "forecast_rain_d0": forecast_rain_d0,
            "forecast_rain_d1": forecast_rain_d1,
            "forecast_rain_d2": forecast_rain_d2,
            # Soil sensors
            "soil_moist_shallow": soil_shallow,
            "soil_moist_deep": soil_deep,
            "soil_moist_trend_1h": soil_trend,
            # Agro-physics
            "etc": etc,
            "kc": kc,
            # Water balance
            "raw": total_raw,
            "soil_moist_deficit": soil_moist_deficit,
            # Forward-looking features (hybrid FAO-56 + ML)
            "etc_cumulative_24h": etc_cumulative_24h,
            "net_water_loss_24h": net_water_loss_24h,
            "stress_ratio": stress_ratio,
            # FAO-56 baseline (not an ML feature, used by prediction_service for hybrid)
            "fao_pred_24h": fao_pred_24h,
            # Interactions
            "temp_x_humidity": temp_x_humidity,
            "solar_x_temp": solar_x_temp,
            # Seasonal interactions
            "season_x_stress": month_sin * stress_ratio,
            "season_x_rain": month_sin * net_water_loss_24h,
            "season_x_etc": math.cos(2 * math.pi * month / 12) * etc_cumulative_24h,
            # Cyclic time
            "hour_sin": hour_sin,
            "hour_cos": hour_cos,
            "month_sin": month_sin,
            # Lag features (6h / 12h / 24h)
            "depletion_trend_6h": depletion_trend_6h,
            "rain_last_6h": rain_last_6h,
            "etc_rolling_6h": etc_rolling_6h,
            "depletion_trend_12h": depletion_trend_12h,
            "rain_last_12h": rain_last_12h,
            "etc_rolling_12h": etc_rolling_12h,
            "depletion_trend_24h": depletion_trend_24h,
            "rain_last_24h": rain_last_24h,
            "light_rolling_24h": light_rolling_24h,
            "wind_rolling_24h": wind_rolling_24h,
            "hours_since_last_rain": min(hours_since_last_rain, 168),
            # Categorical
            "growth_stage": growth_stage,
        }

        df = pd.DataFrame([row])

        logger.info(
            "Preprocessed device=%s: eto=%.3f mm/h etc=%.3f kc=%.2f(adj=%.2f) "
            "depl=%.2f(sh=%.2f dp=%.2f)/taw=%.2f inf_sh=%.2f "
            "rain_d0/d1/d2=%.1f/%.1f/%.1f "
            "sm_sh=%.1f sm_dp=%.1f avg=%.1f diff=%.1f trend=%.2f hour=%d "
            "lag6: dt=%.2f r=%.2f e=%.3f lag12: dt=%.2f r=%.2f lag24: dt=%.2f r=%.2f",
            request.device_id, eto, etc, kc, kc_adj,
            weighted_depletion, new_shallow_depl, new_deep_depl, total_taw,
            inf_shallow,
            forecast_rain_d0, forecast_rain_d1, forecast_rain_d2,
            soil_shallow, soil_deep, soil_avg, soil_diff, soil_trend, hour,
            depletion_trend_6h, rain_last_6h, etc_rolling_6h,
            depletion_trend_12h, rain_last_12h,
            depletion_trend_24h, rain_last_24h,
        )

        return df

    # ── Forward simulation ─────────────────────────────────────────────

    def _forward_simulate_24h(
        self,
        current_hour: int,
        day_of_year: int,
        temp: float,
        humidity: float,
        wind_speed: float,
        kc: float,
        shallow_depl: float,
        deep_depl: float,
        shallow_taw: float,
        deep_taw: float,
        total_taw: float,
        total_raw: float,
        forecast_rain_d0: float,
        forecast_rain_d1: float,
        inf_shallow: float,
        cloud_cover: float = 0.5,
        latitude: float = DEFAULT_LATITUDE,
        altitude: float = DEFAULT_ALTITUDE,
        temp_amplitude: float = 5.5,
        sunrise: float = 5.5,
        sunset: float = 18.0,
    ) -> tuple:
        """
        Deterministic 24h forward simulation using FAO-56 physics.

        Uses noiseless diurnal weather patterns and expected rain from
        forecasts. Mirrors the simulation in generate_dataset.py so the
        residual (actual - fao_pred) is consistent between train and inference.

        Improvements:
          - Variable cloud_cover by hour (morning clearer, afternoon cloudier)
          - Ks stress factor when depletion > RAW (reduces ETc under stress)

        Returns:
            (fao_pred_24h, etc_cumulative_24h)
        """
        det_shallow = shallow_depl
        det_deep = deep_depl
        etc_cumulative = 0.0
        inf_deep = 1.0 - inf_shallow

        for fh in range(24):
            fh_hour = (current_hour + fh + 1) % 24
            fh_doy = day_of_year + (current_hour + fh + 1) // 24

            # Noiseless diurnal weather patterns (location-aware)
            fh_temp = temp + temp_amplitude * math.cos(2 * math.pi * (fh_hour - 14) / 24)
            fh_rh = max(30.0, min(100.0,
                humidity + 12 * math.cos(2 * math.pi * (fh_hour - 4) / 24)))

            # Variable cloud_cover by hour (tropical diurnal pattern)
            fh_cc = _hourly_cloud_cover(cloud_cover, fh_hour)

            # Solar radiation: parabolic curve using location sunrise/sunset
            if sunrise <= fh_hour < sunset:
                midday = (sunrise + sunset) / 2.0
                half_day = (sunset - sunrise) / 2.0
                x = (fh_hour - midday) / half_day
                fh_solar = max(0.0, 3.0 * (1 - x ** 2) * (1.0 - 0.7 * fh_cc))
            else:
                fh_solar = 0.0

            fh_eto = self.fao.calculate_hourly_eto(
                temp=fh_temp,
                humidity=fh_rh,
                wind_speed=wind_speed,
                solar_radiation_hourly=fh_solar,
                day_of_year=fh_doy,
                hour=fh_hour,
                latitude=latitude,
                altitude=altitude,
            )

            # Ks stress factor (FAO-56 Eq. 84)
            det_weighted = 0.6 * det_deep + 0.4 * det_shallow
            det_ks = _compute_ks(det_weighted, total_taw, total_raw)
            fh_etc = fh_eto * kc * det_ks
            etc_cumulative += fh_etc

            if fh < 12:
                expected_hourly_rain = (forecast_rain_d0 / 24.0) * 0.85
            else:
                expected_hourly_rain = (forecast_rain_d1 / 24.0) * 0.85

            det_shallow = max(0, min(shallow_taw,
                det_shallow + fh_etc * 0.4 - expected_hourly_rain * inf_shallow))
            det_deep = max(0, min(deep_taw,
                det_deep + fh_etc * 0.6 - expected_hourly_rain * inf_deep))

        fao_pred_24h = 0.6 * det_deep + 0.4 * det_shallow

        logger.debug(
            "Forward sim 24h: fao_pred=%.2f etc_cum=%.3f sh=%.2f dp=%.2f",
            fao_pred_24h, etc_cumulative, det_shallow, det_deep,
        )
        return fao_pred_24h, etc_cumulative

    # ── Helpers ───────────────────────────────────────────────────────

    def _get_solar_radiation(self, w, light: float) -> Optional[float]:
        """
        Get solar radiation in MJ/m²/day (kept for daily ETo compatibility).
        Priority: openweather.solar_radiation > convert from lux.
        """
        if w and w.solar_radiation is not None:
            return w.solar_radiation
        if light > 0:
            return self.fao.lux_to_solar_radiation(light)
        return None

    def _get_solar_radiation_hourly(self, w, light: float) -> Optional[float]:
        """
        Get solar radiation in MJ/m²/hour for hourly ETo.
        Priority: openweather.solar_radiation (converted /24) > lux conversion.
        """
        if w and w.solar_radiation is not None:
            return w.solar_radiation / 24.0
        if light > 0:
            return self.fao.lux_to_solar_radiation_hourly(light)
        return None
