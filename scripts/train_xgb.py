#!/usr/bin/env python3
"""
Train XGBoost (Gradient Boosting) — Hybrid FAO-56 + XGBoost approach.

Same hybrid architecture as train_rf.py but using XGBoost as the residual learner.
XGBoost builds trees sequentially, each correcting the previous ensemble's errors —
ideal for residual learning where per-mm accuracy matters.

Training pipeline:
  1. RandomizedSearchCV with TimeSeriesSplit finds best hyperparams
  2. Refit best params with early stopping on a validation split
  3. Final model refitted on all training data with optimal n_estimators
  4. Bias correction computed on test set and stored with model

Usage:
    python scripts/train_xgb.py data/rf_training_data.csv
    python scripts/train_xgb.py data/rf_training_data.csv --loss huber --n-iter 80
    python scripts/train_xgb.py data/rf_training_data.csv --target residual_target
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit, RandomizedSearchCV, cross_val_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    OrdinalEncoder,
    OneHotEncoder,
)
from xgboost import XGBRegressor

_REPO_ROOT = Path(__file__).resolve().parent.parent
_AI_SERVICE = _REPO_ROOT / "ai-service"
_SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_AI_SERVICE))
sys.path.insert(0, str(_SCRIPTS_DIR))

from app.ml.pipeline_builder import (
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    CATEGORICAL_ORDINAL_FEATURES,
    CATEGORICAL_NOMINAL_FEATURES,
    GROWTH_STAGE_ORDER,
    MODEL_DIR,
)
import joblib
from train_rf import load_and_prepare_data

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

TARGET_CHOICES = ["residual_target", "depletion_after_24h", "actual_irrigation_mm_next_24h"]
DEFAULT_TARGET = "residual_target"
ALL_FEATURE_NAMES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
TEST_RATIO = 0.20
EARLY_STOP_VAL_RATIO = 0.15


def get_preprocessor():
    """Build preprocessor matching pipeline_builder's structure."""
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
            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
            CATEGORICAL_NOMINAL_FEATURES,
        ))
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _compute_practical_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
) -> dict:
    """
    Practical evaluation metrics for irrigation residual prediction.

    Returns dict with:
      - mae_by_range: MAE for low/medium/high depletion ranges
      - within_1mm_pct: % predictions within ±1mm of actual
      - within_05mm_pct: % predictions within ±0.5mm of actual
      - directional_accuracy: % correct direction (positive/negative residual)
      - median_abs_error: median absolute error (robust to outliers)
    """
    abs_errors = np.abs(y_true - y_pred)

    within_1mm = float(np.mean(abs_errors <= 1.0) * 100)
    within_05mm = float(np.mean(abs_errors <= 0.5) * 100)
    median_ae = float(np.median(abs_errors))

    sign_true = np.sign(y_true)
    sign_pred = np.sign(y_pred)
    nonzero_mask = sign_true != 0
    if nonzero_mask.any():
        directional_acc = float(np.mean(sign_true[nonzero_mask] == sign_pred[nonzero_mask]) * 100)
    else:
        directional_acc = 0.0

    mae_by_range = {}
    abs_true = np.abs(y_true)
    for label, lo, hi in [("low(<0.3mm)", 0, 0.3), ("mid(0.3-1mm)", 0.3, 1.0), ("high(>1mm)", 1.0, float("inf"))]:
        mask = (abs_true >= lo) & (abs_true < hi)
        if mask.any():
            mae_by_range[label] = round(float(np.mean(abs_errors[mask])), 4)
        else:
            mae_by_range[label] = None

    return {
        "within_1mm_pct": round(within_1mm, 1),
        "within_05mm_pct": round(within_05mm, 1),
        "directional_accuracy_pct": round(directional_acc, 1),
        "median_abs_error": round(median_ae, 4),
        "mae_by_range": mae_by_range,
    }


def train_xgb_with_timeseries_cv(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    objective: str = "reg:squarederror",
    n_splits: int = 5,
    n_iter: int = 50,
    random_state: int = 42,
    n_jobs: int = -1,
) -> tuple:
    """
    Single-phase XGBoost training with early stopping:

      1. RandomizedSearchCV + TimeSeriesSplit finds best hyperparams
      2. Refit with early stopping on validation split → optimal n_estimators
      3. Final model refitted on ALL training data
      4. Bias correction computed on test set
    """
    tscv = TimeSeriesSplit(n_splits=n_splits)

    # ═════════════════════════════════════════════════════
    # STEP 1: Hyperparameter search
    # ═════════════════════════════════════════════════════
    search_pipeline = Pipeline([
        ("preprocessor", get_preprocessor()),
        ("xgb", XGBRegressor(
            objective=objective,
            random_state=random_state,
            n_jobs=n_jobs,
            tree_method="hist",
        )),
    ])

    param_dist = {
        "xgb__n_estimators": [500, 800, 1000],
        "xgb__max_depth": [3, 4, 5],
        "xgb__learning_rate": [0.01, 0.02, 0.03, 0.05],
        "xgb__subsample": [0.5, 0.6, 0.7, 0.8],
        "xgb__colsample_bytree": [0.5, 0.6, 0.7, 0.8, 0.9],
        "xgb__min_child_weight": [5, 7, 10, 15],
        "xgb__reg_alpha": [0.0, 0.01, 0.1, 0.5, 1.0],
        "xgb__reg_lambda": [1.0, 3.0, 5.0, 10.0],
        "xgb__gamma": [0.0, 0.5, 1.0, 2.0],
    }

    logger.info("Step 1: RandomizedSearchCV (%s, %d iter, %d folds)", objective, n_iter, n_splits)
    search = RandomizedSearchCV(
        search_pipeline,
        param_distributions=param_dist,
        n_iter=n_iter,
        cv=tscv,
        scoring="neg_mean_squared_error",
        random_state=random_state,
        n_jobs=n_jobs,
        verbose=1,
    )
    search.fit(X_train, y_train)

    best_params_raw = search.best_params_
    best_cv_mse = -search.best_score_
    cv_r2_approx = 1.0 - best_cv_mse / max(y_train.var(), 1e-6)

    xgb_params = {k.replace("xgb__", ""): v for k, v in best_params_raw.items()}
    logger.info("Step 1 done. Best params: %s", xgb_params)

    cv_r2_scores = cross_val_score(
        search.best_estimator_, X_train, y_train, cv=tscv, scoring="r2", n_jobs=n_jobs,
    )
    cv_r2_mean = float(cv_r2_scores.mean())
    cv_r2_std = float(cv_r2_scores.std())

    # ═════════════════════════════════════════════════════
    # STEP 2: Early stopping on validation split
    # ═════════════════════════════════════════════════════
    val_size = int(len(X_train) * EARLY_STOP_VAL_RATIO)
    X_fit, X_val = X_train.iloc[:-val_size], X_train.iloc[-val_size:]
    y_fit, y_val = y_train.iloc[:-val_size], y_train.iloc[-val_size:]
    logger.info("Step 2: Early stopping (fit=%d, val=%d)", len(X_fit), len(X_val))

    es_pipeline = Pipeline([
        ("preprocessor", get_preprocessor()),
        ("xgb", XGBRegressor(
            objective=objective,
            random_state=random_state,
            n_jobs=n_jobs,
            tree_method="hist",
            early_stopping_rounds=30,
            eval_metric="mae",
            **xgb_params,
        )),
    ])

    preprocessor_fit = get_preprocessor()
    preprocessor_fit.fit(X_fit)
    X_val_transformed = preprocessor_fit.transform(X_val)

    es_pipeline.fit(
        X_fit, y_fit,
        xgb__eval_set=[(X_val_transformed, y_val)],
        xgb__verbose=False,
    )

    xgb_model = es_pipeline.named_steps["xgb"]
    best_n_trees = xgb_model.best_iteration + 1 if xgb_model.best_iteration is not None else xgb_model.n_estimators
    logger.info("Early stopping: best_iteration=%d / %d", best_n_trees, xgb_params.get("n_estimators", 0))

    # ═════════════════════════════════════════════════════
    # STEP 3: Final model on ALL training data
    # ═════════════════════════════════════════════════════
    best = Pipeline([
        ("preprocessor", get_preprocessor()),
        ("xgb", XGBRegressor(
            objective=objective,
            random_state=random_state,
            n_jobs=n_jobs,
            tree_method="hist",
            n_estimators=best_n_trees,
            **{k: v for k, v in xgb_params.items() if k != "n_estimators"},
        )),
    ])
    best.fit(X_train, y_train)

    # ── Metrics ──
    y_train_pred = best.predict(X_train)
    train_r2 = r2_score(y_train, y_train_pred)
    train_mae = mean_absolute_error(y_train, y_train_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))

    y_test_pred = best.predict(X_test)
    test_r2 = r2_score(y_test, y_test_pred)
    test_mae = mean_absolute_error(y_test, y_test_pred)
    test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))

    train_residuals = y_train.values - y_train_pred
    test_residuals = y_test.values - y_test_pred
    test_res_skewness = float(scipy_stats.skew(test_residuals))

    # ── Bias correction (systematic shift between train/test distributions) ──
    bias_correction = round(float(np.mean(test_residuals)), 6)

    test_pred_percentiles = {
        f"p{p}": round(float(np.percentile(y_test_pred, p)), 4)
        for p in [5, 25, 50, 75, 95]
    }

    r2_gap = train_r2 - test_r2
    rmse_ratio = test_rmse / max(train_rmse, 1e-9)

    if train_r2 >= 0.9 and r2_gap > 0.20:
        overfit_verdict = "OVERFIT — train R² cao nhưng gap train/test > 0.20"
    elif r2_gap > 0.10:
        overfit_verdict = f"WARNING — gap train/test R² = {r2_gap:.3f}, nên kiểm tra"
    else:
        overfit_verdict = f"OK — gap train/test R² = {r2_gap:.3f}, không có dấu hiệu overfit rõ"

    # Feature importance
    final_xgb_model = best.named_steps["xgb"]
    preprocessor = best.named_steps["preprocessor"]
    num_names = list(NUMERIC_FEATURES)
    cat_ord_names = list(CATEGORICAL_ORDINAL_FEATURES)
    if CATEGORICAL_NOMINAL_FEATURES and "cat_nominal" in preprocessor.named_transformers_:
        cat_nom_names = list(preprocessor.named_transformers_["cat_nominal"].get_feature_names_out(CATEGORICAL_NOMINAL_FEATURES))
    else:
        cat_nom_names = []
    all_out_names = num_names + cat_ord_names + cat_nom_names
    importances = final_xgb_model.feature_importances_
    importance_list = [
        (name, round(float(imp), 6))
        for name, imp in sorted(zip(all_out_names, importances), key=lambda x: -x[1])
    ]

    practical_train = _compute_practical_metrics(y_train.values, y_train_pred)
    practical_test = _compute_practical_metrics(y_test.values, y_test_pred)

    metrics = {
        "objective": objective,
        "y_train_mean": round(float(y_train.mean()), 4),
        "y_train_std": round(float(y_train.std()), 4),
        "y_test_mean": round(float(y_test.mean()), 4),
        "y_test_std": round(float(y_test.std()), 4),
        "train_r2": round(train_r2, 4),
        "train_mae": round(train_mae, 4),
        "train_rmse": round(train_rmse, 4),
        "test_r2": round(test_r2, 4),
        "test_mae": round(test_mae, 4),
        "test_rmse": round(test_rmse, 4),
        "train_residual_mean": round(float(np.mean(train_residuals)), 4),
        "train_residual_std": round(float(np.std(train_residuals)), 4),
        "test_residual_mean": round(float(np.mean(test_residuals)), 4),
        "test_residual_std": round(float(np.std(test_residuals)), 4),
        "test_residual_skewness": round(test_res_skewness, 4),
        "test_pred_percentiles": test_pred_percentiles,
        "bias_correction": bias_correction,
        "r2_gap_train_minus_test": round(r2_gap, 4),
        "rmse_ratio_test_over_train": round(rmse_ratio, 4),
        "overfit_verdict": overfit_verdict,
        "cv_best_neg_mse": round(float(search.best_score_), 4),
        "cv_r2_approx": round(cv_r2_approx, 4),
        "cv_r2_fold_scores": [round(s, 4) for s in cv_r2_scores.tolist()],
        "cv_r2_mean": round(cv_r2_mean, 4),
        "cv_r2_std": round(cv_r2_std, 4),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": len(all_out_names),
        "best_params": best_params_raw,
        "feature_importance": importance_list,
        "practical_train": practical_train,
        "practical_test": practical_test,
        "best_n_trees": best_n_trees,
    }
    return best, metrics


def save_versioned_model(pipeline, save_dir: Path | None = None) -> Path:
    """Lưu model với tên xgb_vYYYYMMDD_HHMM.joblib."""
    save_dir = save_dir or MODEL_DIR
    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)
    version = datetime.now().strftime("%Y%m%d_%H%M")
    name = f"xgb_v{version}.joblib"
    path = save_dir / name
    joblib.dump(pipeline, path)
    logger.info("Model saved: %s", path)
    return path


def main():
    parser = argparse.ArgumentParser(
        description="Train XGBoost cho irrigation prediction (time-series safe).",
    )
    parser.add_argument("csv_path", type=str, help="Đường dẫn file CSV.")
    parser.add_argument("--target", type=str, default=DEFAULT_TARGET, choices=TARGET_CHOICES)
    parser.add_argument("--time-col", type=str, default="timestamp")
    parser.add_argument("--n-splits", type=int, default=5)
    parser.add_argument("--n-iter", type=int, default=50, help="RandomizedSearchCV iterations (default 50).")
    parser.add_argument(
        "--loss", choices=["squared", "huber"], default="squared",
        help="Loss function: 'squared' (MSE) or 'huber' (robust to outliers).",
    )
    parser.add_argument("--out-dir", type=str, default=None)
    parser.add_argument("--test-ratio", type=float, default=TEST_RATIO)
    parser.add_argument("--n-jobs", type=int, default=-1)
    args = parser.parse_args()

    objective = "reg:squarederror" if args.loss == "squared" else "reg:pseudohubererror"

    time_col = args.time_col or None
    if args.time_col == "":
        time_col = None

    X, y, used_features = load_and_prepare_data(
        args.csv_path, target_column=args.target, time_column=time_col,
    )

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
                logger.warning("Metadata length mismatch, disabling hybrid eval")
                hybrid_meta = None

    n = len(X)
    split_idx = int(n * (1 - args.test_ratio))
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    logger.info("Train/Test split: %d train + %d test", len(X_train), len(X_test))

    logger.info(
        "Training XGBoost (%s + EarlyStopping) n_splits=%d n_iter=%d",
        objective, args.n_splits, args.n_iter,
    )
    pipeline, metrics = train_xgb_with_timeseries_cv(
        X_train, y_train, X_test, y_test,
        objective=objective,
        n_splits=args.n_splits, n_iter=args.n_iter, n_jobs=args.n_jobs,
    )

    # ── Log metrics ──
    logger.info("========== TARGET DISTRIBUTION ==========")
    logger.info("Train  → mean=%.4f, std=%.4f", metrics["y_train_mean"], metrics["y_train_std"])
    logger.info("Test   → mean=%.4f, std=%.4f", metrics["y_test_mean"], metrics["y_test_std"])
    logger.info("========== TRAIN METRICS ==========")
    logger.info("R²=%.4f  MAE=%.4f  RMSE=%.4f", metrics["train_r2"], metrics["train_mae"], metrics["train_rmse"])
    logger.info("========== TEST METRICS ==========")
    logger.info("R²=%.4f  MAE=%.4f  RMSE=%.4f", metrics["test_r2"], metrics["test_mae"], metrics["test_rmse"])
    logger.info("Residuals: mean=%.4f std=%.4f skew=%.4f",
                metrics["test_residual_mean"], metrics["test_residual_std"], metrics["test_residual_skewness"])
    logger.info("Bias correction: %.6f", metrics["bias_correction"])
    logger.info("========== PRACTICAL METRICS (test) ==========")
    pm = metrics["practical_test"]
    logger.info("Within ±0.5mm: %.1f%%  Within ±1mm: %.1f%%", pm["within_05mm_pct"], pm["within_1mm_pct"])
    logger.info("Directional accuracy: %.1f%%  Median AE: %.4f", pm["directional_accuracy_pct"], pm["median_abs_error"])
    logger.info("MAE by range: %s", pm["mae_by_range"])
    logger.info("========== OVERFITTING / CV ==========")
    logger.info("R² gap=%.4f  RMSE ratio=%.3f  %s",
                metrics["r2_gap_train_minus_test"], metrics["rmse_ratio_test_over_train"], metrics["overfit_verdict"])
    logger.info("CV R² per fold: %s  mean=%.4f±%.4f",
                metrics["cv_r2_fold_scores"], metrics["cv_r2_mean"], metrics["cv_r2_std"])
    logger.info("Best n_trees (early stop): %d", metrics["best_n_trees"])
    logger.info("Best params: %s", metrics["best_params"])
    logger.info("========== FEATURE IMPORTANCE (top 15) ==========")
    for name, imp in metrics["feature_importance"][:15]:
        logger.info("  %s: %s", name, imp)

    # ── Hybrid evaluation ──
    hybrid_metrics = None
    if hybrid_meta is not None:
        fao_test = hybrid_meta["fao_pred_24h"][split_idx:]
        actual_test = hybrid_meta["actual_depl"][split_idx:]
        xgb_pred_test = pipeline.predict(X_test)
        hybrid_pred = np.clip(fao_test + xgb_pred_test, 0, 50)

        fao_only_r2 = r2_score(actual_test, fao_test)
        fao_only_mae = mean_absolute_error(actual_test, fao_test)
        fao_only_rmse = np.sqrt(mean_squared_error(actual_test, fao_test))
        h_r2 = r2_score(actual_test, hybrid_pred)
        h_mae = mean_absolute_error(actual_test, hybrid_pred)
        h_rmse = np.sqrt(mean_squared_error(actual_test, hybrid_pred))

        hybrid_practical = _compute_practical_metrics(actual_test, hybrid_pred)
        fao_practical = _compute_practical_metrics(actual_test, fao_test)

        hybrid_metrics = {
            "fao_only_r2": round(fao_only_r2, 4),
            "fao_only_mae": round(fao_only_mae, 4),
            "fao_only_rmse": round(fao_only_rmse, 4),
            "hybrid_r2": round(h_r2, 4),
            "hybrid_mae": round(h_mae, 4),
            "hybrid_rmse": round(h_rmse, 4),
            "hybrid_practical": hybrid_practical,
            "fao_practical": fao_practical,
        }

        logger.info("========== HYBRID EVALUATION (FAO-56 + XGBoost) ==========")
        logger.info("  FAO-56 only  → R²=%.4f  MAE=%.4f  RMSE=%.4f  ±1mm=%.1f%%",
                     fao_only_r2, fao_only_mae, fao_only_rmse, fao_practical["within_1mm_pct"])
        logger.info("  FAO-56 + XGB → R²=%.4f  MAE=%.4f  RMSE=%.4f  ±1mm=%.1f%%",
                     h_r2, h_mae, h_rmse, hybrid_practical["within_1mm_pct"])
        logger.info("  Improvement  → ΔR²=+%.4f  ΔMAE=%.4f  ΔRMSE=%.4f",
                     h_r2 - fao_only_r2, fao_only_mae - h_mae, fao_only_rmse - h_rmse)

    # ── Usability verdict (hybrid-aware) ──
    if hybrid_metrics is not None:
        hp = hybrid_metrics["hybrid_practical"]
        if hybrid_metrics["hybrid_r2"] >= 0.95 and hp["within_1mm_pct"] >= 85:
            usability = "GOOD — hybrid model production-ready (Hybrid R²≥0.95, ±1mm≥85%)"
        elif hybrid_metrics["hybrid_r2"] >= 0.90:
            usability = "ACCEPTABLE — hybrid model usable, can improve"
        else:
            usability = "NEEDS IMPROVEMENT — hybrid R² < 0.90"
    else:
        if metrics["test_r2"] >= 0.80 and metrics["r2_gap_train_minus_test"] <= 0.15:
            usability = "GOOD — residual model R² ≥ 0.80"
        elif metrics["test_r2"] >= 0.40:
            usability = "MARGINAL — residual R² acceptable, check hybrid metrics"
        else:
            usability = "NEEDS IMPROVEMENT — residual R² < 0.40"
    metrics["usability_verdict"] = usability

    logger.info("========== USABILITY ==========")
    logger.info(">>> %s", usability)

    # ── Re-fit on full data and save ──
    logger.info("Re-fitting on full dataset (%d samples)...", n)
    pipeline.fit(X, y)

    pipeline.bias_correction_ = metrics["bias_correction"]

    out_dir = Path(args.out_dir) if args.out_dir else MODEL_DIR
    model_path = save_versioned_model(pipeline, save_dir=out_dir)

    # ── Write metrics file ──
    loss_label = "MSE" if args.loss == "squared" else "Huber"
    metrics_path = out_dir / f"metrics_{model_path.stem}.txt"
    with open(metrics_path, "w", encoding="utf-8") as f:
        f.write(f"Model: {model_path.name}\n")
        f.write(f"Estimator: XGBoost ({loss_label} loss + EarlyStopping)\n")
        f.write(f"Objective: {objective}\n")
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
        f.write(f"  Residual mean={metrics['train_residual_mean']}, std={metrics['train_residual_std']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[TEST METRICS] (unbiased — đánh giá chính)\n")
        f.write(f"  R²   = {metrics['test_r2']}\n")
        f.write(f"  MAE  = {metrics['test_mae']}\n")
        f.write(f"  RMSE = {metrics['test_rmse']}\n")
        f.write(f"  Residual mean={metrics['test_residual_mean']}, std={metrics['test_residual_std']}, skewness={metrics['test_residual_skewness']}\n")
        f.write(f"  Prediction percentiles: {metrics['test_pred_percentiles']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[PRACTICAL METRICS] (test set)\n")
        pm = metrics["practical_test"]
        f.write(f"  Within ±0.5mm = {pm['within_05mm_pct']}%\n")
        f.write(f"  Within ±1.0mm = {pm['within_1mm_pct']}%\n")
        f.write(f"  Directional accuracy = {pm['directional_accuracy_pct']}%\n")
        f.write(f"  Median absolute error = {pm['median_abs_error']}\n")
        f.write(f"  MAE by range: {pm['mae_by_range']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[BIAS CORRECTION]\n")
        f.write(f"  bias_correction = {metrics['bias_correction']}\n")
        f.write(f"  (stored in model artifact as pipeline.bias_correction_)\n\n")

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
        f.write("[EARLY STOPPING]\n")
        f.write(f"  Best n_trees = {metrics['best_n_trees']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write(f"[USABILITY VERDICT]\n  >>> {metrics['usability_verdict']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write(f"[BEST HYPERPARAMETERS]\n  {metrics['best_params']}\n\n")

        f.write("──────────────────────────────────────────\n")
        f.write("[FEATURE IMPORTANCE]\n")
        for name, imp in metrics["feature_importance"]:
            f.write(f"  {name}: {imp}\n")

        if hybrid_metrics is not None:
            f.write("\n──────────────────────────────────────────\n")
            f.write("[HYBRID EVALUATION — FAO-56 + XGBoost → depletion_after_24h]\n")
            f.write(f"  FAO-56 only → R²={hybrid_metrics['fao_only_r2']}, "
                    f"MAE={hybrid_metrics['fao_only_mae']}, "
                    f"RMSE={hybrid_metrics['fao_only_rmse']}\n")
            f.write(f"  Hybrid      → R²={hybrid_metrics['hybrid_r2']}, "
                    f"MAE={hybrid_metrics['hybrid_mae']}, "
                    f"RMSE={hybrid_metrics['hybrid_rmse']}\n")
            delta_r2 = hybrid_metrics['hybrid_r2'] - hybrid_metrics['fao_only_r2']
            delta_mae = hybrid_metrics['fao_only_mae'] - hybrid_metrics['hybrid_mae']
            delta_rmse = hybrid_metrics['fao_only_rmse'] - hybrid_metrics['hybrid_rmse']
            f.write(f"  Improvement → ΔR²=+{round(delta_r2, 4)}, "
                    f"ΔMAE={round(delta_mae, 4)}, ΔRMSE={round(delta_rmse, 4)}\n")
            hp = hybrid_metrics['hybrid_practical']
            fp = hybrid_metrics['fao_practical']
            f.write(f"  Hybrid  ±1mm accuracy = {hp['within_1mm_pct']}%\n")
            f.write(f"  FAO-56  ±1mm accuracy = {fp['within_1mm_pct']}%\n")

    logger.info("Metrics written to %s", metrics_path)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
