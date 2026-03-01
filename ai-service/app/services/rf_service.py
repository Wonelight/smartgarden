"""
RandomForest Service — hybrid FAO-56 + RF prediction.

Architecture:
  1. FAO-56 forward simulation → fao_pred_24h (deterministic physics baseline)
  2. RF predicts residual = actual_depletion - fao_pred (data-driven correction)
  3. Final prediction = fao_pred_24h + rf_residual

This hybrid approach lets FAO-56 handle the physics (~80-90% of the signal)
while RF corrects for stochastic rain, sensor drift, and local effects.
Decision layer converts predicted depletion → irrigation recommendation.
"""

import logging
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import cross_val_score

from app.ml.pipeline_builder import (
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    build_pipeline,
    load_pipeline,
    load_latest_model,
    save_pipeline,
)

logger = logging.getLogger(__name__)

# Default flow rate: 2 L/min nozzle, 1m² area → ~2 mm/min → 0.033 mm/s
DEFAULT_FLOW_RATE_MM_PER_SEC = 0.033


class RfService:
    """RandomForest prediction & training service."""

    def __init__(self):
        self._pipeline = None
        self._model_type = None
        self._bias_correction = 0.0

        xgb = load_latest_model("xgb")
        if xgb is not None:
            self._pipeline = xgb
            self._model_type = "xgb"
            self._bias_correction = getattr(xgb, "bias_correction_", 0.0)
            logger.info("XGBoost pipeline loaded (bias_correction=%.6f)", self._bias_correction)
        else:
            rf = load_pipeline()
            if rf is not None:
                self._pipeline = rf
                self._model_type = "rf"
                logger.info("RF pipeline loaded successfully")
            else:
                logger.warning("No trained model found — will use stub predictions")

    @property
    def is_trained(self) -> bool:
        return self._pipeline is not None

    def predict(self, features_df: pd.DataFrame) -> Tuple[float, float, float]:
        """
        Hybrid prediction: FAO-56 baseline + RF residual correction.

        1. FAO-56 forward sim produces fao_pred_24h (deterministic physics).
        2. RF predicts the residual (what FAO-56 misses: stochastic rain,
           sensor drift, local micro-climate effects).
        3. Final = fao_pred_24h + rf_residual.

        Decision logic: compare predicted depletion with RAW. If depletion
        exceeds RAW, irrigate to bring back to safe level.

        Args:
            features_df: Single-row DataFrame from PreprocessingService
                         (includes fao_pred_24h as metadata column)

        Returns:
            (irrigation_mm, confidence, predicted_depletion_24h)
        """
        if not self.is_trained:
            return self._stub_predict(features_df)

        # Extract FAO-56 baseline (computed by preprocessing forward sim)
        fao_pred_24h = float(features_df.iloc[0].get("fao_pred_24h", 0.0))

        # ML predicts the residual correction term + bias calibration
        rf_residual = float(self._pipeline.predict(features_df)[0]) + self._bias_correction

        # Hybrid: physics + data-driven correction
        predicted_depl_24h = fao_pred_24h + rf_residual
        predicted_depl_24h = max(0.0, min(50.0, predicted_depl_24h))

        # ── Confidence estimation ──
        if self._model_type == "rf":
            rf_model = self._pipeline.named_steps["rf"]
            X_transformed = self._pipeline.named_steps["preprocessor"].transform(features_df)
            tree_predictions = np.array([
                tree.predict(X_transformed)[0]
                for tree in rf_model.estimators_
            ])
            std = float(tree_predictions.std())
            iqr = float(np.percentile(tree_predictions, 75) - np.percentile(tree_predictions, 25))
            confidence = max(0.0, min(1.0, 1.0 - std / (iqr + 1.0)))
        else:
            # XGBoost: confidence based on residual magnitude
            abs_res = abs(rf_residual)
            confidence = max(0.4, min(0.95, 0.95 - abs_res * 0.11))

        # ── Decision: depletion → irrigation ──
        raw = features_df.iloc[0].get("raw", 10.0)
        soil_deficit = features_df.iloc[0].get("soil_moist_deficit", 5.0)

        if predicted_depl_24h > raw:
            irrigation_mm = max(0.0, predicted_depl_24h - raw * 0.5)
        elif soil_deficit > 15:
            irrigation_mm = max(0.0, predicted_depl_24h * 0.3)
        else:
            irrigation_mm = 0.0

        irrigation_mm = min(20.0, irrigation_mm)

        logger.info(
            "Hybrid predict [%s]: fao=%.2f + residual=%.2f → depl_24h=%.2f mm "
            "→ irrigation=%.2f mm (RAW=%.2f confidence=%.2f)",
            self._model_type or "stub", fao_pred_24h, rf_residual,
            predicted_depl_24h, irrigation_mm, raw, confidence,
        )
        return irrigation_mm, confidence, predicted_depl_24h

    def train(
        self,
        X: pd.DataFrame,
        y: pd.Series,
        n_estimators: int = 200,
        max_depth: int = 15,
    ) -> Dict[str, Any]:
        """
        Train RF pipeline on provided data.

        Args:
            X: Feature DataFrame (multiple rows)
            y: Target Series (depletion_after_24h in mm)
            n_estimators: Number of trees
            max_depth: Max tree depth

        Returns:
            Training metrics dict
        """
        pipeline = build_pipeline(
            n_estimators=n_estimators,
            max_depth=max_depth,
        )

        # Cross-validation
        cv_scores = cross_val_score(pipeline, X, y, cv=min(5, len(X)), scoring="r2")

        # Fit on full data
        pipeline.fit(X, y)

        # Metrics on training data
        y_pred = pipeline.predict(X)
        r2 = r2_score(y, y_pred)
        mae = mean_absolute_error(y, y_pred)

        # Save
        path = save_pipeline(pipeline)
        self._pipeline = pipeline

        metrics = {
            "r2": round(float(r2), 4),
            "mae": round(float(mae), 4),
            "cv_r2_mean": round(float(cv_scores.mean()), 4),
            "cv_r2_std": round(float(cv_scores.std()), 4),
            "n_samples": len(X),
            "n_features": X.shape[1],
            "model_path": path,
        }

        logger.info("RF training complete: %s", metrics)
        return metrics

    def reload(self):
        """Reload pipeline from disk (after external training)."""
        xgb = load_latest_model("xgb")
        if xgb is not None:
            self._pipeline = xgb
            self._model_type = "xgb"
            self._bias_correction = getattr(xgb, "bias_correction_", 0.0)
            logger.info("Reloaded: XGBoost pipeline (bias_correction=%.6f)", self._bias_correction)
        else:
            self._pipeline = load_pipeline()
            self._model_type = "rf" if self._pipeline else None
            self._bias_correction = 0.0
            logger.info("Reloaded: %s", "RF pipeline" if self._pipeline else "no model")

    # ── Stub fallback ──────────────────────────────

    @staticmethod
    def _stub_predict(features_df: pd.DataFrame) -> Tuple[float, float, float]:
        """
        Stub prediction when no trained model exists.
        Uses multi-layer heuristic based on soil_moist_deficit, soil moisture, and trend.
        Returns: (irrigation_mm, confidence, estimated_depletion)
        """
        row = features_df.iloc[0]
        soil_deficit = row.get("soil_moist_deficit", 5.0)
        soil_shallow = row.get("soil_moist_shallow", 50.0)
        soil_deep = row.get("soil_moist_deep", 50.0)
        soil_trend = row.get("soil_moist_trend_1h", 0.0)
        etc = row.get("etc", 4.0)
        raw = row.get("raw", 10.0)

        # Estimate depletion 24h from now (rough)
        est_depl = etc * 24 * (soil_deficit / (raw + 1e-6))

        # Multi-layer heuristic based on soil deficit
        if soil_deficit > 20:
            water_mm = etc * 1.5  # heavy — root zone severely depleted
        elif soil_deficit > 10:
            water_mm = etc * 1.0
        elif soil_deep < 25:
            water_mm = etc * 1.2
        elif (soil_shallow + soil_deep) / 2 < 30:
            water_mm = etc * 0.8
        elif (soil_shallow - soil_deep) > 20 and soil_trend < -2:
            water_mm = etc * 0.5
        else:
            water_mm = 0.0

        water_mm = max(0.0, min(20.0, water_mm))
        confidence = 0.4  # low confidence for stub

        logger.info(
            "Stub predict: water=%.2f mm (deficit=%.1f sm_sh=%.1f "
            "sm_dp=%.1f trend=%.2f est_depl=%.2f)",
            water_mm, soil_deficit, soil_shallow, soil_deep, soil_trend, est_depl,
        )
        return water_mm, confidence, est_depl


def water_mm_to_duration_seconds(water_mm: float, flow_rate: float = DEFAULT_FLOW_RATE_MM_PER_SEC) -> int:
    """Convert water amount (mm) to irrigation duration (seconds)."""
    if water_mm <= 0 or flow_rate <= 0:
        return 0
    return int(water_mm / flow_rate)

