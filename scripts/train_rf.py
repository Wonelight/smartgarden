#!/usr/bin/env python3
"""
Train Random Forest — Hybrid FAO-56 + RF approach.

Architecture:
  - FAO-56 forward simulation → fao_pred_24h (deterministic physics baseline)
  - RF target = residual_target = actual_depletion_24h - fao_pred_24h
  - At inference: final_prediction = fao_pred_24h + RF(residual)

Dataset: CSV từ generate_dataset.py với columns:
  - Features (khớp pipeline_builder.NUMERIC_FEATURES + CATEGORICAL_FEATURES)
  - fao_pred_24h: FAO-56 deterministic prediction
  - depletion_after_24h: actual depletion (ground truth)
  - residual_target: depletion_after_24h - fao_pred_24h (RF target)

Settings:
  - TimeSeriesSplit (không random) để tránh data leakage.
  - Hold-out test set 20% cuối (theo thời gian).
  - Hyperparameter tuning bằng RandomizedSearchCV.
"""

import argparse
import logging
import math
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit, RandomizedSearchCV, cross_val_score

# Thêm ai-service vào path để import app
_REPO_ROOT = Path(__file__).resolve().parent.parent
_AI_SERVICE = _REPO_ROOT / "ai-service"
sys.path.insert(0, str(_AI_SERVICE))

from app.ml.pipeline_builder import (
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    CATEGORICAL_ORDINAL_FEATURES,
    CATEGORICAL_NOMINAL_FEATURES,
    GROWTH_STAGE_ORDER,
    MODEL_DIR,
)
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, OneHotEncoder

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Target options ────────────────────────────────────────
TARGET_CHOICES = ["residual_target", "depletion_after_24h", "actual_irrigation_mm_next_24h"]
DEFAULT_TARGET = "residual_target"

# ── Feature list (same order as pipeline) ─────────────────
ALL_FEATURE_NAMES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Số mẫu tối thiểu khuyến nghị
MIN_SAMPLES_RECOMMENDED = 800

# Test set ratio (20% cuối theo thời gian)
TEST_RATIO = 0.20


def _compute_derived_features(df: pd.DataFrame, time_column: str | None) -> pd.DataFrame:
    """
    Tính các features dẫn xuất nếu CSV chưa có:
    - soil_moist_trend_1h: chênh lệch soil_moist_avg so với dòng trước
    - hour_sin, hour_cos, month_sin, month_cos: cyclic encoding từ timestamp
    - soil_moist_ratio: clamp vào [0.1, 10]
    """
    df = df.copy()

    # ── soil_moist_trend_1h ──
    if "soil_moist_trend_1h" not in df.columns or df["soil_moist_trend_1h"].isna().all():
        if "soil_moist_avg" in df.columns:
            df["soil_moist_trend_1h"] = df["soil_moist_avg"].diff().fillna(0.0)
            logger.info("Computed soil_moist_trend_1h from soil_moist_avg.diff()")
        else:
            df["soil_moist_trend_1h"] = 0.0
            logger.warning("Cannot compute soil_moist_trend_1h — soil_moist_avg missing")

    # ── Cyclic time features ──
    if time_column and time_column in df.columns:
        try:
            ts = pd.to_datetime(df[time_column])
            hours = ts.dt.hour + ts.dt.minute / 60.0
            months = ts.dt.month
            df["hour_sin"] = np.sin(2 * np.pi * hours / 24)
            df["hour_cos"] = np.cos(2 * np.pi * hours / 24)
            df["month_sin"] = np.sin(2 * np.pi * months / 12)
            df["month_cos"] = np.cos(2 * np.pi * months / 12)
            logger.info("Computed cyclic time features from '%s'", time_column)
        except Exception as e:
            logger.warning("Failed to compute time features from '%s': %s", time_column, e)
            for col in ["hour_sin", "hour_cos", "month_sin", "month_cos"]:
                if col not in df.columns:
                    df[col] = 0.0
    else:
        for col in ["hour_sin", "hour_cos", "month_sin", "month_cos"]:
            if col not in df.columns:
                df[col] = 0.0
        logger.warning("No time column — setting cyclic features to 0")

    # ── Clamp soil_moist_ratio ──
    if "soil_moist_ratio" in df.columns:
        df["soil_moist_ratio"] = df["soil_moist_ratio"].clip(0.1, 10.0)

    return df


def create_request_from_row(
    row: pd.Series,
    feature_columns: list[str],
    target_column: str,
) -> tuple[pd.Series, float]:
    """
    Từ một dòng CSV (row), tách ra feature vector X và giá trị target y.

    Dùng khi CSV có đúng tên cột trùng với feature names + 1 cột target.
    Row có thể có thêm cột (ví dụ timestamp) — chỉ lấy feature_columns và target_column.

    Args:
        row: Một dòng DataFrame (Series) hoặc dict-like.
        feature_columns: Danh sách tên cột feature (phải có trong row).
        target_column: Tên cột target.

    Returns:
        (X_row: pd.Series chỉ chứa feature values, y: float)
    """
    row = pd.Series(row) if not isinstance(row, pd.Series) else row
    missing = [c for c in feature_columns if c not in row.index]
    if missing:
        raise ValueError(f"Row missing feature columns: {missing}")
    if target_column not in row.index:
        raise ValueError(f"Row missing target column: {target_column}")

    X_row = row[feature_columns].copy()
    y = float(row[target_column])
    return X_row, y


def load_and_prepare_data(
    csv_path: str | Path,
    target_column: str = DEFAULT_TARGET,
    time_column: str | None = "timestamp",
) -> tuple[pd.DataFrame, pd.Series, list[str]]:
    """
    Đọc CSV, sắp xếp theo thời gian (nếu có), chuẩn bị X, y.

    - Nếu có time_column: sắp xếp tăng dần (cũ → mới).
    - Tự tính derived features nếu thiếu (soil_moist_trend_1h, cyclic time).
    - Chỉ giữ các dòng có đủ feature columns và target không null.
    """
    csv_path = Path(csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    # Chuẩn hóa tên cột (strip, snake_case nếu cần)
    df.columns = [str(c).strip() for c in df.columns]

    # Kiểm tra target
    if target_column not in df.columns:
        raise ValueError(
            f"Target column '{target_column}' not in CSV. "
            f"Available: {list(df.columns)}. Use one of {TARGET_CHOICES}."
        )

    # Sắp xếp theo thời gian
    if time_column and time_column in df.columns:
        try:
            df[time_column] = pd.to_datetime(df[time_column])
            df = df.sort_values(time_column).reset_index(drop=True)
            logger.info("Sorted by time column '%s'", time_column)
        except Exception as e:
            logger.warning("Could not sort by '%s': %s. Proceeding without sort.", time_column, e)

    # Loại bỏ dòng thiếu target
    df = df.dropna(subset=[target_column])

    # Tính derived features nếu CSV thiếu
    df = _compute_derived_features(df, time_column)

    # Chọn feature columns có trong CSV (chỉ dùng những gì có)
    available_features = [f for f in ALL_FEATURE_NAMES if f in df.columns]
    missing_features = [f for f in ALL_FEATURE_NAMES if f not in df.columns]
    if missing_features:
        logger.warning(
            "CSV missing %d feature columns (will be imputed by pipeline): %s",
            len(missing_features),
            missing_features[:10],
        )
    if len(available_features) < len(ALL_FEATURE_NAMES) * 0.5:
        raise ValueError(
            f"Too many missing features: only {len(available_features)}/{len(ALL_FEATURE_NAMES)} found."
        )

    # Đảm bảo mọi cột feature có mặt (thiếu thì NaN)
    for f in ALL_FEATURE_NAMES:
        if f not in df.columns:
            df[f] = np.nan

    # Build X, y bằng create_request_from_row từng dòng
    X_list = []
    y_list = []
    for idx, row in df.iterrows():
        try:
            x_row, y_val = create_request_from_row(row, ALL_FEATURE_NAMES, target_column)
            X_list.append(x_row)
            y_list.append(y_val)
        except (ValueError, KeyError) as e:
            logger.debug("Skip row %s: %s", idx, e)
            continue
    X = pd.DataFrame(X_list)
    y = pd.Series(y_list)

    if len(X) == 0:
        raise ValueError("No rows left after applying create_request_from_row (check target and feature columns).")

    n = len(X)
    if n < MIN_SAMPLES_RECOMMENDED:
        logger.warning(
            "Số lượng mẫu=%d < khuyến nghị %d. Nên thu thập ít nhất 10–14 ngày chạy thực tế.",
            n,
            MIN_SAMPLES_RECOMMENDED,
        )
    else:
        logger.info("Số lượng mẫu: %d (>= %d khuyến nghị)", n, MIN_SAMPLES_RECOMMENDED)

    return X, y, ALL_FEATURE_NAMES


def get_preprocessor():
    """Tạo preprocessor giống pipeline_builder (để dùng trong Pipeline với RandomizedSearchCV)."""
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
        transformers.append((
            "cat_nominal",
            OneHotEncoder(
                handle_unknown="ignore",
                sparse_output=False,
            ),
            CATEGORICAL_NOMINAL_FEATURES,
        ))
    return ColumnTransformer(transformers=transformers, remainder="drop")


def train_with_timeseries_cv(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    n_splits: int = 5,
    n_iter: int = 20,
    random_state: int = 42,
    n_jobs: int = -1,
) -> tuple[Pipeline, dict]:
    """
    Train RF với TimeSeriesSplit 5-fold, RandomizedSearchCV trên train set,
    rồi đánh giá trên hold-out test set.

    Returns:
        (best_pipeline, metrics_dict)
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)
    pipeline = Pipeline([
        ("preprocessor", get_preprocessor()),
        (
            "rf",
            RandomForestRegressor(random_state=random_state, n_jobs=n_jobs),
        ),
    ])

    param_dist = {
        "rf__n_estimators": [200, 300, 400, 500],
        "rf__max_depth": [6, 8, 10, 12],
        "rf__min_samples_leaf": [5, 8, 12, 16],
        "rf__min_samples_split": [10, 15, 20, 25],
        "rf__max_features": [0.6, 0.7, 0.8, 0.9],
    }

    search = RandomizedSearchCV(
        pipeline,
        param_distributions=param_dist,
        n_iter=n_iter,
        cv=tscv,
        scoring="neg_mean_squared_error",
        random_state=random_state,
        n_jobs=n_jobs,
        verbose=1,
    )
    search.fit(X_train, y_train)
    best = search.best_estimator_

    # ── Train metrics (trên train set — biased, chỉ để tham khảo) ──
    y_train_pred = best.predict(X_train)
    train_r2 = r2_score(y_train, y_train_pred)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))

    # ── Test metrics (trên hold-out — unbiased) ──
    y_test_pred = best.predict(X_test)
    test_r2 = r2_score(y_test, y_test_pred)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))

    # ── CV scores từ RandomizedSearchCV (không cần chạy lại) ──
    best_cv_mse = -search.best_score_  # neg_mean_squared_error → MSE
    cv_r2_approx = 1.0 - best_cv_mse / max(y_train.var(), 1e-6)

    # ── CV fold-level R² scores để đánh giá stability ──
    cv_r2_scores = cross_val_score(best, X_train, y_train, cv=tscv, scoring="r2", n_jobs=n_jobs)
    cv_r2_mean = float(cv_r2_scores.mean())
    cv_r2_std = float(cv_r2_scores.std())

    # ── Residual analysis ──
    train_residuals = y_train.values - y_train_pred
    test_residuals = y_test.values - y_test_pred

    train_res_mean = float(np.mean(train_residuals))
    train_res_std = float(np.std(train_residuals))
    test_res_mean = float(np.mean(test_residuals))
    test_res_std = float(np.std(test_residuals))
    test_res_skewness = float(scipy_stats.skew(test_residuals))

    # ── Target distribution statistics ──
    y_train_mean = float(y_train.mean())
    y_train_std = float(y_train.std())
    y_test_mean = float(y_test.mean())
    y_test_std = float(y_test.std())

    # ── MAPE (tránh chia cho 0) ──
    nonzero_train = np.abs(y_train.values) > 1e-6
    mape_train = float(np.mean(np.abs(train_residuals[nonzero_train] / y_train.values[nonzero_train])) * 100) if nonzero_train.any() else None
    nonzero_test = np.abs(y_test.values) > 1e-6
    mape_test = float(np.mean(np.abs(test_residuals[nonzero_test] / y_test.values[nonzero_test])) * 100) if nonzero_test.any() else None

    # ── Prediction percentiles (test set) ──
    test_pred_percentiles = {
        "p5": round(float(np.percentile(y_test_pred, 5)), 4),
        "p25": round(float(np.percentile(y_test_pred, 25)), 4),
        "p50": round(float(np.percentile(y_test_pred, 50)), 4),
        "p75": round(float(np.percentile(y_test_pred, 75)), 4),
        "p95": round(float(np.percentile(y_test_pred, 95)), 4),
    }

    # ── Overfitting detection ──
    r2_gap = train_r2 - test_r2
    rmse_ratio = test_rmse / max(train_rmse, 1e-9)

    if train_r2 >= 0.9 and r2_gap > 0.20:
        overfit_verdict = "OVERFIT — train R² cao nhưng gap train/test > 0.20"
    elif r2_gap > 0.10:
        overfit_verdict = "WARNING — gap train/test R² = {:.3f}, nên kiểm tra".format(r2_gap)
    else:
        overfit_verdict = "OK — gap train/test R² = {:.3f}, không có dấu hiệu overfit rõ".format(r2_gap)

    # ── Usability verdict ──
    if test_r2 >= 0.80 and r2_gap <= 0.15:
        usability = "GOOD — mô hình sẵn sàng sử dụng"
    elif test_r2 >= 0.60:
        usability = "ACCEPTABLE — có thể dùng, nên cải thiện thêm"
    elif test_r2 >= 0.40:
        usability = "POOR — cần cải thiện (thêm data, feature engineering)"
    else:
        usability = "NOT USABLE — R² quá thấp, cần xem lại pipeline và data"

    # ── Feature importance ──
    rf = best.named_steps["rf"]
    preprocessor = best.named_steps["preprocessor"]
    num_names = list(NUMERIC_FEATURES)
    cat_ord_names = list(CATEGORICAL_ORDINAL_FEATURES)
    if CATEGORICAL_NOMINAL_FEATURES and "cat_nominal" in preprocessor.named_transformers_:
        ohe = preprocessor.named_transformers_["cat_nominal"]
        cat_nom_names = list(ohe.get_feature_names_out(CATEGORICAL_NOMINAL_FEATURES))
    else:
        cat_nom_names = []
    all_out_names = num_names + cat_ord_names + cat_nom_names
    importances = rf.feature_importances_
    importance_list = [
        (name, round(float(imp), 6))
        for name, imp in sorted(
            zip(all_out_names, importances),
            key=lambda x: -x[1],
        )
    ]

    metrics = {
        # ── Target distribution ──
        "y_train_mean": round(y_train_mean, 4),
        "y_train_std": round(y_train_std, 4),
        "y_test_mean": round(y_test_mean, 4),
        "y_test_std": round(y_test_std, 4),
        # ── Train metrics (biased — for reference only) ──
        "train_r2": round(train_r2, 4),
        "train_mae": round(train_mae, 4),
        "train_rmse": round(train_rmse, 4),
        "train_mape_pct": round(mape_train, 2) if mape_train is not None else None,
        # ── Test metrics (unbiased ★ — primary evaluation) ──
        "test_r2": round(test_r2, 4),
        "test_mae": round(test_mae, 4),
        "test_rmse": round(test_rmse, 4),
        "test_mape_pct": round(mape_test, 2) if mape_test is not None else None,
        # ── Residual analysis ──
        "train_residual_mean": round(train_res_mean, 4),
        "train_residual_std": round(train_res_std, 4),
        "test_residual_mean": round(test_res_mean, 4),
        "test_residual_std": round(test_res_std, 4),
        "test_residual_skewness": round(test_res_skewness, 4),
        # ── Prediction percentiles (test set) ──
        "test_pred_percentiles": test_pred_percentiles,
        # ── Overfitting ──
        "r2_gap_train_minus_test": round(r2_gap, 4),
        "rmse_ratio_test_over_train": round(rmse_ratio, 4),
        "overfit_verdict": overfit_verdict,
        # ── CV info (fold-level stability) ──
        "cv_best_neg_mse": round(float(search.best_score_), 4),
        "cv_r2_approx": round(cv_r2_approx, 4),
        "cv_r2_fold_scores": [round(s, 4) for s in cv_r2_scores.tolist()],
        "cv_r2_mean": round(cv_r2_mean, 4),
        "cv_r2_std": round(cv_r2_std, 4),
        # ── Usability verdict ──
        "usability_verdict": usability,
        # ── Counts ──
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": len(all_out_names),
        "best_params": search.best_params_,
        "feature_importance": importance_list,
    }
    return best, metrics


def save_versioned_model(pipeline: Pipeline, save_dir: Path | None = None) -> Path:
    """Lưu model với tên rf_vYYYYMMDD_HHMM.joblib."""
    save_dir = save_dir or MODEL_DIR
    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)
    version = datetime.now().strftime("%Y%m%d_%H%M")
    name = f"rf_v{version}.joblib"
    path = save_dir / name
    joblib.dump(pipeline, path)
    logger.info("Model saved: %s", path)
    return path


def main():
    parser = argparse.ArgumentParser(
        description="Train Random Forest cho irrigation prediction (time-series safe).",
    )
    parser.add_argument(
        "csv_path",
        type=str,
        help="Đường dẫn file CSV (có cột features + target).",
    )
    parser.add_argument(
        "--target",
        type=str,
        default=DEFAULT_TARGET,
        choices=TARGET_CHOICES,
        help="Cột target: depletion_after_24h (default) hoặc actual_irrigation_mm_next_24h.",
    )
    parser.add_argument(
        "--time-col",
        type=str,
        default="timestamp",
        help="Cột thời gian để sắp xếp (dùng Time-series split). Đặt '' để tắt.",
    )
    parser.add_argument(
        "--n-splits",
        type=int,
        default=5,
        help="Số fold TimeSeriesSplit (mặc định 5).",
    )
    parser.add_argument(
        "--n-iter",
        type=int,
        default=20,
        help="Số lần thử trong RandomizedSearchCV.",
    )
    parser.add_argument(
        "--out-dir",
        type=str,
        default=None,
        help="Thư mục lưu model (mặc định: ai-service/app/ml/models).",
    )
    parser.add_argument(
        "--test-ratio",
        type=float,
        default=TEST_RATIO,
        help="Tỉ lệ hold-out test set (mặc định 0.20 = 20%% cuối).",
    )
    parser.add_argument(
        "--min-importance",
        type=float,
        default=None,
        help="Sau train, in ra và gợi ý loại feature có importance < ngưỡng (optional).",
    )
    parser.add_argument(
        "--n-jobs",
        type=int,
        default=-1,
        help="Số process cho CV/RF (-1 = tất cả CPU; 1 = tránh lỗi multiprocessing trên một số môi trường).",
    )
    args = parser.parse_args()

    time_col = args.time_col or None
    if args.time_col == "":
        time_col = None

    # 1) Load data
    X, y, used_features = load_and_prepare_data(
        args.csv_path,
        target_column=args.target,
        time_column=time_col,
    )

    # 1b) Load metadata for hybrid evaluation (FAO-56 + RF)
    hybrid_meta = None
    if args.target == "residual_target":
        df_raw = pd.read_csv(args.csv_path)
        if time_col and time_col in df_raw.columns:
            df_raw[time_col] = pd.to_datetime(df_raw[time_col])
            df_raw = df_raw.sort_values(time_col).reset_index(drop=True)
        df_raw = df_raw.dropna(subset=[args.target]).reset_index(drop=True)
        if "fao_pred_24h" in df_raw.columns and "depletion_after_24h" in df_raw.columns:
            hybrid_meta = {
                "fao_pred_24h": df_raw["fao_pred_24h"].values,
                "actual_depl": df_raw["depletion_after_24h"].values,
            }
            if len(hybrid_meta["fao_pred_24h"]) != len(X):
                logger.warning(
                    "Metadata length mismatch (%d vs %d), disabling hybrid eval",
                    len(hybrid_meta["fao_pred_24h"]), len(X),
                )
                hybrid_meta = None
            else:
                logger.info("Hybrid metadata loaded: fao_pred_24h + depletion_after_24h")

    # 2) Hold-out split: 20% cuối làm test (theo thời gian, không shuffle)
    n = len(X)
    split_idx = int(n * (1 - args.test_ratio))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    logger.info(
        "Train/Test split: %d train + %d test (ratio=%.0f%%)",
        len(X_train), len(X_test), args.test_ratio * 100,
    )

    # 3) Train với TimeSeriesSplit + RandomizedSearchCV (trên train set)
    logger.info("Training with TimeSeriesSplit(n_splits=%d), RandomizedSearchCV(n_iter=%d)", args.n_splits, args.n_iter)
    pipeline, metrics = train_with_timeseries_cv(
        X_train, y_train, X_test, y_test,
        n_splits=args.n_splits,
        n_iter=args.n_iter,
        n_jobs=args.n_jobs,
    )

    # 4) Log metrics đầy đủ
    logger.info("========== TARGET DISTRIBUTION ==========")
    logger.info("Train  → mean=%.4f, std=%.4f", metrics["y_train_mean"], metrics["y_train_std"])
    logger.info("Test   → mean=%.4f, std=%.4f", metrics["y_test_mean"], metrics["y_test_std"])
    logger.info("========== TRAIN METRICS (biased — tham khảo) ==========")
    logger.info("R²     = %s", metrics["train_r2"])
    logger.info("MAE    = %s", metrics["train_mae"])
    logger.info("RMSE   = %s", metrics["train_rmse"])
    logger.info("MAPE   = %s%%", metrics["train_mape_pct"])
    logger.info("Residuals: mean=%.4f  std=%.4f", metrics["train_residual_mean"], metrics["train_residual_std"])
    logger.info("========== TEST METRICS (unbiased ★ — primary) ==========")
    logger.info("R²     = %s", metrics["test_r2"])
    logger.info("MAE    = %s", metrics["test_mae"])
    logger.info("RMSE   = %s", metrics["test_rmse"])
    logger.info("MAPE   = %s%%", metrics["test_mape_pct"])
    logger.info("Residuals: mean=%.4f  std=%.4f  skewness=%.4f",
                metrics["test_residual_mean"], metrics["test_residual_std"], metrics["test_residual_skewness"])
    logger.info("Prediction percentiles (test): %s", metrics["test_pred_percentiles"])
    logger.info("========== OVERFITTING CHECK ==========")
    logger.info("R² gap (train - test) = %s", metrics["r2_gap_train_minus_test"])
    logger.info("RMSE ratio (test/train) = %s", metrics["rmse_ratio_test_over_train"])
    logger.info("Verdict: %s", metrics["overfit_verdict"])
    logger.info("========== CV STABILITY ==========")
    logger.info("Best CV neg_MSE     = %s", metrics["cv_best_neg_mse"])
    logger.info("CV R² (approx)      = %s", metrics["cv_r2_approx"])
    logger.info("CV R² per fold      = %s", metrics["cv_r2_fold_scores"])
    logger.info("CV R² mean ± std    = %.4f ± %.4f", metrics["cv_r2_mean"], metrics["cv_r2_std"])
    logger.info("n_train=%s, n_test=%s, n_features=%s", metrics["n_train"], metrics["n_test"], metrics["n_features"])
    logger.info("Best params: %s", metrics["best_params"])
    logger.info("========== USABILITY VERDICT ==========")
    logger.info(">>> %s", metrics["usability_verdict"])
    logger.info("========== FEATURE IMPORTANCE (top 15) ==========")
    for name, imp in metrics["feature_importance"][:15]:
        logger.info("  %s: %s", name, imp)

    # Gợi ý loại bớt feature kém
    if args.min_importance is not None:
        low = [(n, i) for n, i in metrics["feature_importance"] if i < args.min_importance]
        if low:
            logger.info("Features with importance < %s (có thể loại bớt): %s", args.min_importance, [x[0] for x in low])

    # 4b) Hybrid evaluation: FAO-56 + RF → actual depletion
    hybrid_metrics = None
    if hybrid_meta is not None:
        fao_test = hybrid_meta["fao_pred_24h"][split_idx:]
        actual_test = hybrid_meta["actual_depl"][split_idx:]
        fao_train = hybrid_meta["fao_pred_24h"][:split_idx]
        actual_train = hybrid_meta["actual_depl"][:split_idx]

        rf_pred_test = pipeline.predict(X_test)
        hybrid_pred = np.clip(fao_test + rf_pred_test, 0, 50)

        # FAO-56 only (baseline to compare against)
        fao_only_r2 = r2_score(actual_test, fao_test)
        fao_only_mae = mean_absolute_error(actual_test, fao_test)
        fao_only_rmse = np.sqrt(mean_squared_error(actual_test, fao_test))

        # Hybrid = FAO + RF residual
        h_r2 = r2_score(actual_test, hybrid_pred)
        h_mae = mean_absolute_error(actual_test, hybrid_pred)
        h_rmse = np.sqrt(mean_squared_error(actual_test, hybrid_pred))

        nonzero_mask = np.abs(actual_test) > 1e-6
        h_mape = float(np.mean(
            np.abs((actual_test[nonzero_mask] - hybrid_pred[nonzero_mask])
                   / actual_test[nonzero_mask])
        ) * 100) if nonzero_mask.any() else None

        hybrid_metrics = {
            "fao_only_r2": round(fao_only_r2, 4),
            "fao_only_mae": round(fao_only_mae, 4),
            "fao_only_rmse": round(fao_only_rmse, 4),
            "hybrid_r2": round(h_r2, 4),
            "hybrid_mae": round(h_mae, 4),
            "hybrid_rmse": round(h_rmse, 4),
            "hybrid_mape_pct": round(h_mape, 2) if h_mape is not None else None,
        }

        logger.info("========== HYBRID EVALUATION (FAO-56 + RF) ==========")
        logger.info("  Target: depletion_after_24h (actual)")
        logger.info("  FAO-56 only  → R²=%.4f  MAE=%.4f  RMSE=%.4f",
                     fao_only_r2, fao_only_mae, fao_only_rmse)
        logger.info("  FAO-56 + RF  → R²=%.4f  MAE=%.4f  RMSE=%.4f  MAPE=%.2f%%",
                     h_r2, h_mae, h_rmse, h_mape if h_mape else 0)
        logger.info("  Improvement  → ΔR²=+%.4f  ΔMAE=%.4f  ΔRMSE=%.4f",
                     h_r2 - fao_only_r2, fao_only_mae - h_mae, fao_only_rmse - h_rmse)

    # 5) Versioning: lưu model (final fit trên toàn bộ data = train + test)
    logger.info("Re-fitting on full dataset (%d samples) for final model...", n)
    pipeline.fit(X, y)

    out_dir = Path(args.out_dir) if args.out_dir else MODEL_DIR
    model_path = save_versioned_model(pipeline, save_dir=out_dir)

    # 6) Ghi metrics ra file
    metrics_path = out_dir / f"metrics_{model_path.stem}.txt"
    with open(metrics_path, "w", encoding="utf-8") as f:
        f.write(f"Model: {model_path.name}\n")
        f.write(f"Target: {args.target}\n")
        f.write(f"n_train={metrics['n_train']}, n_test={metrics['n_test']}, n_features={metrics['n_features']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[TARGET DISTRIBUTION]\n")
        f.write(f"  Train  → mean={metrics['y_train_mean']}, std={metrics['y_train_std']}\n")
        f.write(f"  Test   → mean={metrics['y_test_mean']}, std={metrics['y_test_std']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[TRAIN METRICS] (biased — tham khảo)\n")
        f.write(f"  R²   = {metrics['train_r2']}\n")
        f.write(f"  MAE  = {metrics['train_mae']}\n")
        f.write(f"  RMSE = {metrics['train_rmse']}\n")
        f.write(f"  MAPE = {metrics['train_mape_pct']}%\n")
        f.write(f"  Residual mean={metrics['train_residual_mean']}, std={metrics['train_residual_std']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[TEST METRICS ★] (unbiased — đánh giá chính)\n")
        f.write(f"  R²   = {metrics['test_r2']}\n")
        f.write(f"  MAE  = {metrics['test_mae']}\n")
        f.write(f"  RMSE = {metrics['test_rmse']}\n")
        f.write(f"  MAPE = {metrics['test_mape_pct']}%\n")
        f.write(f"  Residual mean={metrics['test_residual_mean']}, std={metrics['test_residual_std']}, skewness={metrics['test_residual_skewness']}\n")
        f.write(f"  Prediction percentiles: {metrics['test_pred_percentiles']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[OVERFITTING CHECK]\n")
        f.write(f"  R² gap (train - test)     = {metrics['r2_gap_train_minus_test']}\n")
        f.write(f"  RMSE ratio (test / train) = {metrics['rmse_ratio_test_over_train']}\n")
        f.write(f"  Verdict: {metrics['overfit_verdict']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[CV STABILITY]\n")
        f.write(f"  CV R² per fold   = {metrics['cv_r2_fold_scores']}\n")
        f.write(f"  CV R² mean ± std = {metrics['cv_r2_mean']} ± {metrics['cv_r2_std']}\n")
        f.write(f"  CV best neg_MSE  = {metrics['cv_best_neg_mse']}\n")
        f.write(f"  CV R² (approx)   = {metrics['cv_r2_approx']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write(f"[USABILITY VERDICT]\n")
        f.write(f"  >>> {metrics['usability_verdict']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write(f"[BEST HYPERPARAMETERS]\n  {metrics['best_params']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[FEATURE IMPORTANCE]\n")
        for name, imp in metrics["feature_importance"]:
            f.write(f"  {name}: {imp}\n")

        if hybrid_metrics is not None:
            f.write("\n──────────────────────────────────────────\n")
            f.write("[HYBRID EVALUATION — FAO-56 + RF → depletion_after_24h]\n")
            f.write(f"  FAO-56 only → R²={hybrid_metrics['fao_only_r2']}, "
                    f"MAE={hybrid_metrics['fao_only_mae']}, "
                    f"RMSE={hybrid_metrics['fao_only_rmse']}\n")
            f.write(f"  Hybrid      → R²={hybrid_metrics['hybrid_r2']}, "
                    f"MAE={hybrid_metrics['hybrid_mae']}, "
                    f"RMSE={hybrid_metrics['hybrid_rmse']}, "
                    f"MAPE={hybrid_metrics['hybrid_mape_pct']}%\n")
            delta_r2 = hybrid_metrics['hybrid_r2'] - hybrid_metrics['fao_only_r2']
            delta_mae = hybrid_metrics['fao_only_mae'] - hybrid_metrics['hybrid_mae']
            delta_rmse = hybrid_metrics['fao_only_rmse'] - hybrid_metrics['hybrid_rmse']
            f.write(f"  Improvement → ΔR²=+{round(delta_r2, 4)}, "
                    f"ΔMAE={round(delta_mae, 4)}, "
                    f"ΔRMSE={round(delta_rmse, 4)}\n")

    logger.info("Metrics written to %s", metrics_path)

    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)