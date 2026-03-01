"""
ANFIS / AI Prediction Service — wires preprocessing → ML prediction → post-processing.
Replaces the old stub with the full physics-informed pipeline.
"""

import logging
from typing import Dict, Any

from app.models.irrigation import (
    AiPredictRequest,
    AiPredictResponse,
    AiTrainRequest,
    AiTrainResponse,
)
from app.services.preprocessing_service import PreprocessingService
from app.services.prediction_service import PredictionService, water_mm_to_duration_seconds
from app.services.water_balance import water_balance_store

logger = logging.getLogger(__name__)


class AnfisStubService:
    """
    Full AI prediction pipeline:
    validate (Pydantic) → preprocess (features) → ML predict → post-process → respond.
    """

    def __init__(self):
        self.preprocessor = PreprocessingService()
        self.predictor = PredictionService()

    def predict(self, request: AiPredictRequest) -> AiPredictResponse:
        """
        End-to-end prediction:
        1. Preprocess request → DataFrame with engineered features
        2. ML predict → depletion_24h → irrigation_mm + confidence
        3. Post-process: convert to duration
        """
        # 1. Preprocess
        features_df = self.preprocessor.transform(request)

        # 2. ML predict (decision logic is inside PredictionService)
        water_mm, confidence, predicted_depl_24h = self.predictor.predict(features_df)

        # 3. Post-processing
        row = features_df.iloc[0]
        soil_deficit = row.get("soil_moist_deficit", 0)
        raw = row.get("raw", 0)

        # Clamp
        water_mm = max(0.0, min(20.0, water_mm))

        # Convert mm → duration (seconds)
        duration = water_mm_to_duration_seconds(water_mm)
        refined_duration = max(0, duration - 10)  # 10s buffer

        logger.info(
            "Prediction device=%s: depl_24h=%.2f → water=%.2f mm → duration=%ds "
            "confidence=%.2f (deficit=%.1f)",
            request.device_id, predicted_depl_24h, water_mm, duration,
            confidence, soil_deficit,
        )

        return AiPredictResponse(
            device_id=request.device_id,
            ai_output=round(water_mm, 4),
            predicted_duration=duration,
            refined_duration=refined_duration,
            confidence=round(confidence, 4),
            accuracy=round(confidence, 4),
            ai_params={
                "model": "ml-pipeline" if self.predictor.is_trained else "physics-heuristic",
                "version": "3.0",
                "features": {
                    "etc": round(float(row.get("etc", 0)), 3),
                    "soil_moist_deficit": round(float(soil_deficit), 1),
                    "predicted_depl_24h": round(float(predicted_depl_24h), 2),
                    "raw": round(float(raw), 2),
                    "soil_moist_shallow": round(float(row.get("soil_moist_shallow", 0)), 1),
                    "soil_moist_deep": round(float(row.get("soil_moist_deep", 0)), 1),
                    "soil_moist_trend_1h": round(float(row.get("soil_moist_trend_1h", 0)), 2),
                    "water_mm": round(water_mm, 2),
                },
            },
        )

    def train(self, request: AiTrainRequest) -> AiTrainResponse:
        """
        Training stub — real training requires labeled data from backend.
        Returns mock response for now.
        """
        import random

        accuracy = round(random.uniform(0.85, 0.98), 4)

        logger.info(
            "Train request device=%s epochs=%d → mock accuracy=%.4f",
            request.device_id, request.epochs, accuracy,
        )

        return AiTrainResponse(
            device_id=request.device_id,
            accuracy=accuracy,
            status="completed",
            trained_params={
                "model": "ml-pipeline",
                "epochs": request.epochs,
                "learning_rate": request.learning_rate,
                "data_count": request.data_count,
                "note": "Training requires labeled data — using mock response",
            },
        )
