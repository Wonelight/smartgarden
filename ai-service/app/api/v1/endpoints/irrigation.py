"""
Irrigation / AI prediction endpoints.
Nhận request từ Spring Boot backend, trả stub prediction results.
"""

import logging
from fastapi import APIRouter

from app.models.irrigation import (
    AiPredictRequest,
    AiPredictResponse,
    AiTrainRequest,
    AiTrainResponse,
    TrainBatchRequest,
    TrainBatchResponse,
)
from app.services.anfis_service import AnfisStubService

logger = logging.getLogger(__name__)
router = APIRouter()

anfis_service = AnfisStubService()


@router.post("/predict", response_model=AiPredictResponse, summary="AI Prediction")
async def predict(request: AiPredictRequest):
    """
    Nhận sensor data từ backend, trả kết quả prediction (stub).
    Backend gọi endpoint này qua AiPredictionServiceImpl.
    """
    logger.info("Predict request device=%s sensor=%s", request.device_id, request.sensor_data_id or 'aggregate')
    return anfis_service.predict(request)


@router.post("/train", response_model=AiTrainResponse, summary="AI Training")
async def train(request: AiTrainRequest):
    """
    Trigger model training cho device (stub).
    Backend gọi endpoint này qua AiPredictionServiceImpl.
    """
    logger.info("Train request device=%s epochs=%s", request.device_id, request.epochs)
    return anfis_service.train(request)


@router.post("/train-batch", response_model=TrainBatchResponse, summary="Batch Training")
async def train_batch(request: TrainBatchRequest):
    """
    Nhận labeled training samples từ BatchJobServiceImpl.executeWeeklyTrainingJob().
    Xây dựng DataFrame, retrain XGBoost/RF, lưu model mới.
    """
    logger.info("Train-batch request: %d samples", request.n_samples)
    return anfis_service.train_batch(request)
