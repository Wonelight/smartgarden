"""
FAO-56 Penman-Monteith ETo service — pure math, no external dependencies.
Mirrors the Java AgroPhysicsServiceImpl calculations exactly.
Supports multi-layer (shallow + deep) root zone calculations.

Reference: FAO Irrigation and Drainage Paper No. 56
https://www.fao.org/3/x0490e/x0490e06.htm

Hourly step support added per FAO-56 Chapter 3 (Eq. 48–53).
"""

import logging
import math
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Constants
SOLAR_CONSTANT = 0.0820        # MJ/m²/min
STEFAN_BOLTZMANN = 4.903e-9    # MJ/m²/day/K⁴  (daily)
STEFAN_BOLTZMANN_H = 2.042e-10 # MJ/m²/hour/K⁴ (hourly = daily / 24)
ALBEDO = 0.23
KELVIN_OFFSET = 273.16

# Default layer split ratios (geometry: share of root zone depth)
SHALLOW_LAYER_RATIO = 0.4  # Top 40% of root zone → 40% of TAW
DEEP_LAYER_RATIO = 0.6     # Bottom 60% of root zone → 60% of TAW

# Infiltration split for water from above (rain & irrigation)
# Same physics: surface wets first, less percolates to depth in one event.
INFILTRATION_SHALLOW_RATIO = 0.70  # 70% of rain/irrigation stays in shallow
INFILTRATION_DEEP_RATIO = 0.30     # 30% reaches deep layer


class FaoService:
    """FAO-56 ET₀ & multi-layer water balance calculations."""

    def calculate_eto(
        self,
        temp: float,
        humidity: float,
        wind_speed: Optional[float] = None,
        solar_radiation: Optional[float] = None,
        sunshine_hours: Optional[float] = None,
        atmospheric_pressure: Optional[float] = None,
        latitude: float = 10.8,       # Default: Hồ Chí Minh
        altitude: float = 10.0,       # Default: gần mực nước biển
        day_of_year: int = 180,
    ) -> float:
        """
        Calculate Reference Evapotranspiration (ET₀) using FAO-56 Penman-Monteith.

        ET₀ = [0.408Δ(Rn-G) + γ(900/(T+273))u₂(es-ea)] / [Δ + γ(1+0.34u₂)]

        Returns: ET₀ in mm/day
        """
        ws = wind_speed if wind_speed is not None else 2.0

        # Atmospheric pressure (kPa)
        if atmospheric_pressure is not None:
            P = atmospheric_pressure
        else:
            P = 101.3 * ((293.0 - 0.0065 * altitude) / 293.0) ** 5.26

        # Psychrometric constant: γ = 0.665 × 10⁻³ × P
        gamma = 0.000665 * P

        # Saturation vapour pressure: es = 0.6108 × exp(17.27T / (T + 237.3))
        es = 0.6108 * math.exp(17.27 * temp / (temp + 237.3))

        # Actual vapour pressure: ea = es × RH / 100
        ea = es * humidity / 100.0

        # Slope of saturation vapour pressure curve
        delta = 4098.0 * es / (temp + 237.3) ** 2

        # Net radiation
        Rn = self._calc_net_radiation(
            temp, ea, solar_radiation, sunshine_hours,
            latitude, altitude, day_of_year,
        )

        # Soil heat flux G ≈ 0 for daily
        G = 0.0

        # FAO-56 Penman-Monteith
        numerator = (0.408 * delta * (Rn - G)
                     + gamma * (900.0 / (temp + 273.0)) * ws * (es - ea))
        denominator = delta + gamma * (1.0 + 0.34 * ws)

        eto = max(0.0, numerator / denominator)

        logger.debug(
            "ETo=%.2f mm/day (T=%.1f RH=%.0f ws=%.1f Rn=%.2f)",
            eto, temp, humidity, ws, Rn,
        )
        return eto

    def _calc_net_radiation(
        self,
        temp: float,
        ea: float,
        solar_radiation: Optional[float],
        sunshine_hours: Optional[float],
        latitude: float,
        altitude: float,
        day_of_year: int,
    ) -> float:
        """Calculate daily net radiation (Rn) at crop surface (MJ/m²/day)."""
        lat_rad = math.radians(latitude)

        # Inverse relative distance Earth-Sun
        dr = 1 + 0.033 * math.cos(2 * math.pi / 365 * day_of_year)

        # Solar declination
        sol_dec = 0.409 * math.sin(2 * math.pi / 365 * day_of_year - 1.39)

        # Sunset hour angle
        tan_product = -math.tan(lat_rad) * math.tan(sol_dec)
        tan_product = max(-1.0, min(1.0, tan_product))
        ws = math.acos(tan_product)

        # Extraterrestrial radiation Ra (MJ/m²/day)
        Ra = ((24 * 60 / math.pi) * SOLAR_CONSTANT * dr
              * (ws * math.sin(lat_rad) * math.sin(sol_dec)
                 + math.cos(lat_rad) * math.cos(sol_dec) * math.sin(ws)))

        # Solar radiation Rs
        if solar_radiation is not None:
            Rs = solar_radiation
        elif sunshine_hours is not None:
            N = 24.0 / math.pi * ws  # daylight hours
            Rs = (0.25 + 0.50 * sunshine_hours / max(N, 0.1)) * Ra
        else:
            # Hargreaves estimate
            Rs = 0.16 * math.sqrt(15.0) * Ra

        # Clear-sky solar radiation
        Rso = (0.75 + 2e-5 * altitude) * Ra

        # Net shortwave
        Rns = (1 - ALBEDO) * Rs

        # Net longwave
        Tk = temp + KELVIN_OFFSET
        Rs_Rso = min(Rs / max(Rso, 0.01), 1.0)
        Rnl = (STEFAN_BOLTZMANN * Tk ** 4
               * (0.34 - 0.14 * math.sqrt(ea))
               * (1.35 * Rs_Rso - 0.35))

        return Rns - Rnl

    # ── Hourly ETo (FAO-56 Eq. 53) ────────────────────────

    def calculate_hourly_eto(
        self,
        temp: float,
        humidity: float,
        wind_speed: Optional[float] = None,
        net_radiation_rn: Optional[float] = None,
        solar_radiation_hourly: Optional[float] = None,
        atmospheric_pressure: Optional[float] = None,
        latitude: float = 10.8,
        altitude: float = 10.0,
        day_of_year: int = 180,
        hour: int = 12,
        is_daytime: Optional[bool] = None,
    ) -> float:
        """
        Calculate Reference Evapotranspiration for an hourly time step.
        Uses FAO-56 Eq. 53 with hourly constants (Cn=37, Cd=0.24/0.96).

        Returns: ETo in mm/hour
        """
        ws = wind_speed if wind_speed is not None else 2.0

        # Determine daytime from hour if not explicitly provided
        if is_daytime is None:
            is_daytime = 6 <= hour < 20

        # FAO-56 Table 1 — hourly constants
        Cn = 37.0
        Cd = 0.24 if is_daytime else 0.96

        # Atmospheric pressure (kPa)
        if atmospheric_pressure is not None:
            P = atmospheric_pressure
        else:
            P = 101.3 * ((293.0 - 0.0065 * altitude) / 293.0) ** 5.26

        # Psychrometric constant
        gamma = 0.000665 * P

        # Saturation vapour pressure
        es = 0.6108 * math.exp(17.27 * temp / (temp + 237.3))

        # Actual vapour pressure
        ea = es * humidity / 100.0

        # Slope of saturation vapour pressure curve
        delta = 4098.0 * es / (temp + 237.3) ** 2

        # Net radiation for this hour
        if net_radiation_rn is not None:
            Rn = net_radiation_rn
        else:
            Rn = self._calc_hourly_net_radiation(
                temp=temp,
                ea=ea,
                solar_radiation_hourly=solar_radiation_hourly,
                latitude=latitude,
                altitude=altitude,
                day_of_year=day_of_year,
                hour=hour,
            )

        # Soil heat flux G (FAO-56 Eq. 45–46)
        # Daytime: G = 0.1 * Rn; Nighttime: G = 0.5 * Rn
        G = 0.1 * Rn if is_daytime else 0.5 * Rn

        # FAO-56 Eq. 53 — Penman-Monteith (hourly)
        numerator = (0.408 * delta * (Rn - G)
                     + gamma * (Cn / (temp + 273.0)) * ws * (es - ea))
        denominator = delta + gamma * (1.0 + Cd * ws)

        eto_h = max(0.0, numerator / denominator)

        logger.debug(
            "ETo_hourly=%.3f mm/h (T=%.1f RH=%.0f ws=%.1f Rn=%.3f G=%.3f "
            "hour=%d daytime=%s)",
            eto_h, temp, humidity, ws, Rn, G, hour, is_daytime,
        )
        return eto_h

    def _calc_hourly_net_radiation(
        self,
        temp: float,
        ea: float,
        solar_radiation_hourly: Optional[float],
        latitude: float,
        altitude: float,
        day_of_year: int,
        hour: int,
    ) -> float:
        """
        Hourly net radiation using solar hour angle ω (FAO-56 Eq. 48–53).
        Returns Rn in MJ/m²/hour.
        """
        lat_rad = math.radians(latitude)

        # Inverse relative distance Earth-Sun (FAO-56 Eq. 23)
        dr = 1 + 0.033 * math.cos(2 * math.pi / 365 * day_of_year)

        # Solar declination δ (FAO-56 Eq. 24)
        sol_dec = 0.409 * math.sin(2 * math.pi / 365 * day_of_year - 1.39)

        # Solar hour angle ω at midpoint of the hour (FAO-56 Eq. 31)
        # ω = π/12 * (hour + 0.5 - 12)  → midpoint of the hour
        omega = (math.pi / 12.0) * (hour + 0.5 - 12.0)
        omega1 = omega - math.pi / 24.0   # start of hour
        omega2 = omega + math.pi / 24.0   # end of hour

        # Sunset hour angle ωs (FAO-56 Eq. 25)
        tan_product = -math.tan(lat_rad) * math.tan(sol_dec)
        tan_product = max(-1.0, min(1.0, tan_product))
        omega_s = math.acos(tan_product)

        # Clamp hour angles to daylight period
        omega1 = max(omega1, -omega_s)
        omega2 = min(omega2, omega_s)

        # Extraterrestrial radiation Ra for the hour (FAO-56 Eq. 50)
        if omega2 <= omega1:
            # Night-time: no solar radiation
            Ra = 0.0
        else:
            Ra = max(0.0,
                (12.0 / math.pi) * SOLAR_CONSTANT * dr
                * ((omega2 - omega1) * math.sin(lat_rad) * math.sin(sol_dec)
                   + math.cos(lat_rad) * math.cos(sol_dec)
                   * (math.sin(omega2) - math.sin(omega1)))
            )

        # Solar radiation Rs (MJ/m²/hour)
        if solar_radiation_hourly is not None:
            Rs = max(0.0, solar_radiation_hourly)
        else:
            # Fallback: assume 50% of clear-sky
            Rso_h = (0.75 + 2e-5 * altitude) * Ra
            Rs = 0.5 * Rso_h

        # Clear-sky solar radiation for the hour
        Rso = (0.75 + 2e-5 * altitude) * Ra

        # Net shortwave radiation (FAO-56 Eq. 38)
        Rns = (1 - ALBEDO) * Rs

        # Net longwave radiation (FAO-56 Eq. 39, adapted for hourly)
        Tk = temp + KELVIN_OFFSET
        Rs_Rso_ratio = min(Rs / max(Rso, 1e-6), 1.0) if Rso > 0 else 0.0
        Rnl = (STEFAN_BOLTZMANN_H * Tk ** 4
               * (0.34 - 0.14 * math.sqrt(max(ea, 0.0)))
               * (1.35 * Rs_Rso_ratio - 0.35))

        Rn = Rns - Rnl
        logger.debug(
            "Rn_hourly=%.4f MJ/m²/h (Ra=%.4f Rs=%.4f Rns=%.4f Rnl=%.4f hour=%d)",
            Rn, Ra, Rs, Rns, Rnl, hour,
        )
        return Rn

    # ── Kc Climatic Adjustment (FAO-56 Eq. 62) ────────────

    def adjust_kc_for_climate(
        self,
        kc_table: float,
        wind_speed_2m: float,
        rh_min: float,
        crop_height: float = 0.5,
        growth_stage: str = "mid",
    ) -> float:
        """
        Adjust tabular Kc for local climate conditions (FAO-56 Eq. 62).
        Only applied for mid-season and late-season growth stages.

        Kc_adj = Kc_table + [0.04(u2-2) - 0.004(RHmin-45)] * (h/3)^0.3

        Args:
            kc_table:      Tabular Kc value (FAO-56 Table 12)
            wind_speed_2m: Mean daily wind speed at 2m height (m/s)
            rh_min:        Mean daily minimum relative humidity (%)
            crop_height:   Mean crop height during the stage (m)
            growth_stage:  One of 'initial', 'development', 'mid', 'end'

        Returns:
            Adjusted Kc (float)
        """
        if growth_stage not in ("mid", "end", "late"):
            return kc_table

        # Clamp inputs to valid FAO-56 ranges
        u2 = max(1.0, min(wind_speed_2m, 6.0))
        rh_min_c = max(20.0, min(rh_min, 80.0))
        h = max(0.1, min(crop_height, 10.0))

        adjustment = (0.04 * (u2 - 2.0) - 0.004 * (rh_min_c - 45.0)) * (h / 3.0) ** 0.3
        kc_adj = kc_table + adjustment

        logger.debug(
            "Kc_adj=%.3f (kc_table=%.2f u2=%.1f RHmin=%.0f h=%.1f stage=%s adj=%.3f)",
            kc_adj, kc_table, u2, rh_min_c, h, growth_stage, adjustment,
        )
        return max(0.1, kc_adj)

    # ── Multi-layer water balance ──────────────────────────

    def calculate_layer_taw(
        self,
        field_capacity: float,
        wilting_point: float,
        root_depth: float,
        layer_ratio: float,
    ) -> float:
        """
        TAW for a single layer (mm).
        TAW_layer = 1000 × (FC - WP) × root_depth × layer_ratio
        FC, WP in %, root_depth in meters.
        """
        fc = field_capacity / 100.0 if field_capacity > 1 else field_capacity
        wp = wilting_point / 100.0 if wilting_point > 1 else wilting_point
        return max(0.0, 1000.0 * (fc - wp) * root_depth * layer_ratio)

    def calculate_multi_layer(
        self,
        field_capacity: float,
        wilting_point: float,
        root_depth: float,
        depletion_fraction: float = 0.5,
    ) -> Tuple[float, float, float, float, float, float]:
        """
        Calculate TAW and RAW for both layers.

        Returns:
            (shallow_taw, deep_taw, shallow_raw, deep_raw, total_taw, total_raw)
        """
        shallow_taw = self.calculate_layer_taw(
            field_capacity, wilting_point, root_depth, SHALLOW_LAYER_RATIO)
        deep_taw = self.calculate_layer_taw(
            field_capacity, wilting_point, root_depth, DEEP_LAYER_RATIO)

        shallow_raw = shallow_taw * depletion_fraction
        deep_raw = deep_taw * depletion_fraction

        total_taw = shallow_taw + deep_taw
        total_raw = shallow_raw + deep_raw

        return shallow_taw, deep_taw, shallow_raw, deep_raw, total_taw, total_raw

    def calculate_taw(
        self,
        field_capacity: float,
        wilting_point: float,
        root_depth: float,
    ) -> float:
        """
        Total Available Water (mm) — full root zone.
        TAW = 1000 × (FC - WP) × root_depth
        """
        fc = field_capacity / 100.0 if field_capacity > 1 else field_capacity
        wp = wilting_point / 100.0 if wilting_point > 1 else wilting_point
        return max(0.0, 1000.0 * (fc - wp) * root_depth)

    def calculate_raw(self, taw: float, depletion_fraction: float = 0.5) -> float:
        """Readily Available Water (mm) = p × TAW."""
        return taw * depletion_fraction

    def calculate_depletion(
        self,
        prev_depletion: float,
        etc: float,
        effective_rain: float,
        irrigation: float,
    ) -> float:
        """
        Daily root zone depletion: DC(i) = DC(i-1) + ETc - Rain_eff - Irrigation.
        Clamped ≥ 0.
        """
        return max(0.0, prev_depletion + etc - effective_rain - irrigation)

    def calculate_layer_depletion(
        self,
        prev_depletion: float,
        etc: float,
        effective_rain: float,
        irrigation: float,
        soil_moisture_pct: float,
        field_capacity: float,
        layer_taw: float,
    ) -> float:
        """
        Per-layer depletion update, informed by actual soil moisture sensor.

        Uses sensor reading to adjust: if measured moisture indicates
        less depletion than calculated, trust the sensor (reality check).
        """
        # Pure water-balance calculation
        calc_depletion = max(0.0, prev_depletion + etc - effective_rain - irrigation)

        # Sensor-informed depletion estimate
        fc_frac = field_capacity / 100.0 if field_capacity > 1 else field_capacity
        sm_frac = soil_moisture_pct / 100.0 if soil_moisture_pct > 1 else soil_moisture_pct
        sensor_depletion = max(0.0, (fc_frac - sm_frac) * layer_taw / fc_frac) if fc_frac > 0 else 0.0

        # ── Reset mechanism ──────────────────────────────────
        # If sensor reads at or above FC (after irrigation / heavy rain),
        # trust the sensor absolutely and reset the model to zero depletion.
        if fc_frac > 0 and sm_frac >= fc_frac:
            logger.debug(
                "Depletion reset: soil_moisture=%.1f%% >= FC=%.1f%% → depletion=0",
                soil_moisture_pct, field_capacity,
            )
            return 0.0

        # ── Dynamic trust blending ────────────────────────────
        # Sensor reliability varies with soil wetness:
        #   Wet soil (sm ≥ 0.9·FC): sensor is accurate  → weight 0.2 calc + 0.8 sensor
        #   Dry soil (sm ≤ 0.3·FC): sensor may drift    → weight 0.8 calc + 0.2 sensor
        #   Normal range: linearly interpolate between the two extremes
        if fc_frac > 0:
            wetness_ratio = sm_frac / fc_frac   # 0 (bone dry) → 1+ (at/above FC)
        else:
            wetness_ratio = 0.5

        # sensor_weight: 0.2 (dry) → 0.8 (wet), clamped to [0.2, 0.8]
        # Linearly maps wetness_ratio [0.3, 0.9] → sensor_weight [0.2, 0.8]
        sensor_weight = 0.2 + (0.6 / 0.6) * max(0.0, min(wetness_ratio - 0.3, 0.6))
        sensor_weight = max(0.2, min(0.8, sensor_weight))
        calc_weight = 1.0 - sensor_weight

        blended = calc_weight * calc_depletion + sensor_weight * sensor_depletion

        logger.debug(
            "Depletion blend: calc=%.2f sensor=%.2f w_calc=%.2f w_sensor=%.2f → %.2f",
            calc_depletion, sensor_depletion, calc_weight, sensor_weight, blended,
        )
        return max(0.0, min(blended, layer_taw))

    def lux_to_solar_radiation(self, lux: float) -> float:
        """
        Convert BH1750 lux → solar radiation (MJ/m²/day).
        1 lux ≈ 0.0079 W/m², then × 0.0864 for daily MJ.
        """
        return lux * 0.0079 * 0.0864

    def lux_to_solar_radiation_hourly(self, lux: float) -> float:
        """
        Convert BH1750 lux → solar radiation (MJ/m²/hour).
        1 lux ≈ 0.0079 W/m², then × 0.0036 for hourly MJ (= W/m² × 3600s / 1e6).
        """
        return lux * 0.0079 * 0.0036
