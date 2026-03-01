"""
sklearn Pipeline Builder — defines the reusable ColumnTransformer + model pipeline.

Supports both Random Forest and XGBoost (Gradient Boosting) estimators.

Pipeline structure:
  ColumnTransformer
    ├── num: SimpleImputer(median) → 33 numeric features
    │        (atmospheric, soil, agro, water balance, interactions, time, lag 6/12/24h)
    └── cat_ordinal: OrdinalEncoder(ordered) → growth_stage
  Estimator (RF or XGBoost)

Feature selection v3 (based on feature importance analysis):
  - Removed month_cos (importance < 0.5%)
  - Removed soil_type (all 5 one-hot variants < 0.2%)
  - Removed crop_type (4/5 one-hot variants < 0.12%; info captured by kc, raw)
  - Added lag features: depletion_trend_6h, rain_last_6h, etc_rolling_6h
  - Removed is_cold_season, cold_x_stress, cold_x_etc (binary threshold fragile
    under climate change; XGBoost over-relies on single binary split 64.7%;
    seasonal info already captured by physical measurements + month_sin)

Save/load via joblib.
"""

import logging
from pathlib import Path
from typing import Optional

import joblib
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder

logger = logging.getLogger(__name__)

# ── Feature definitions (must match preprocessing_service.py) ──

NUMERIC_FEATURES = [
    # Atmospheric
    "temp", "humidity", "light",
    "wind_speed",
    "forecast_rain_d0", "forecast_rain_d1", "forecast_rain_d2",
    # Soil moisture (sensor-based)
    "soil_moist_shallow", "soil_moist_deep", "soil_moist_trend_1h",
    # Agro-physics
    "etc", "kc",
    # Water balance
    "raw",
    "soil_moist_deficit",
    # Forward-looking features (hybrid FAO-56 + ML)
    "etc_cumulative_24h",
    "net_water_loss_24h",
    "stress_ratio",
    # Interaction features
    "temp_x_humidity", "solar_x_temp",
    # Seasonal interaction features
    "season_x_stress", "season_x_rain", "season_x_etc",
    # Cyclic time features (month_cos removed — importance < 0.5%)
    "hour_sin", "hour_cos", "month_sin",
    # Lag features — multi-window short-term memory
    "depletion_trend_6h", "rain_last_6h", "etc_rolling_6h",
    "depletion_trend_12h", "rain_last_12h", "etc_rolling_12h",
    "depletion_trend_24h", "rain_last_24h",
    "light_rolling_24h", "wind_rolling_24h", "hours_since_last_rain",
]

# Ordinal: growth_stage has natural ordering
CATEGORICAL_ORDINAL_FEATURES = ["growth_stage"]

# Nominal: crop_type and soil_type removed — all one-hot variants had < 0.5%
# importance. Crop/soil info is already captured by kc, raw, soil_moist_deficit.
CATEGORICAL_NOMINAL_FEATURES = []

CATEGORICAL_FEATURES = CATEGORICAL_ORDINAL_FEATURES + CATEGORICAL_NOMINAL_FEATURES

# Growth stage ordering for OrdinalEncoder
GROWTH_STAGE_ORDER = ["initial", "development", "mid", "end"]

# Default model directory
MODEL_DIR = Path(__file__).parent / "models"


def _build_preprocessor() -> ColumnTransformer:
    """Build the shared ColumnTransformer preprocessor."""
    transformers = [
        (
            "num",
            SimpleImputer(strategy="median"),
            NUMERIC_FEATURES,
        ),
        (
            "cat_ordinal",
            OrdinalEncoder(
                categories=[GROWTH_STAGE_ORDER],
                handle_unknown="use_encoded_value",
                unknown_value=-1,
            ),
            CATEGORICAL_ORDINAL_FEATURES,
        ),
    ]
    if CATEGORICAL_NOMINAL_FEATURES:
        from sklearn.preprocessing import OneHotEncoder
        transformers.append((
            "cat_nominal",
            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            CATEGORICAL_NOMINAL_FEATURES,
        ))
    return ColumnTransformer(transformers=transformers, remainder="drop")


def build_pipeline(
    n_estimators: int = 200,
    max_depth: int = 15,
    random_state: int = 42,
) -> Pipeline:
    """
    Build a fresh sklearn Pipeline with RF estimator (untrained).

    Returns:
        Pipeline with ColumnTransformer preprocessor + RandomForestRegressor
    """
    return Pipeline([
        ("preprocessor", _build_preprocessor()),
        ("rf", RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1,
        )),
    ])


def build_xgb_pipeline(
    n_estimators: int = 300,
    max_depth: int = 6,
    learning_rate: float = 0.1,
    subsample: float = 0.8,
    colsample_bytree: float = 0.8,
    random_state: int = 42,
) -> Pipeline:
    """
    Build a fresh sklearn Pipeline with XGBoost estimator (untrained).

    XGBoost builds trees sequentially (gradient boosting) — each tree corrects
    the residuals of the ensemble so far. Better than RF for residual learning.
    """
    from xgboost import XGBRegressor
    return Pipeline([
        ("preprocessor", _build_preprocessor()),
        ("xgb", XGBRegressor(
            n_estimators=n_estimators,
            max_depth=max_depth,
            learning_rate=learning_rate,
            subsample=subsample,
            colsample_bytree=colsample_bytree,
            random_state=random_state,
            n_jobs=-1,
            tree_method="hist",
        )),
    ])


def save_pipeline(pipeline: Pipeline, name: str = "rf_irrigation_pipeline") -> str:
    """Save trained pipeline to disk with joblib."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = MODEL_DIR / f"{name}.joblib"
    joblib.dump(pipeline, path)
    logger.info("Pipeline saved to %s", path)
    return str(path)


def load_pipeline(name: str = "rf_irrigation_pipeline") -> Optional[Pipeline]:
    """Load trained pipeline from disk. Returns None if not found."""
    path = MODEL_DIR / f"{name}.joblib"
    if not path.exists():
        logger.warning("Pipeline not found at %s", path)
        return None
    pipeline = joblib.load(path)
    logger.info("Pipeline loaded from %s", path)
    return pipeline


def load_latest_model(prefix: str = "xgb") -> Optional[Pipeline]:
    """
    Load the most recent versioned model matching prefix.

    Scans MODEL_DIR for files like {prefix}_vYYYYMMDD_HHMM.joblib,
    sorted by version timestamp (newest first).
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    models = sorted(MODEL_DIR.glob(f"{prefix}_v*.joblib"), reverse=True)
    if not models:
        return None
    pipeline = joblib.load(models[0])
    logger.info("Loaded latest %s model: %s", prefix, models[0].name)
    return pipeline
