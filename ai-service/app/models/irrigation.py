"""
Pydantic schemas cho AI prediction requests / responses.
Khớp với contract của Spring Boot backend.
Payload mô tả đầy đủ: sensors + openweather + crop context.

Validation: sensor values are clamped to valid domain ranges.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ── Helper: domain clamp ─────────────────────────────────

def _clamp(v: Optional[float], lo: float, hi: float) -> Optional[float]:
    if v is None:
        return None
    return max(lo, min(hi, v))


# ── Nested payload blocks ────────────────────────────────

class SensorPayload(BaseModel):
    """Dữ liệu sensor từ ESP32 — validated & clamped."""
    temp: Optional[float] = Field(None, description="Nhiệt độ không khí (°C)")
    humidity: Optional[float] = Field(None, description="Độ ẩm không khí (%)")
    soil_moist1: Optional[float] = Field(None, description="Độ ẩm đất sensor 1 (%)")
    soil_moist2: Optional[float] = Field(None, description="Độ ẩm đất sensor 2 (%)")
    rain: Optional[int] = Field(None, description="Rain detected (0/1)")
    light: Optional[float] = Field(None, description="Cường độ ánh sáng (lux)")

    @field_validator("temp", mode="before")
    @classmethod
    def clamp_temp(cls, v):
        return _clamp(v, 0, 50)

    @field_validator("humidity", mode="before")
    @classmethod
    def clamp_humidity(cls, v):
        return _clamp(v, 0, 100)

    @field_validator("soil_moist1", "soil_moist2", mode="before")
    @classmethod
    def clamp_soil(cls, v):
        return _clamp(v, 0, 100)

    @field_validator("light", mode="before")
    @classmethod
    def clamp_light(cls, v):
        return _clamp(v, 0, 200_000)

    @field_validator("rain", mode="before")
    @classmethod
    def clamp_rain(cls, v):
        if v is None:
            return None
        return max(0, min(1, int(v)))


class DailyForecast(BaseModel):
    """Dự báo thời tiết từng ngày (đã aggregate)."""
    date: str
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None
    temp_avg: Optional[float] = None
    humidity_avg: Optional[float] = None
    wind_speed_avg: Optional[float] = None
    total_rain: Optional[float] = None
    precip_prob_avg: Optional[float] = None
    avg_clouds: Optional[float] = None


class OpenWeatherPayload(BaseModel):
    """Dữ liệu thời tiết từ OpenWeather API."""
    temperature: Optional[float] = Field(None, description="Nhiệt độ dự báo (°C)")
    humidity: Optional[float] = Field(None, description="Độ ẩm dự báo (%)")
    wind_speed: Optional[float] = Field(None, description="Tốc độ gió (m/s)")
    forecast_rain: Optional[float] = Field(None, description="Lượng mưa dự báo (mm)")
    precipitation_probability: Optional[float] = Field(None, description="Xác suất mưa (0-1)")
    uv_index: Optional[float] = Field(None, description="Chỉ số UV")
    solar_radiation: Optional[float] = Field(None, description="Bức xạ mặt trời (MJ/m²/day)")
    sunshine_hours: Optional[float] = Field(None, description="Số giờ nắng")
    wind_speed_2m: Optional[float] = Field(None, description="Tốc độ gió tại 2m (m/s)")
    atmospheric_pressure: Optional[float] = Field(None, description="Áp suất khí quyển (kPa)")
    daily_forecasts: Optional[list[DailyForecast]] = Field(None, description="List 1-3 ngày dự báo")
    wind_rolling_24h: Optional[float] = Field(None, description="Tốc độ gió trung bình trong 24h qua")
    light_rolling_24h: Optional[float] = Field(None, description="Tổng lux trong 24h qua")
    hours_since_last_rain: Optional[int] = Field(None, description="Số giờ từ đợt mưa cuối (tại thời điểm dự báo)")


class CropPayload(BaseModel):
    """Thông tin cây trồng và đất từ CropSeason/CropLibrary/SoilLibrary."""
    type: Optional[str] = Field(None, description="Tên loại cây (e.g. 'rice')")
    growth_stage: Optional[str] = Field(None, description="Giai đoạn sinh trưởng (initial/development/mid/end)")
    plant_age_days: Optional[int] = Field(None, description="Tuổi cây (ngày kể từ gieo)")
    root_depth: Optional[float] = Field(None, description="Chiều sâu rễ hiện tại (m)")
    max_root_depth: Optional[float] = Field(None, description="Chiều sâu rễ tối đa (m)")
    kc_current: Optional[float] = Field(None, description="Hệ số cây trồng hiện tại (Kc)")
    depletion_fraction: Optional[float] = Field(None, description="Hệ số cạn kiệt cho phép (p)")
    soil_type: Optional[str] = Field(None, description="Loại đất (e.g. 'loam')")
    field_capacity: Optional[float] = Field(None, description="Dung tích đồng ruộng (%)")
    wilting_point: Optional[float] = Field(None, description="Điểm héo (%)")
    infiltration_shallow_ratio: Optional[float] = Field(
        None,
        description="Tỷ lệ mưa/tưới vào tầng nông (0-1). Null = mặc định 0.70 theo loại đất",
    )
    crop_height: Optional[float] = Field(None, description="Chiều cao cây trung bình trong giai đoạn (m)")
    latitude: Optional[float] = Field(None, description="Vĩ độ (°)")
    longitude: Optional[float] = Field(None, description="Kinh độ (°)")
    altitude: Optional[float] = Field(None, description="Độ cao (m)")


# ── Water balance snapshot (stateless predict) ───────────
# Backend gửi kèm trong request để AI không cần GET state từ backend.
# Xem DESIGN_STATELESS_AI.md.


class SoilMoisHistoryEntry(BaseModel):
    """Một điểm trong lịch sử độ ẩm đất (cho trend ~1h)."""
    timestamp: str  # ISO 8601
    value: float


class WaterBalanceSnapshot(BaseModel):
    """
    Snapshot state water balance do backend gửi trong mỗi request predict.
    Nếu có: AI dùng trực tiếp (stateless). Nếu không: fallback store in-memory (legacy).
    """
    shallow_depletion: float = 0.0
    deep_depletion: float = 0.0
    shallow_taw: float = 0.0
    deep_taw: float = 0.0
    shallow_raw: float = 0.0
    deep_raw: float = 0.0
    last_irrigation: float = 0.0
    last_updated: Optional[str] = None  # ISO 8601
    soil_moist_history: Optional[List[SoilMoisHistoryEntry]] = None
    # Lag features (optional): backend có thể gửi sẵn để giảm payload hoặc AI tính từ history
    depletion_trend_6h: Optional[float] = None
    rain_last_6h: Optional[float] = None
    etc_rolling_6h: Optional[float] = None
    depletion_trend_12h: Optional[float] = None
    rain_last_12h: Optional[float] = None
    etc_rolling_12h: Optional[float] = None
    depletion_trend_24h: Optional[float] = None
    rain_last_24h: Optional[float] = None
    etc_rolling_24h: Optional[float] = None


# ── Pump config ──────────────────────────────────────────

class PumpPayload(BaseModel):
    """Cấu hình máy bơm và vườn — gửi từ backend khi trigger predict."""
    pump_flow_rate_lpm: float = Field(0.5, description="Lưu lượng bơm (L/min mỗi vòi)")
    nozzle_count: int = Field(1, description="Số vòi phun")
    garden_area_m2: float = Field(1.0, description="Diện tích vườn (m²)")

    def flow_rate_mm_per_sec(self) -> float:
        """
        Quy đổi lưu lượng bơm sang mm/s trên diện tích vườn.
        flow_rate_mm/s = (pump_flow_rate_lpm × nozzle_count / 60) / garden_area_m2
        """
        return (self.pump_flow_rate_lpm * self.nozzle_count / 60.0) / max(self.garden_area_m2, 0.01)


# ── Requests ────────────────────────────────────────────

class AiPredictRequest(BaseModel):
    """
    Payload nhận từ backend khi gọi /ai/predict.
    Bao gồm: sensors, openweather, crop context; optional water_balance snapshot (stateless).
    """
    device_id: int
    sensor_data_id: Optional[int] = None
    sensors: SensorPayload
    openweather: Optional[OpenWeatherPayload] = None
    crop: Optional[CropPayload] = None
    water_balance: Optional[WaterBalanceSnapshot] = Field(
        None,
        description="Snapshot state từ backend. Có thì AI stateless, không cần GET/PUT state.",
    )
    pump: Optional[PumpPayload] = Field(
        None,
        description="Cấu hình máy bơm và vườn, dùng để tính flow_rate_mm_per_sec động.",
    )


class AiTrainRequest(BaseModel):
    """Payload nhận từ backend khi gọi /ai/train."""
    device_id: int
    epochs: int = 100
    learning_rate: float = 0.01
    data_count: int = 0


# ── Responses ───────────────────────────────────────────


class UpdatedWaterBalance(BaseModel):
    """
    Water balance state đã được tính toán lại sau prediction.
    Backend persist field này vào DB (single source of truth).
    """
    shallow_depletion: float
    deep_depletion: float
    shallow_taw: float
    deep_taw: float
    shallow_raw: float
    deep_raw: float
    last_irrigation: float = 0.0
    soil_moist_history: Optional[List[Any]] = None


class AiPredictResponse(BaseModel):
    """Response gửi về backend sau prediction."""
    device_id: int
    ai_output: float = Field(description="Raw AI output value (predicted water mm)")
    predicted_duration: int = Field(description="Predicted irrigation duration (seconds)")
    refined_duration: int = Field(description="Refined duration after post-processing")
    confidence: float = Field(ge=0, le=1, description="Model confidence score")
    accuracy: Optional[float] = None
    ai_params: Optional[Dict[str, Any]] = None
    # Water balance state đã được cập nhật — backend dùng để persist vào DB
    updated_water_balance: Optional[UpdatedWaterBalance] = Field(
        None,
        description="Updated water balance state after prediction — backend persists this to DB.",
    )


class AiTrainResponse(BaseModel):
    """Response gửi về backend sau training."""
    device_id: int
    accuracy: float = Field(ge=0, le=1)
    status: str = "completed"
    trained_params: Optional[Dict[str, Any]] = None


class TrainingSample(BaseModel):
    """Một dòng dữ liệu huấn luyện: features tại thời điểm dự đoán + nhãn thực tế."""
    features: Dict[str, Any]
    actual_depletion_mm: float
    device_id: Optional[int] = None
    prediction_id: Optional[int] = None
    label_source: str = "unknown"  # "actual_irrigation" | "proxy_model"


class TrainBatchRequest(BaseModel):
    """Payload từ BatchJobServiceImpl.executeWeeklyTrainingJob()."""
    samples: List[TrainingSample]
    n_samples: int


class TrainBatchResponse(BaseModel):
    """Kết quả retrain gửi về backend."""
    status: str
    n_samples: int
    n_actual: int          # số mẫu có label thực tế
    n_proxy: int           # số mẫu dùng proxy label
    r2: Optional[float] = None
    mae: Optional[float] = None
    cv_r2_mean: Optional[float] = None
    model_path: Optional[str] = None
    message: str = ""
