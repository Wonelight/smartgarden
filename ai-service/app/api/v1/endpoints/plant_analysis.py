"""
Plant Image Analysis endpoints
───────────────────────────────
POST /api/v1/plant/analyze   — phân tích ảnh cây trồng (detect / classify / segment)
POST /api/v1/plant/train     — fine-tune YOLO trên dataset tuỳ chỉnh
GET  /api/v1/plant/models    — liệt kê model hiện có
"""

import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel

from app.models.plant_analysis import (
    AnalysisTask,
    PlantAnalysisRequest,
    PlantAnalysisResponse,
)
from app.services.plant_image_service import PlantImageService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/plant", tags=["Plant Image Analysis"])

# Service singleton
_service = PlantImageService()

# ── Analyze ────────────────────────────────────────────

@router.post(
    "/analyze",
    response_model=PlantAnalysisResponse,
    summary="Phân tích ảnh cây trồng",
    description=(
        "Nhận ảnh Base64, chạy YOLO inference.\n\n"
        "- **detect** — phát hiện bệnh, sâu hại, quả\n"
        "- **classify** — phân loại khoẻ / bệnh\n"
        "- **segment** — phân vùng lá bị ảnh hưởng"
    ),
)
async def analyze_plant(request: PlantAnalysisRequest) -> PlantAnalysisResponse:
    try:
        return _service.analyze(
            image_base64=request.image_base64,
            task=request.task,
            confidence=request.confidence_threshold,
            device_id=request.device_id,
        )
    except Exception as exc:
        logger.exception("Plant analysis failed for device %s", request.device_id)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Train / Fine-tune ─────────────────────────────────


class TrainResult(BaseModel):
    message: str
    task: str
    model_path: str = ""
    epochs: int = 0
    dataset: str = ""


@router.post(
    "/train",
    response_model=TrainResult,
    summary="Fine-tune YOLO model cho cây trồng",
)
async def train_model(
    dataset_path: str = Form(..., description="Đường dẫn đến dataset YOLO-format (data.yaml)"),
    task: AnalysisTask = Form(AnalysisTask.DETECT),
    epochs: int = Form(50, ge=1, le=500),
    imgsz: int = Form(640, ge=64, le=1280),
    batch: int = Form(16, ge=1, le=128),
) -> TrainResult:
    """
    Bắt đầu fine-tune YOLO model.

    Dataset phải theo chuẩn Ultralytics YOLO format:
      dataset/
        data.yaml
        train/images/
        train/labels/
        val/images/
        val/labels/
    """
    from ultralytics import YOLO

    dataset = Path(dataset_path)
    if not dataset.exists():
        raise HTTPException(status_code=400, detail=f"Dataset not found: {dataset_path}")

    try:
        # Pick base model by task
        base_models = {
            AnalysisTask.DETECT: "yolo11n.pt",
            AnalysisTask.CLASSIFY: "yolo11n-cls.pt",
            AnalysisTask.SEGMENT: "yolo11n-seg.pt",
        }
        model = YOLO(base_models[task])

        results = model.train(
            data=str(dataset),
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            project="app/ml/models/plant",
            name=f"plant_{task.value}",
            exist_ok=True,
        )

        # Copy best weights
        best_pt = Path(f"app/ml/models/plant/plant_{task.value}/weights/best.pt")
        saved_path = str(best_pt) if best_pt.exists() else ""

        # Reload the trained model into service
        if saved_path:
            _service.load_custom_model(task, saved_path)

        logger.info("Training complete: task=%s epochs=%d path=%s", task.value, epochs, saved_path)

        return TrainResult(
            message="Training completed successfully",
            task=task.value,
            model_path=saved_path,
            epochs=epochs,
            dataset=str(dataset),
        )
    except Exception as exc:
        logger.exception("Training failed")
        raise HTTPException(status_code=500, detail=str(exc))


# ── List models ────────────────────────────────────────

class ModelInfo(BaseModel):
    name: str
    path: str
    size_mb: float
    task: str


@router.get(
    "/models",
    response_model=List[ModelInfo],
    summary="Liệt kê model phân tích cây trồng",
)
async def list_models() -> List[ModelInfo]:
    model_dir = Path("app/ml/models/plant")
    if not model_dir.exists():
        return []

    models: List[ModelInfo] = []
    for pt_file in model_dir.rglob("*.pt"):
        # Infer task from filename
        name = pt_file.stem.lower()
        if "seg" in name:
            task = "segment"
        elif "cls" in name:
            task = "classify"
        else:
            task = "detect"

        models.append(
            ModelInfo(
                name=pt_file.name,
                path=str(pt_file),
                size_mb=round(pt_file.stat().st_size / (1024 * 1024), 2),
                task=task,
            )
        )
    return models
