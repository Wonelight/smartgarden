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
    UpdatedWaterBalance,
)
from app.services.preprocessing_service import PreprocessingService
from app.services.prediction_service import PredictionService, water_mm_to_duration_seconds
from app.services.water_balance import water_balance_store
from app.services.fao_service import (
    FaoService,
    SHALLOW_LAYER_RATIO,
    DEEP_LAYER_RATIO,
    INFILTRATION_SHALLOW_RATIO,
)

logger = logging.getLogger(__name__)

_fao = FaoService()


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
        4. Build updated_water_balance for backend to persist
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

        # Convert mm → duration: dùng flow_rate từ pump config nếu có
        if request.pump is not None:
            flow_rate = request.pump.flow_rate_mm_per_sec()
        else:
            from app.services.prediction_service import DEFAULT_FLOW_RATE_MM_PER_SEC
            flow_rate = DEFAULT_FLOW_RATE_MM_PER_SEC
        duration = water_mm_to_duration_seconds(water_mm, flow_rate)
        refined_duration = max(0, duration - 10)  # 10s buffer

        logger.info(
            "Prediction device=%s: depl_24h=%.2f → water=%.2f mm → duration=%ds "
            "confidence=%.2f (deficit=%.1f)",
            request.device_id, predicted_depl_24h, water_mm, duration,
            confidence, soil_deficit,
        )

        # 4. Build updated_water_balance — backend persists this to DB
        updated_wb = self._build_updated_water_balance(request, row, water_mm)

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
            updated_water_balance=updated_wb,
        )

    # ── Helper: build updated_water_balance ────────────────────

    def _build_updated_water_balance(
        self,
        request: AiPredictRequest,
        row,
        water_mm: float,
    ) -> UpdatedWaterBalance:
        """
        Tính toán water balance state sau prediction để backend persist.
        Dùng lại snapshot từ request (nếu có) hoặc giá trị mặc định loam.
        Thêm water_mm vào last_irrigation để phản ánh lần tưới này.
        """
        c = request.crop
        wb_snap = request.water_balance

        # Lấy crop params (với fallback loam)
        fc = c.field_capacity if c and c.field_capacity is not None else 30.0
        wp = c.wilting_point if c and c.wilting_point is not None else 15.0
        root_depth = c.root_depth if c and c.root_depth is not None else 0.3
        depletion_frac = c.depletion_fraction if c and c.depletion_fraction is not None else 0.5

        # Tính TAW/RAW đa tầng từ crop + soil info
        (shallow_taw, deep_taw,
         shallow_raw, deep_raw, _, _) = _fao.calculate_multi_layer(
            fc, wp, root_depth, depletion_frac,
        )

        # Lấy depletion hiện tại (từ snapshot nếu có, hoặc ước tính từ soil_moist_deficit)
        if wb_snap is not None:
            shallow_depletion = wb_snap.shallow_depletion
            deep_depletion = wb_snap.deep_depletion
        else:
            soil_deficit = float(row.get("soil_moist_deficit", 0))
            shallow_depletion = max(0.0, soil_deficit * shallow_taw / max(fc, 1))
            deep_depletion = max(0.0, soil_deficit * deep_taw / max(fc, 1))

        # ETc giờ hiện tại đã tính trong preprocessing
        etc_h = float(row.get("etc", 0.0))

        # Infiltration ratio
        inf_shallow = INFILTRATION_SHALLOW_RATIO
        if c and c.infiltration_shallow_ratio is not None:
            inf_shallow = max(0.2, min(0.9, float(c.infiltration_shallow_ratio)))
        inf_deep = 1.0 - inf_shallow

        # Áp dụng nước tưới (water_mm) theo từng tầng
        irr_shallow = water_mm * inf_shallow
        irr_deep = water_mm * inf_deep

        # Cập nhật depletion sau ETc và tưới
        new_shallow = max(0.0, min(shallow_taw,
            shallow_depletion + etc_h * SHALLOW_LAYER_RATIO - irr_shallow))
        new_deep = max(0.0, min(deep_taw,
            deep_depletion + etc_h * DEEP_LAYER_RATIO - irr_deep))

        logger.debug(
            "UpdatedWB device=%s: sh_taw=%.2f dp_taw=%.2f "
            "sh_depl %.2f→%.2f dp_depl %.2f→%.2f irr_sh=%.2f irr_dp=%.2f",
            request.device_id, shallow_taw, deep_taw,
            shallow_depletion, new_shallow,
            deep_depletion, new_deep,
            irr_shallow, irr_deep,
        )

        return UpdatedWaterBalance(
            shallow_depletion=round(new_shallow, 4),
            deep_depletion=round(new_deep, 4),
            shallow_taw=round(shallow_taw, 4),
            deep_taw=round(deep_taw, 4),
            shallow_raw=round(shallow_raw, 4),
            deep_raw=round(deep_raw, 4),
            last_irrigation=round(water_mm, 4),
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
