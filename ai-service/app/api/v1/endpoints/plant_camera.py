"""
Plant Camera endpoints — live MJPEG stream and single-frame capture
with YOLO detection overlay.

GET  /api/v1/plant/camera/stream   — MJPEG video stream (embed in <img>)
POST /api/v1/plant/camera/capture  — single capture → detections + annotated image
POST /api/v1/plant/camera/open     — open camera
POST /api/v1/plant/camera/close    — close camera
GET  /api/v1/plant/camera/status   — camera availability info
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.models.plant_analysis import PlantAnalysisResponse
from app.services.camera_service import CameraService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plant/camera", tags=["Plant Camera"])

# Service singleton
_camera = CameraService()


# ── Models ─────────────────────────────────────────────

class CameraOpenRequest(BaseModel):
    source: int = Field(default=0, description="Camera index (0=default webcam)")


class CameraCaptureRequest(BaseModel):
    confidence: float = Field(default=0.25, ge=0.0, le=1.0)
    device_id: int = Field(default=0, description="ID thiết bị liên kết")


class CameraCaptureResponse(BaseModel):
    analysis: PlantAnalysisResponse
    annotated_image_base64: str = Field(
        ...,
        description="Ảnh JPEG đã vẽ bounding box, mã hoá Base64",
    )


class CameraStatusResponse(BaseModel):
    camera_available: bool
    source: int
    model_loaded: bool
    resolution: Optional[dict] = None
    fps: Optional[float] = None


# ── Open camera ────────────────────────────────────────

@router.post(
    "/open",
    response_model=dict,
    summary="Mở camera laptop",
)
async def open_camera(request: CameraOpenRequest = CameraOpenRequest()):
    success = _camera.open(source=request.source)
    if not success:
        raise HTTPException(
            status_code=503,
            detail=f"Không thể mở camera source={request.source}",
        )
    return {"message": "Camera đã mở", "source": request.source}


# ── Close camera ───────────────────────────────────────

@router.post(
    "/close",
    response_model=dict,
    summary="Đóng camera",
)
async def close_camera():
    _camera.close()
    return {"message": "Camera đã đóng"}


# ── Status ─────────────────────────────────────────────

@router.get(
    "/status",
    response_model=CameraStatusResponse,
    summary="Kiểm tra trạng thái camera",
)
async def camera_status():
    return _camera.status()


# ── MJPEG stream ──────────────────────────────────────

@router.get(
    "/stream",
    summary="MJPEG video stream với YOLO overlay",
    description=(
        "Trả về multipart MJPEG stream. Nhúng vào frontend:\n"
        "`<img src=\"/api/v1/plant/camera/stream\" />`\n\n"
        "Camera sẽ tự mở nếu chưa open."
    ),
)
async def stream_camera(
    detect: bool = Query(True, description="Chạy YOLO trên mỗi frame?"),
    confidence: float = Query(0.25, ge=0.0, le=1.0),
    fps: float = Query(10.0, ge=1.0, le=30.0, description="Target FPS"),
    source: int = Query(0, description="Camera source index"),
):
    # Auto-open camera if not yet opened
    if not _camera.is_opened():
        success = _camera.open(source=source)
        if not success:
            raise HTTPException(
                status_code=503,
                detail="Không thể mở camera",
            )

    return StreamingResponse(
        _camera.generate_stream(
            run_detection=detect,
            confidence=confidence,
            target_fps=fps,
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Single capture ─────────────────────────────────────

@router.post(
    "/capture",
    response_model=CameraCaptureResponse,
    summary="Chụp 1 frame, chạy YOLO, trả kết quả",
    description=(
        "Chụp 1 ảnh từ camera, chạy detection, trả về:\n"
        "- Kết quả phân tích (detections, summary)\n"
        "- Ảnh đã vẽ bounding box (base64 JPEG)"
    ),
)
async def capture_and_detect(request: CameraCaptureRequest = CameraCaptureRequest()):
    # Auto-open camera if not yet opened
    if not _camera.is_opened():
        success = _camera.open()
        if not success:
            raise HTTPException(
                status_code=503,
                detail="Không thể mở camera",
            )

    try:
        analysis, annotated_b64 = _camera.capture_and_detect(
            confidence=request.confidence,
            device_id=request.device_id,
        )
        return CameraCaptureResponse(
            analysis=analysis,
            annotated_image_base64=annotated_b64,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
