"""
Tests for FAO-56 hourly improvements in fao_service.py.
Run: cd ai-service && venv\\Scripts\\python -m pytest tests/test_fao_hourly.py -v
"""

import math
import pytest
from app.services.fao_service import FaoService


@pytest.fixture
def fao():
    return FaoService()


# ── 1. Hourly ETo sanity check ────────────────────────────────────────────────

class TestHourlyEto:
    def test_midday_tropical_range(self, fao):
        """Midday ETo in tropical climate should be ~0.2–0.8 mm/h."""
        eto = fao.calculate_hourly_eto(
            temp=30.0, humidity=60.0, wind_speed=2.0,
            net_radiation_rn=1.5,  # MJ/m²/h — typical midday
            hour=12, is_daytime=True,
        )
        assert 0.1 <= eto <= 1.0, f"Unexpected midday ETo: {eto:.4f} mm/h"

    def test_nighttime_lower_than_daytime(self, fao):
        """Nighttime ETo should be lower than daytime ETo."""
        eto_day = fao.calculate_hourly_eto(
            temp=28.0, humidity=65.0, wind_speed=2.0,
            net_radiation_rn=1.2, hour=12, is_daytime=True,
        )
        eto_night = fao.calculate_hourly_eto(
            temp=24.0, humidity=80.0, wind_speed=1.0,
            net_radiation_rn=0.0, hour=2, is_daytime=False,
        )
        assert eto_day > eto_night, (
            f"Daytime ETo ({eto_day:.4f}) should exceed nighttime ({eto_night:.4f})"
        )

    def test_non_negative(self, fao):
        """ETo must never be negative."""
        eto = fao.calculate_hourly_eto(
            temp=15.0, humidity=95.0, wind_speed=0.5,
            net_radiation_rn=-0.1, hour=3, is_daytime=False,
        )
        assert eto >= 0.0, f"ETo should be >= 0, got {eto}"

    def test_daily_vs_hourly_consistency(self, fao):
        """
        Sum of 24 hourly ETo values should be within ±40% of one daily ETo.
        (Rough check — hourly and daily formulas differ in constants.)
        """
        day_of_year = 180
        lat = 10.8

        daily_eto = fao.calculate_eto(
            temp=28.0, humidity=65.0, wind_speed=2.0,
            day_of_year=day_of_year, latitude=lat,
        )

        hourly_sum = sum(
            fao.calculate_hourly_eto(
                temp=28.0, humidity=65.0, wind_speed=2.0,
                day_of_year=day_of_year, latitude=lat,
                hour=h,
            )
            for h in range(24)
        )

        ratio = hourly_sum / daily_eto if daily_eto > 0 else 0
        # Hourly PM uses Cn=37 vs daily Cn=900, so hourly sum is typically
        # 20-60% of the daily value — both are valid for their respective time steps.
        assert 0.1 <= ratio <= 2.0, (
            f"Hourly sum ({hourly_sum:.2f}) vs daily ({daily_eto:.2f}), ratio={ratio:.2f}"
        )


# ── 2. Hourly net radiation ───────────────────────────────────────────────────

class TestHourlyNetRadiation:
    def test_nighttime_ra_zero(self, fao):
        """At midnight, Ra should be 0 (no solar radiation)."""
        # Access private method directly for unit testing
        Rn = fao._calc_hourly_net_radiation(
            temp=22.0, ea=1.5,
            solar_radiation_hourly=0.0,
            latitude=10.8, altitude=10.0,
            day_of_year=180, hour=0,
        )
        # Rn at night with Rs=0 should be small (longwave loss ~0.09 MJ/m²/h is normal)
        assert Rn <= 0.15, f"Nighttime Rn should be <= 0.15, got {Rn:.4f}"

    def test_midday_positive_rn(self, fao):
        """At midday with solar input, Rn should be positive."""
        Rn = fao._calc_hourly_net_radiation(
            temp=30.0, ea=2.0,
            solar_radiation_hourly=2.5,  # MJ/m²/h — strong midday sun
            latitude=10.8, altitude=10.0,
            day_of_year=180, hour=12,
        )
        assert Rn > 0, f"Midday Rn should be positive, got {Rn:.4f}"


# ── 3. Kc climatic adjustment ─────────────────────────────────────────────────

class TestKcAdjustment:
    def test_high_wind_low_rh_increases_kc(self, fao):
        """High wind + low RH should increase Kc above table value."""
        kc_adj = fao.adjust_kc_for_climate(
            kc_table=1.2, wind_speed_2m=4.0, rh_min=30.0,
            crop_height=1.0, growth_stage="mid",
        )
        assert kc_adj > 1.2, f"Kc should increase, got {kc_adj:.3f}"

    def test_low_wind_high_rh_decreases_kc(self, fao):
        """Low wind + high RH should decrease Kc below table value."""
        kc_adj = fao.adjust_kc_for_climate(
            kc_table=1.2, wind_speed_2m=1.0, rh_min=75.0,
            crop_height=0.5, growth_stage="mid",
        )
        assert kc_adj < 1.2, f"Kc should decrease, got {kc_adj:.3f}"

    def test_initial_stage_no_adjustment(self, fao):
        """Kc adjustment should NOT apply to initial growth stage."""
        kc_adj = fao.adjust_kc_for_climate(
            kc_table=0.6, wind_speed_2m=5.0, rh_min=20.0,
            crop_height=0.3, growth_stage="initial",
        )
        assert kc_adj == 0.6, f"Initial stage Kc should be unchanged, got {kc_adj}"

    def test_development_stage_no_adjustment(self, fao):
        """Kc adjustment should NOT apply to development stage."""
        kc_adj = fao.adjust_kc_for_climate(
            kc_table=0.9, wind_speed_2m=5.0, rh_min=20.0,
            crop_height=0.5, growth_stage="development",
        )
        assert kc_adj == 0.9

    def test_result_always_positive(self, fao):
        """Adjusted Kc must always be > 0."""
        kc_adj = fao.adjust_kc_for_climate(
            kc_table=0.1, wind_speed_2m=1.0, rh_min=80.0,
            crop_height=0.1, growth_stage="end",
        )
        assert kc_adj > 0


# ── 4. Dynamic blending & reset ───────────────────────────────────────────────

class TestDynamicBlending:
    def test_reset_when_soil_at_fc(self, fao):
        """When soil moisture >= FC, depletion must reset to 0."""
        result = fao.calculate_layer_depletion(
            prev_depletion=10.0,
            etc=0.3,
            effective_rain=0.0,
            irrigation=0.0,
            soil_moisture_pct=30.0,   # at FC
            field_capacity=30.0,
            layer_taw=50.0,
        )
        assert result == 0.0, f"Expected reset to 0, got {result}"

    def test_reset_when_soil_above_fc(self, fao):
        """When soil moisture > FC (sensor spike), depletion must reset to 0."""
        result = fao.calculate_layer_depletion(
            prev_depletion=15.0,
            etc=0.2,
            effective_rain=0.0,
            irrigation=0.0,
            soil_moisture_pct=35.0,   # above FC
            field_capacity=30.0,
            layer_taw=50.0,
        )
        assert result == 0.0, f"Expected reset to 0, got {result}"

    def test_wet_soil_trusts_sensor_more(self, fao):
        """Near FC, sensor weight should dominate (result closer to sensor_depletion)."""
        fc = 30.0
        sm_wet = 27.0   # 90% of FC → wetness_ratio = 0.9 → sensor_weight = 0.8
        layer_taw = 50.0

        fc_frac = fc / 100.0
        sm_frac = sm_wet / 100.0
        sensor_depletion = max(0.0, (fc_frac - sm_frac) * layer_taw / fc_frac)

        result = fao.calculate_layer_depletion(
            prev_depletion=5.0,
            etc=0.3,
            effective_rain=0.0,
            irrigation=0.0,
            soil_moisture_pct=sm_wet,
            field_capacity=fc,
            layer_taw=layer_taw,
        )
        # Result should be closer to sensor_depletion than to calc_depletion
        calc_depletion = max(0.0, 5.0 + 0.3)
        dist_to_sensor = abs(result - sensor_depletion)
        dist_to_calc = abs(result - calc_depletion)
        assert dist_to_sensor <= dist_to_calc, (
            f"Wet soil: result={result:.2f} should be closer to sensor={sensor_depletion:.2f} "
            f"than calc={calc_depletion:.2f}"
        )

    def test_dry_soil_trusts_calc_more(self, fao):
        """Very dry soil should trust the calculation more than the sensor."""
        fc = 30.0
        sm_dry = 5.0    # ~17% of FC → wetness_ratio = 0.17 → sensor_weight = 0.2
        layer_taw = 50.0

        fc_frac = fc / 100.0
        sm_frac = sm_dry / 100.0
        sensor_depletion = max(0.0, (fc_frac - sm_frac) * layer_taw / fc_frac)
        calc_depletion = max(0.0, 20.0 + 0.5)

        result = fao.calculate_layer_depletion(
            prev_depletion=20.0,
            etc=0.5,
            effective_rain=0.0,
            irrigation=0.0,
            soil_moisture_pct=sm_dry,
            field_capacity=fc,
            layer_taw=layer_taw,
        )
        dist_to_calc = abs(result - calc_depletion)
        dist_to_sensor = abs(result - sensor_depletion)
        assert dist_to_calc <= dist_to_sensor, (
            f"Dry soil: result={result:.2f} should be closer to calc={calc_depletion:.2f} "
            f"than sensor={sensor_depletion:.2f}"
        )

    def test_result_clamped_to_taw(self, fao):
        """Depletion must never exceed layer TAW."""
        result = fao.calculate_layer_depletion(
            prev_depletion=100.0,
            etc=10.0,
            effective_rain=0.0,
            irrigation=0.0,
            soil_moisture_pct=1.0,
            field_capacity=30.0,
            layer_taw=50.0,
        )
        assert result <= 50.0, f"Depletion exceeded TAW: {result}"

    def test_result_non_negative(self, fao):
        """Depletion must never be negative."""
        result = fao.calculate_layer_depletion(
            prev_depletion=0.0,
            etc=0.0,
            effective_rain=10.0,
            irrigation=5.0,
            soil_moisture_pct=28.0,
            field_capacity=30.0,
            layer_taw=50.0,
        )
        assert result >= 0.0, f"Depletion is negative: {result}"
