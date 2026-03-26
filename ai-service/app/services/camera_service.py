"""
Camera Service — manages laptop webcam for real-time YOLO inference.

Provides:
  • MJPEG streaming with YOLO detection overlay
  • Single-frame capture with detection results
  • Camera lifecycle management (open/close/status)

Thread-safe: uses a lock for camera access so multiple
concurrent requests don't conflict.
"""

import base64
import logging
import threading
import time
from io import BytesIO
from typing import Dict, Generator, List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

from app.models.plant_analysis import (
    AnalysisTask,
    BoundingBox,
    DetectionResult,
    HealthStatus,
    PlantAnalysisResponse,
    PlantHealthSummary,
)

logger = logging.getLogger(__name__)


class CameraService:
    """Manages a single camera source with YOLO inference."""

    def __init__(self) -> None:
        self._cap: Optional[cv2.VideoCapture] = None
        self._lock = threading.Lock()
        self._model = None
        self._model_loaded = False
        self._source: int = 0  # default webcam

    # ── Camera lifecycle ───────────────────────────────

    def open(self, source: int = 0) -> bool:
        """Open camera. Returns True if successful."""
        with self._lock:
            if self._cap is not None and self._cap.isOpened():
                if self._source == source:
                    return True
                self._cap.release()

            self._source = source
            cap = cv2.VideoCapture(source, cv2.CAP_DSHOW)
            if not cap.isOpened():
                # Fallback without DSHOW
                cap = cv2.VideoCapture(source)

            if not cap.isOpened():
                logger.error("Cannot open camera source %s", source)
                return False

            # Set reasonable resolution
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            self._cap = cap
            logger.info("Camera opened: source=%s", source)
            return True

    def close(self) -> None:
        """Release camera resource."""
        with self._lock:
            if self._cap is not None:
                self._cap.release()
                self._cap = None
                logger.info("Camera closed")

    def is_opened(self) -> bool:
        with self._lock:
            return self._cap is not None and self._cap.isOpened()

    def status(self) -> Dict:
        opened = self.is_opened()
        info: Dict = {
            "camera_available": opened,
            "source": self._source,
            "model_loaded": self._model_loaded,
        }
        if opened and self._cap is not None:
            info["resolution"] = {
                "width": int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            }
            info["fps"] = round(self._cap.get(cv2.CAP_PROP_FPS), 1)
        return info

    # ── Model management ──────────────────────────────

    def _ensure_model(self):
        """Lazy-load the YOLO detection model."""
        if self._model is not None:
            return self._model

        from pathlib import Path
        from ultralytics import YOLO

        # Try custom trained model first
        custom_path = Path("app/ml/models/plant/plant_detect/weights/best.pt")
        if custom_path.exists():
            logger.info("Loading custom detection model: %s", custom_path)
            self._model = YOLO(str(custom_path))
        else:
            logger.info("No custom model found, using pretrained yolo11n.pt")
            self._model = YOLO("yolo11n.pt")

        self._model_loaded = True
        return self._model

    # ── Frame capture ─────────────────────────────────

    def _read_frame(self) -> Optional[np.ndarray]:
        """Read a single frame from the camera (thread-safe)."""
        with self._lock:
            if self._cap is None or not self._cap.isOpened():
                return None
            ret, frame = self._cap.read()
            return frame if ret else None

    # ── MJPEG streaming ───────────────────────────────

    def generate_stream(
        self,
        run_detection: bool = True,
        confidence: float = 0.25,
        target_fps: float = 10.0,
    ) -> Generator[bytes, None, None]:
        """
        Yield MJPEG frames as bytes for StreamingResponse.
        If run_detection=True, overlays YOLO bounding boxes.
        """
        model = self._ensure_model() if run_detection else None
        frame_interval = 1.0 / target_fps

        while True:
            t0 = time.perf_counter()
            frame = self._read_frame()
            if frame is None:
                # Yield a blank frame to keep stream alive
                time.sleep(0.1)
                continue

            if model is not None:
                results = model.predict(
                    source=frame,
                    conf=confidence,
                    verbose=False,
                    stream=False,
                )
                # Draw boxes on frame
                frame = results[0].plot()

            # Encode to JPEG
            _, jpeg = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75]
            )
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + jpeg.tobytes()
                + b"\r\n"
            )

            # Throttle to target FPS
            elapsed = time.perf_counter() - t0
            if elapsed < frame_interval:
                time.sleep(frame_interval - elapsed)

    # ── Single capture + detect ───────────────────────

    def capture_and_detect(
        self,
        confidence: float = 0.25,
        device_id: int = 0,
    ) -> Tuple[PlantAnalysisResponse, str]:
        """
        Capture one frame, run YOLO detection, return:
          - PlantAnalysisResponse with detections + summary
          - Base64-encoded annotated image (JPEG)
        """
        frame = self._read_frame()
        if frame is None:
            raise RuntimeError("Camera not available or frame capture failed")

        model = self._ensure_model()

        t0 = time.perf_counter()
        results = model.predict(source=frame, conf=confidence, verbose=False)
        inference_ms = (time.perf_counter() - t0) * 1000

        result = results[0]

        # Parse detections
        detections = self._parse_detections(result)
        summary = self._build_summary(detections)

        # Annotated image → base64
        annotated = result.plot()
        annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(annotated_rgb)
        buf = BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        annotated_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        # Original image → base64
        response = PlantAnalysisResponse(
            device_id=device_id,
            task=AnalysisTask.DETECT,
            detections=detections,
            summary=summary,
            inference_ms=round(inference_ms, 1),
        )

        return response, annotated_b64

    # ── Parsers (same logic as PlantImageService) ─────

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

    def _build_summary(self, detections: List[DetectionResult]) -> PlantHealthSummary:
        disease_names: List[str] = []
        pest_names: List[str] = []
        health_score = 1.0

        for d in detections:
            name_lower = d.label.lower().replace(" ", "_")
            if any(kw in name_lower for kw in self._DISEASE_KEYWORDS):
                disease_names.append(d.label)
            elif any(kw in name_lower for kw in self._PEST_KEYWORDS):
                pest_names.append(d.label)

        n_issues = len(disease_names) + len(pest_names)
        if n_issues:
            health_score = max(0.0, 1.0 - 0.15 * n_issues)

        disease_names = list(dict.fromkeys(disease_names))
        pest_names = list(dict.fromkeys(pest_names))

        if health_score >= 0.85:
            status = HealthStatus.HEALTHY
        elif health_score >= 0.65:
            status = HealthStatus.MILD_STRESS
        elif health_score >= 0.40:
            status = HealthStatus.MODERATE_STRESS
        elif health_score >= 0.20:
            status = HealthStatus.SEVERE_STRESS
        else:
            status = HealthStatus.CRITICAL

        recommendation = ""
        if status == HealthStatus.HEALTHY:
            recommendation = "Cây khoẻ mạnh. Tiếp tục chăm sóc bình thường."
        elif disease_names:
            recommendation = f"Phát hiện bệnh: {', '.join(disease_names)}. Cần xử lý sớm."
        elif pest_names:
            recommendation = f"Phát hiện sâu hại: {', '.join(pest_names)}. Kiểm tra và phun thuốc."

        return PlantHealthSummary(
            status=status,
            health_score=round(health_score, 2),
            disease_names=disease_names,
            pest_names=pest_names,
            affected_area_pct=0.0,
            recommendation=recommendation,
        )
