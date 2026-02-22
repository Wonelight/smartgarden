package com.example.smart_garden.service.impl;

import com.example.smart_garden.dto.monitoring.response.WeatherDataDetailResponse;
import com.example.smart_garden.dto.weather.OpenWeatherForecastResponse;
import com.example.smart_garden.dto.weather.OpenWeatherResponse;
import com.example.smart_garden.dto.weather.response.DailyWeatherForecastResponse;
import com.example.smart_garden.entity.DailyWeatherForecast;
import com.example.smart_garden.entity.Device;
import com.example.smart_garden.entity.WeatherData;
import com.example.smart_garden.repository.DailyWeatherForecastRepository;
import com.example.smart_garden.repository.DeviceRepository;
import com.example.smart_garden.repository.WeatherDataRepository;
import com.example.smart_garden.service.AgroPhysicsService;
import com.example.smart_garden.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherServiceImpl implements WeatherService {

    private final DeviceRepository deviceRepository;
    private final WeatherDataRepository weatherDataRepository;
    private final DailyWeatherForecastRepository dailyWeatherForecastRepository;
    private final AgroPhysicsService agroPhysicsService;

    @Value("${weather.api.url:https://api.openweathermap.org/data/2.5}")
    private String apiUrl;

    @Value("${weather.api.key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    @Override
    @Scheduled(cron = "0 0 * * * ?") // Every hour at :00
    @Transactional
    public void fetchWeatherForAllDevices() {
        log.info("Starting scheduled weather fetch job...");
        Map<String, Integer> locations = getMonitoredLocations();

        if (locations.isEmpty()) {
            log.info("No active devices with locations found. Skipping weather fetch.");
            return;
        }

        log.info("Fetching weather for {} unique locations: {}", locations.size(), locations.keySet());

        // Process distinct locations (based on key "lat,lon" or "name")
        // We iterate active devices to get real coordinates
        List<Device> devices = deviceRepository.findAll();

        // Group devices by normalized location key to minimize API calls
        Map<String, Device> uniqueLocationDevices = new HashMap<>();

        for (Device device : devices) {
            if (device.getDeletedAt() != null)
                continue;

            String key;
            if (device.getLatitude() != null && device.getLongitude() != null) {
                // Use coordinates as primary key, rounded to 4 decimals ~11m precision
                key = String.format("%.4f,%.4f", device.getLatitude(), device.getLongitude());
            } else if (device.getLocation() != null && !device.getLocation().isBlank()) {
                key = device.getLocation();
            } else {
                continue;
            }

            uniqueLocationDevices.putIfAbsent(key, device);
        }

        // Iterate unique keys and fetch
        for (Map.Entry<String, Device> entry : uniqueLocationDevices.entrySet()) {
            String locationKey = entry.getKey();
            Device representative = entry.getValue();

            try {
                // Fetch current weather
                fetchAndSave(representative);

                // Fetch 5-day forecast
                fetchForecastAndSave(representative);

                // Sleep slightly to respect rate limits if many locations
                Thread.sleep(100);
            } catch (Exception e) {
                log.error("Failed to fetch weather for location '{}': {}", locationKey, e.getMessage());
            }
        }

        log.info("Weather fetch job completed.");
    }

    @Override
    @Transactional
    public void fetchWeatherForDevice(Long deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));
        fetchAndSave(device);
        fetchForecastAndSave(device);
    }

    @Override
    public Map<String, Integer> getMonitoredLocations() {
        List<Device> devices = deviceRepository.findAll();
        Map<String, Integer> counts = new HashMap<>();
        for (Device d : devices) {
            // Check deleted
            if (d.getDeletedAt() != null)
                continue;

            String key = d.getLocation();
            if (d.getLatitude() != null && d.getLongitude() != null) {
                key = String.format("Lat:%.4f, Lon:%.4f (Loc:%s)", d.getLatitude(), d.getLongitude(), d.getLocation());
            }
            if (key != null && !key.isBlank()) {
                counts.put(key, counts.getOrDefault(key, 0) + 1);
            }
        }
        return counts;
    }

    private void fetchAndSave(Device device) {
        String url;
        // Priority: Lat/Lon >> Location Name
        // Note: I recall I added `latitude` and `altitude`. I likely missed
        // `longitude`.
        // I will check `Device` entity. If no longitude, I define behavior here:
        // If I only have lat, I can't use coordinate search. I must use q={location}.

        if (device.getLatitude() != null && device.getLongitude() != null) {
            url = String.format("%s/weather?lat=%s&lon=%s&units=metric&appid=%s",
                    apiUrl, device.getLatitude(), device.getLongitude(), apiKey);
        } else if (device.getLocation() != null && !device.getLocation().isBlank()) {
            url = String.format("%s/weather?q=%s&units=metric&appid=%s",
                    apiUrl, device.getLocation(), apiKey);
        } else {
            log.warn("Device {} has no location defined", device.getDeviceCode());
            return;
        }

        // Call API
        OpenWeatherResponse resp = restTemplate.getForObject(url, OpenWeatherResponse.class);

        if (resp != null) {
            saveWeatherData(resp, device.getLocation());
        }
    }

    private void saveWeatherData(OpenWeatherResponse resp, String locationName) {
        WeatherData wd = new WeatherData();
        wd.setLocation(locationName); // Use the device's location string so we can find it later

        wd.setTemperature((float) resp.getMain().getTemp());
        wd.setHumidity((float) resp.getMain().getHumidity());
        wd.setWindSpeed((float) resp.getWind().getSpeed());

        if (resp.getClouds() != null) {
            // Estimate sunshine hours from cloud cover (simple inverse)
            // 100% clouds = 0 sun, 0% clouds = 12 sun? Rough approx.
            // Better: (1 - cloud%/100) * DayLength. Assume 12h day.
            float cloudFraction = resp.getClouds().getAll() / 100.0f;
            wd.setSunshineHours((1.0f - cloudFraction) * 12.0f);
        }

        wd.setAtmosphericPressure((float) resp.getMain().getPressure() / 10.0f); // hPa to kPa

        // Estimate Solar Radiation (Rs) using AgroPhysicsService
        // Need Tmax, Tmin. Current API gives temp_min, temp_max for the *moment* or
        // *day*?
        // standard /weather endpoint gives min/max for the current moment's variation
        // (often same as temp).
        // This is a limitation.
        // But we can use temp_max and temp_min if they differ, or estimate from
        // history.
        // For now, we use the provided values.
        double tMax = resp.getMain().getTempMax();
        double tMin = resp.getMain().getTempMin();

        // If tMax approx tMin (common in current weather), we can't estimate Radiation
        // well.
        // But we have no choice without One Call API.
        // We'll calculate it anyway.
        double lat = resp.getCoord().getLat();
        int dayOfYear = LocalDate.now().getDayOfYear();

        double rs = agroPhysicsService.estimateSolarRadiation(tMax, tMin, lat, dayOfYear);
        wd.setSolarRadiation((float) rs);

        wd.setForecastTime(LocalDateTime.ofInstant(Instant.ofEpochSecond(resp.getDt()), ZoneId.systemDefault()));

        // Save
        weatherDataRepository.save(wd);
        log.debug("Saved weather for {}: Temp={}C, Hum={}%, Rs={:.2f}", locationName, wd.getTemperature(),
                wd.getHumidity(), rs);
    }

    private void fetchForecastAndSave(Device device) {
        String url;
        if (device.getLatitude() != null && device.getLongitude() != null) {
            url = String.format("%s/forecast?lat=%s&lon=%s&units=metric&appid=%s",
                    apiUrl, device.getLatitude(), device.getLongitude(), apiKey);
        } else if (device.getLocation() != null && !device.getLocation().isBlank()) {
            url = String.format("%s/forecast?q=%s&units=metric&appid=%s",
                    apiUrl, device.getLocation(), apiKey);
        } else {
            log.warn("Device {} has no location defined for forecast", device.getDeviceCode());
            return;
        }

        OpenWeatherForecastResponse resp = restTemplate.getForObject(url, OpenWeatherForecastResponse.class);
        if (resp != null && resp.list() != null) {
            saveForecastData(resp, device.getLocation());
        }
    }

    private void saveForecastData(OpenWeatherForecastResponse resp, String locationName) {
        // Group by day
        Map<LocalDate, List<OpenWeatherForecastResponse.ForecastItem>> byDay = new HashMap<>();

        for (OpenWeatherForecastResponse.ForecastItem item : resp.list()) {
            LocalDate date = LocalDateTime.ofInstant(Instant.ofEpochSecond(item.dt()), ZoneId.systemDefault())
                    .toLocalDate();
            byDay.computeIfAbsent(date, k -> new java.util.ArrayList<>()).add(item);
        }

        // Aggregate and save
        for (Map.Entry<LocalDate, List<OpenWeatherForecastResponse.ForecastItem>> entry : byDay.entrySet()) {
            LocalDate date = entry.getKey();
            List<OpenWeatherForecastResponse.ForecastItem> dayItems = entry.getValue();

            // Skip if not enough data points for reliable day avg (optional, but good for
            // partial days)
            // For now we save everything.

            DailyWeatherForecast forecast = dailyWeatherForecastRepository
                    .findByLocationAndForecastDate(locationName, date)
                    .orElse(new DailyWeatherForecast());

            forecast.setLocation(locationName);
            forecast.setForecastDate(date);

            double minTemp = dayItems.stream().mapToDouble(i -> i.main().tempMin()).min().orElse(0);
            double maxTemp = dayItems.stream().mapToDouble(i -> i.main().tempMax()).max().orElse(0);
            double avgTemp = dayItems.stream().mapToDouble(i -> i.main().temp()).average().orElse(0);
            double avgHum = dayItems.stream().mapToDouble(i -> i.main().humidity()).average().orElse(0);
            double avgWind = dayItems.stream().mapToDouble(i -> i.wind().speed()).average().orElse(0);
            double avgPop = dayItems.stream().mapToDouble(i -> i.pop()).average().orElse(0);
            double avgClouds = dayItems.stream().mapToDouble(i -> i.clouds().all()).average().orElse(0);

            // Total rain for the day (sum of 3h periods)
            // Rain field might be null if no rain
            double totalRain = dayItems.stream()
                    .mapToDouble(i -> i.rain() != null ? i.rain().threeH() : 0.0)
                    .sum();

            forecast.setTempMin((float) minTemp);
            forecast.setTempMax((float) maxTemp);
            forecast.setTempAvg((float) avgTemp);
            forecast.setHumidityAvg((float) avgHum);
            forecast.setWindSpeedAvg((float) avgWind);
            forecast.setPrecipProbAvg((float) avgPop);
            forecast.setAvgClouds((float) avgClouds);
            forecast.setTotalRain((float) totalRain);

            dailyWeatherForecastRepository.save(forecast);
        }

        log.debug("Saved {} daily forecasts for {}", byDay.size(), locationName);
    }

    @Override
    @Transactional(readOnly = true)
    public WeatherDataDetailResponse getCurrentWeather(String location) {
        WeatherData weatherData = weatherDataRepository
                .findFirstByLocationOrderByForecastTimeDesc(location)
                .orElse(null);
        
        if (weatherData == null) {
            return null;
        }

        return new WeatherDataDetailResponse(
                weatherData.getId(),
                weatherData.getLocation(),
                weatherData.getTemperature(),
                weatherData.getHumidity(),
                weatherData.getPrecipitation(),
                weatherData.getPrecipitationProbability(),
                weatherData.getWindSpeed(),
                weatherData.getUvIndex(),
                weatherData.getForecastTime(),
                weatherData.getCreatedAt()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<DailyWeatherForecastResponse> getWeatherForecast(String location) {
        LocalDate today = LocalDate.now();
        LocalDate endDate = today.plusDays(5);
        
        List<DailyWeatherForecast> forecasts = dailyWeatherForecastRepository
                .findByLocationAndForecastDateBetween(location, today, endDate);
        
        return forecasts.stream()
                .map(f -> new DailyWeatherForecastResponse(
                        f.getId(),
                        f.getLocation(),
                        f.getForecastDate(),
                        f.getTempMin(),
                        f.getTempMax(),
                        f.getTempAvg(),
                        f.getHumidityAvg(),
                        f.getWindSpeedAvg(),
                        f.getTotalRain(),
                        f.getPrecipProbAvg(),
                        f.getAvgClouds()
                ))
                .sorted((a, b) -> a.forecastDate().compareTo(b.forecastDate()))
                .collect(Collectors.toList());
    }
}
