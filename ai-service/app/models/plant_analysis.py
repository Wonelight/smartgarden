"""Pydantic schemas for plant image analysis pipeline."""

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────

class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    MILD_STRESS = "mild_stress"
    MODERATE_STRESS = "moderate_stress"
    SEVERE_STRESS = "severe_stress"
    CRITICAL = "critical"


class AnalysisTask(str, Enum):
    DETECT = "detect"          # Object detection (disease spots, pests, fruits)
    CLASSIFY = "classify"      # Whole-image classification (healthy / diseased)
    SEGMENT = "segment"        # Instance segmentation (leaf area, affected area)


# ── Request ────────────────────────────────────────────

class PlantAnalysisRequest(BaseModel):
    device_id: int = Field(..., description="ID thiết bị gửi ảnh")
    image_base64: str = Field(..., description="Ảnh mã hoá Base64 (JPEG/PNG)")
    task: AnalysisTask = Field(
        default=AnalysisTask.DETECT,
        description="Loại phân tích: detect | classify | segment",
    )
    confidence_threshold: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        description="Ngưỡng confidence tối thiểu",
    )


# ── Response sub-models ────────────────────────────────

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectionResult(BaseModel):
    label: str = Field(..., description="Tên class (vd: leaf_spot, aphid, tomato)")
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BoundingBox


class ClassificationResult(BaseModel):
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class SegmentResult(BaseModel):
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BoundingBox
    mask_rle: Optional[str] = Field(
        None, description="Run-length encoded mask (optional)"
    )
    area_pixels: int = Field(0, description="Diện tích vùng segment (px)")


class PlantHealthSummary(BaseModel):
    status: HealthStatus = HealthStatus.HEALTHY
    health_score: float = Field(1.0, ge=0.0, le=1.0, description="0 = critical, 1 = healthy")
    disease_names: List[str] = Field(default_factory=list)
    pest_names: List[str] = Field(default_factory=list)
    affected_area_pct: float = Field(
        0.0, ge=0.0, le=100.0,
        description="% diện tích lá bị ảnh hưởng (chỉ với segment)",
    )
    recommendation: str = ""


# ── Main Response ──────────────────────────────────────

class PlantAnalysisResponse(BaseModel):
    device_id: int
    task: AnalysisTask
    detections: List[DetectionResult] = Field(default_factory=list)
    classifications: List[ClassificationResult] = Field(default_factory=list)
    segments: List[SegmentResult] = Field(default_factory=list)
    summary: PlantHealthSummary = Field(default_factory=PlantHealthSummary)
    inference_ms: float = Field(0.0, description="Thời gian inference (ms)")
