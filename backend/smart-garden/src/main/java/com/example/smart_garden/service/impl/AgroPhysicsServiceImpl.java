package com.example.smart_garden.service.impl;

import com.example.smart_garden.entity.CropLibrary;
import com.example.smart_garden.entity.WeatherData;
import com.example.smart_garden.service.AgroPhysicsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Implementation of AgroPhysicsService.
 *
 * Pure calculation engine — no database access, only agro-physics math.
 * All equations follow the FAO Irrigation and Drainage Paper No. 56.
 *
 * @see <a href="https://www.fao.org/3/x0490e/x0490e06.htm">FAO-56
 *      Penman-Monteith</a>
 */
@Slf4j
@Service
public class AgroPhysicsServiceImpl implements AgroPhysicsService {

    // ==========================================
    // ET₀ — FAO-56 Penman-Monteith
    // ==========================================

    @Override
    public double calculateET0(WeatherData weather, double latitude, double altitude) {
        // Extract weather parameters
        double tMean = weather.getTemperature() != null ? weather.getTemperature() : 25.0;
        double humidity = weather.getHumidity() != null ? weather.getHumidity() : 60.0;
        double windSpeed = weather.getWindSpeed2m() != null ? weather.getWindSpeed2m()
                : (weather.getWindSpeed() != null ? weather.getWindSpeed() : 2.0);

        // Atmospheric pressure (kPa) — use measured or estimate from altitude
        double P = weather.getAtmosphericPressure() != null ? weather.getAtmosphericPressure()
                : 101.3 * Math.pow((293.0 - 0.0065 * altitude) / 293.0, 5.26);

        // Psychrometric constant: γ = 0.665 × 10⁻³ × P
        double gamma = 0.000665 * P;

        // Saturation vapour pressure: es = 0.6108 × exp(17.27T / (T + 237.3))
        double es = 0.6108 * Math.exp(17.27 * tMean / (tMean + 237.3));

        // Actual vapour pressure: ea = es × RH / 100
        double ea = es * humidity / 100.0;

        // Slope of saturation vapour pressure curve: Δ = 4098 × es / (T + 237.3)²
        double delta = 4098.0 * es / Math.pow(tMean + 237.3, 2);

        // ===== Radiation calculations =====
        double Rn = calculateNetRadiation(weather, latitude, tMean, ea);

        // Soil heat flux G ≈ 0 for daily calculations
        double G = 0.0;

        // ===== FAO-56 Penman-Monteith Equation =====
        // ET₀ = [0.408Δ(Rn-G) + γ(900/(T+273))u₂(es-ea)] / [Δ + γ(1+0.34u₂)]

        double numerator = 0.408 * delta * (Rn - G)
                + gamma * (900.0 / (tMean + 273.0)) * windSpeed * (es - ea);
        double denominator = delta + gamma * (1.0 + 0.34 * windSpeed);

        double et0 = numerator / denominator;

        // ET₀ should never be negative
        et0 = Math.max(0.0, et0);

        log.debug("ET₀ calculated: {:.2f} mm/day (T={}, RH={}, u2={}, Rn={:.2f})",
                et0, tMean, humidity, windSpeed, Rn);

        return et0;
    }

    /**
     * Calculate net radiation (Rn) at the crop surface.
     * If solar radiation is provided directly, use it. Otherwise estimate from
     * sunshine hours.
     */
    private double calculateNetRadiation(WeatherData weather, double latitude,
            double tMean, double ea) {
        LocalDateTime forecastTime = weather.getForecastTime();
        int dayOfYear = forecastTime != null ? forecastTime.getDayOfYear() : 180;

        // Solar declination
        double dr = 1.0 + 0.033 * Math.cos(2.0 * Math.PI / 365.0 * dayOfYear);
        double solarDeclination = 0.409 * Math.sin(2.0 * Math.PI / 365.0 * dayOfYear - 1.39);

        // Sunset hour angle
        double latRad = Math.toRadians(latitude);
        double ws = Math.acos(-Math.tan(latRad) * Math.tan(solarDeclination));

        // Extraterrestrial radiation Ra (MJ/m²/day)
        double Gsc = 0.0820; // solar constant
        double Ra = (24.0 * 60.0 / Math.PI) * Gsc * dr *
                (ws * Math.sin(latRad) * Math.sin(solarDeclination)
                        + Math.cos(latRad) * Math.cos(solarDeclination) * Math.sin(ws));

        // Solar radiation Rs
        double Rs;
        if (weather.getSolarRadiation() != null) {
            Rs = weather.getSolarRadiation();
        } else if (weather.getSunshineHours() != null) {
            // Ångström equation: Rs = (as + bs × n/N) × Ra
            double N = 24.0 / Math.PI * ws; // daylight hours
            double n = weather.getSunshineHours();
            Rs = (0.25 + 0.50 * n / N) * Ra;
        } else {
            // Rough estimate from temperature range (Hargreaves)
            Rs = 0.16 * Math.sqrt(15.0) * Ra; // assume 15°C range
        }

        // Clear-sky solar radiation
        double Rso = (0.75 + 2.0E-5 * 0) * Ra; // altitude=0 simplification

        // Net shortwave radiation
        double Rns = (1.0 - 0.23) * Rs; // albedo = 0.23

        // Net longwave radiation
        double sigma = 4.903E-9; // Stefan-Boltzmann constant (MJ/m²/day/K⁴)
        double TmeanK = tMean + 273.16;
        double RsRso = Rs / Math.max(Rso, 0.01);
        RsRso = Math.min(RsRso, 1.0);
        double Rnl = sigma * Math.pow(TmeanK, 4)
                * (0.34 - 0.14 * Math.sqrt(ea))
                * (1.35 * RsRso - 0.35);

        return Rns - Rnl;
    }

    // ==========================================
    // Kc — Crop Coefficient Interpolation
    // ==========================================

    @Override
    public double calculateKc(CropLibrary crop, int plantAgeDays) {
        int iniEnd = crop.getStageIniDays();
        int devEnd = iniEnd + crop.getStageDevDays();
        int midEnd = devEnd + crop.getStageMidDays();
        int lateEnd = midEnd + crop.getStageEndDays();

        double kc;

        if (plantAgeDays <= iniEnd) {
            // Initial stage — constant Kc_ini
            kc = crop.getKcIni();
        } else if (plantAgeDays <= devEnd) {
            // Development stage — linear interpolation from Kc_ini to Kc_mid
            double progress = (double) (plantAgeDays - iniEnd) / crop.getStageDevDays();
            kc = crop.getKcIni() + progress * (crop.getKcMid() - crop.getKcIni());
        } else if (plantAgeDays <= midEnd) {
            // Mid-season — constant Kc_mid
            kc = crop.getKcMid();
        } else if (plantAgeDays <= lateEnd) {
            // Late season — linear interpolation from Kc_mid to Kc_end
            double progress = (double) (plantAgeDays - midEnd) / crop.getStageEndDays();
            kc = crop.getKcMid() + progress * (crop.getKcEnd() - crop.getKcMid());
        } else {
            // Beyond total season length — use Kc_end
            kc = crop.getKcEnd();
        }

        log.debug("Kc calculated: {:.3f} for plantAge={} days (ini={}, dev={}, mid={}, late={})",
                kc, plantAgeDays, iniEnd, devEnd, midEnd, lateEnd);

        return kc;
    }

    // ==========================================
    // TAW — Total Available Water
    // ==========================================

    @Override
    public double calculateTAW(double fieldCapacity, double wiltingPoint, double rootDepth) {
        // TAW = (FC - PWP) / 100 × rootDepth
        // FC and PWP are in %, rootDepth is in mm
        double taw = (fieldCapacity - wiltingPoint) / 100.0 * rootDepth;
        log.debug("TAW calculated: {:.2f} mm (FC={}, PWP={}, rootDepth={})",
                taw, fieldCapacity, wiltingPoint, rootDepth);
        return Math.max(0.0, taw);
    }

    // ==========================================
    // Daily Depletion — Water Balance
    // ==========================================

    @Override
    public double calculateDailyDepletion(double prevDC, double etc, double effectiveRain, double irrigation) {
        // DC(i) = DC(i-1) + ETc - Rain_eff - Irrigation
        // Depletion increases with ETc, decreases with Rain and Irrigation
        double dc = prevDC + etc - effectiveRain - irrigation;

        // DC cannot be negative (soil can't be wetter than field capacity)
        dc = Math.max(0.0, dc);

        log.debug("DC calculated: {:.2f} mm (prevDC={}, ETc={}, rain={}, irr={})",
                dc, prevDC, etc, effectiveRain, irrigation);

        return dc;
    }

    @Override
    public double estimateSolarRadiation(double tMax, double tMin, double latitude, int dayOfYear) {
        // Calculate Extraterrestrial Radiation (Ra)
        double ra = calculateRa(latitude, dayOfYear);

        // Hargreaves adjustment coefficient (0.16 - 0.19)
        // Using 0.17 average
        double kRs = 0.17;

        double tDiff = Math.max(0, tMax - tMin);
        return kRs * Math.sqrt(tDiff) * ra;
    }

    /**
     * Helper: Calculate Extraterrestrial Radiation (Ra)
     * 
     * @param latitude  decimal degrees
     * @param dayOfYear 1-366
     * @return Ra in MJ/m²/day
     */
    private double calculateRa(double latitude, int dayOfYear) {
        // Convert latitude to radians
        double phi = Math.toRadians(latitude);

        // Inverse relative distance Earth-Sun
        double dr = 1 + 0.033 * Math.cos(2 * Math.PI / 365 * dayOfYear);

        // Solar decination
        double delta = 0.409 * Math.sin(2 * Math.PI / 365 * dayOfYear - 1.39);

        // Sunset hour angle (clamp acos input to -1..1 just in case)
        double tanPhiTanDelta = -Math.tan(phi) * Math.tan(delta);
        tanPhiTanDelta = Math.max(-1.0, Math.min(1.0, tanPhiTanDelta));
        double omegaS = Math.acos(tanPhiTanDelta);

        double Gsc = 0.0820; // Solar constant MJ/m2/min

        return (24 * 60 / Math.PI) * Gsc * dr
                * (omegaS * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(omegaS));
    }
}
