"""
Plant Image Analysis Service
─────────────────────────────
YOLO-based pipeline for plant disease detection, classification,
and segmentation using the Ultralytics library.

Supports three tasks:
  • detect   — bounding-box detection (disease spots, pests, fruits)
  • classify — whole-image classification (healthy vs diseased)
  • segment  — instance segmentation (leaf area, affected regions)

Model files are auto-loaded from `app/ml/models/plant/` on first call.
If no fine-tuned model is found, the service falls back to a
pretrained YOLO11 model (downloaded once).
"""

import base64
import logging
import time
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from PIL import Image

from app.models.plant_analysis import (
    AnalysisTask,
    BoundingBox,
    ClassificationResult,
    DetectionResult,
    HealthStatus,
    PlantAnalysisResponse,
    PlantHealthSummary,
    SegmentResult,
)

logger = logging.getLogger(__name__)

# ── Directories ────────────────────────────────────────
_MODEL_DIR = Path("app/ml/models/plant")

# Default pretrained model names (downloaded once by ultralytics)
_DEFAULT_MODELS: Dict[AnalysisTask, str] = {
    AnalysisTask.DETECT: "yolo11n.pt",
    AnalysisTask.CLASSIFY: "yolo11n-cls.pt",
    AnalysisTask.SEGMENT: "yolo11n-seg.pt",
}

# Known disease / pest class names for health summary
_DISEASE_KEYWORDS = {
    "leaf_spot", "blight", "rust", "mildew", "wilt",
    "mosaic", "rot", "canker", "scab", "anthracnose",
    "bacterial_spot", "downy_mildew", "powdery_mildew",
    "early_blight", "late_blight", "leaf_mold", "septoria",
    "target_spot", "yellow_leaf_curl",
}
_PEST_KEYWORDS = {
    "aphid", "spider_mite", "whitefly", "thrip",
    "caterpillar", "beetle", "mealybug", "snail",
}


class PlantImageService:
    """Singleton-style service — lazily loads YOLO models."""

    def __init__(self) -> None:
        self._models: Dict[AnalysisTask, object] = {}
        _MODEL_DIR.mkdir(parents=True, exist_ok=True)

    # ── Public API ─────────────────────────────────────

    def analyze(
        self,
        image_base64: str,
        task: AnalysisTask = AnalysisTask.DETECT,
        confidence: float = 0.25,
        device_id: int = 0,
    ) -> PlantAnalysisResponse:
        """Run end-to-end inference and return structured results."""

        img = self._decode_image(image_base64)
        model = self._get_model(task)

        t0 = time.perf_counter()
        results = model.predict(
            source=img,
            conf=confidence,
            verbose=False,
        )
        inference_ms = (time.perf_counter() - t0) * 1000

        result = results[0]  # single image → single Result

        if task == AnalysisTask.DETECT:
            detections = self._parse_detections(result)
            summary = self._build_summary(detections=detections)
            return PlantAnalysisResponse(
                device_id=device_id,
                task=task,
                detections=detections,
                summary=summary,
                inference_ms=round(inference_ms, 1),
            )

        if task == AnalysisTask.CLASSIFY:
            classifications = self._parse_classifications(result)
            summary = self._build_summary(classifications=classifications)
            return PlantAnalysisResponse(
                device_id=device_id,
                task=task,
                classifications=classifications,
                summary=summary,
                inference_ms=round(inference_ms, 1),
            )

        # task == SEGMENT
        segments = self._parse_segments(result)
        summary = self._build_summary(segments=segments)
        return PlantAnalysisResponse(
            device_id=device_id,
            task=task,
            segments=segments,
            summary=summary,
            inference_ms=round(inference_ms, 1),
        )

    # ── Model management ──────────────────────────────

    def _get_model(self, task: AnalysisTask):
        """Lazy-load or return cached YOLO model for the given task."""
        if task in self._models:
            return self._models[task]

        from ultralytics import YOLO

        # 1) Look for fine-tuned model in local dir
        custom_path = self._find_custom_model(task)
        if custom_path:
            logger.info("Loading custom %s model: %s", task.value, custom_path)
            model = YOLO(str(custom_path))
        else:
            # 2) Fallback to pretrained
            default_name = _DEFAULT_MODELS[task]
            logger.info(
                "No custom %s model found — using pretrained %s",
                task.value,
                default_name,
            )
            model = YOLO(default_name)

        self._models[task] = model
        return model

    def _find_custom_model(self, task: AnalysisTask) -> Optional[Path]:
        """Search recursively for latest custom model checkpoint for a task."""
        prefix = f"plant_{task.value}"
        patterns = [
            f"{prefix}*.pt",
            f"{prefix}/weights/best.pt",
            f"{prefix}*/weights/best.pt",
        ]
        paths: List[Path] = []
        for pattern in patterns:
            paths.extend(_MODEL_DIR.rglob(pattern))

        # Unique existing files only, newest first.
        candidates = sorted(
            {p for p in paths if p.is_file()},
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        return candidates[0] if candidates else None

    def load_custom_model(self, task: AnalysisTask, model_path: str) -> None:
        """Explicitly load a custom model (e.g. after training)."""
        from ultralytics import YOLO

        path = Path(model_path)
        if not path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        self._models[task] = YOLO(str(path))
        logger.info("Custom model loaded: %s → %s", task.value, model_path)

    # ── Image decoding ─────────────────────────────────

    @staticmethod
    def _decode_image(image_base64: str) -> np.ndarray:
        """Decode Base64 → PIL → numpy RGB array."""
        raw = base64.b64decode(image_base64)
        img = Image.open(BytesIO(raw)).convert("RGB")
        return np.asarray(img)

    # ── Result parsers ─────────────────────────────────

    @staticmethod
    def _parse_detections(result) -> List[DetectionResult]:
        detections: List[DetectionResult] = []
        boxes = result.boxes
        if boxes is None:
            return detections
        for i in range(len(boxes)):
            xyxy = boxes.xyxy[i].tolist()
            detections.append(
                DetectionResult(
                    label=result.names[int(boxes.cls[i])],
                    confidence=round(float(boxes.conf[i]), 4),
                    bbox=BoundingBox(x1=xyxy[0], y1=xyxy[1], x2=xyxy[2], y2=xyxy[3]),
                )
            )
        return detections

    @staticmethod
    def _parse_classifications(result) -> List[ClassificationResult]:
        probs = result.probs
        if probs is None:
            return []
        top5_indices = probs.top5
        top5_confs = probs.top5conf.tolist()
        return [
            ClassificationResult(
                label=result.names[idx],
                confidence=round(conf, 4),
            )
            for idx, conf in zip(top5_indices, top5_confs)
        ]

    @staticmethod
    def _parse_segments(result) -> List[SegmentResult]:
        segments: List[SegmentResult] = []
        boxes = result.boxes
        masks = result.masks
        if boxes is None or masks is None:
            return segments
        for i in range(len(boxes)):
            xyxy = boxes.xyxy[i].tolist()
            mask_data = masks.data[i].cpu().numpy()
            area = int(mask_data.sum())
            segments.append(
                SegmentResult(
                    label=result.names[int(boxes.cls[i])],
                    confidence=round(float(boxes.conf[i]), 4),
                    bbox=BoundingBox(x1=xyxy[0], y1=xyxy[1], x2=xyxy[2], y2=xyxy[3]),
                    area_pixels=area,
                )
            )
        return segments

    # ── Health summary builder ─────────────────────────

    def _build_summary(
        self,
        detections: Optional[List[DetectionResult]] = None,
        classifications: Optional[List[ClassificationResult]] = None,
        segments: Optional[List[SegmentResult]] = None,
    ) -> PlantHealthSummary:
        """Derive plant health status from raw results."""

        disease_names: List[str] = []
        pest_names: List[str] = []
        health_score = 1.0

        # — Detection-based summary —
        if detections:
            for d in detections:
                name_lower = d.label.lower().replace(" ", "_")
                if name_lower in _DISEASE_KEYWORDS or any(kw in name_lower for kw in _DISEASE_KEYWORDS):
                    disease_names.append(d.label)
                elif name_lower in _PEST_KEYWORDS or any(kw in name_lower for kw in _PEST_KEYWORDS):
                    pest_names.append(d.label)
            # Score decreases with more disease/pest detections
            n_issues = len(disease_names) + len(pest_names)
            if n_issues:
                health_score = max(0.0, 1.0 - 0.15 * n_issues)

        # — Classification-based summary —
        if classifications and classifications[0].label.lower() != "healthy":
            top = classifications[0]
            name_lower = top.label.lower().replace(" ", "_")
            if any(kw in name_lower for kw in _DISEASE_KEYWORDS):
                disease_names.append(top.label)
            health_score = max(0.0, 1.0 - top.confidence)

        # — Segment-based summary —
        affected_pct = 0.0
        if segments:
            total_area = sum(s.area_pixels for s in segments)
            disease_area = sum(
                s.area_pixels
                for s in segments
                if s.label.lower().replace(" ", "_") in _DISEASE_KEYWORDS
                or any(kw in s.label.lower() for kw in _DISEASE_KEYWORDS)
            )
            if total_area > 0:
                affected_pct = round(disease_area / total_area * 100, 1)
            for s in segments:
                name_lower = s.label.lower().replace(" ", "_")
                if name_lower in _DISEASE_KEYWORDS or any(kw in name_lower for kw in _DISEASE_KEYWORDS):
                    disease_names.append(s.label)
            if affected_pct > 0:
                health_score = max(0.0, 1.0 - affected_pct / 100)

        # Deduplicate
        disease_names = list(dict.fromkeys(disease_names))
        pest_names = list(dict.fromkeys(pest_names))

        status = self._score_to_status(health_score)
        recommendation = self._make_recommendation(status, disease_names, pest_names)

        return PlantHealthSummary(
            status=status,
            health_score=round(health_score, 2),
            disease_names=disease_names,
            pest_names=pest_names,
            affected_area_pct=affected_pct,
            recommendation=recommendation,
        )

    # ── Helpers ────────────────────────────────────────

    @staticmethod
    def _score_to_status(score: float) -> HealthStatus:
        if score >= 0.85:
            return HealthStatus.HEALTHY
        if score >= 0.65:
            return HealthStatus.MILD_STRESS
        if score >= 0.40:
            return HealthStatus.MODERATE_STRESS
        if score >= 0.20:
            return HealthStatus.SEVERE_STRESS
        return HealthStatus.CRITICAL

    @staticmethod
    def _make_recommendation(
        status: HealthStatus,
        diseases: List[str],
        pests: List[str],
    ) -> str:
        parts: List[str] = []
        if status == HealthStatus.HEALTHY:
            return "Cây đang khoẻ mạnh. Tiếp tục chế độ chăm sóc hiện tại."

        if diseases:
            parts.append(f"Phát hiện bệnh: {', '.join(diseases)}. Kiểm tra và xử lý thuốc phù hợp.")
        if pests:
            parts.append(f"Phát hiện sâu hại: {', '.join(pests)}. Cân nhắc biện pháp phòng trừ.")

        if status in (HealthStatus.SEVERE_STRESS, HealthStatus.CRITICAL):
            parts.append("Tình trạng nghiêm trọng — cần xử lý ngay.")

        return " ".join(parts) if parts else "Cây có dấu hiệu stress nhẹ. Theo dõi thêm."
