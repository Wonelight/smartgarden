#!/usr/bin/env python3
"""
Đánh giá model XGBoost (MSE) — dự đoán residual, tính chỉ số và vẽ biểu đồ.

- Load model mới nhất (xgb_v*.joblib), load data CSV, split train/test giống lúc train.
- Dự đoán trên test set (residual + hybrid), tính R², MAE, RMSE, practical metrics.
- Vẽ: Actual vs Predicted (residual), Residuals boxplot, MAE theo khoảng, Hybrid Actual vs Predicted.

Usage:
    python scripts/evaluate_xgb.py data/rf_training_data.csv
    python scripts/evaluate_xgb.py data/rf_training_data.csv --out-dir scripts/eval_plots
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

_REPO_ROOT = Path(__file__).resolve().parent.parent
_AI_SERVICE = _REPO_ROOT / "ai-service"
_SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(_AI_SERVICE))
sys.path.insert(0, str(_SCRIPTS_DIR))

from app.ml.pipeline_builder import MODEL_DIR, load_latest_model
from train_rf import load_and_prepare_data

TEST_RATIO = 0.20


def _compute_practical_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    abs_errors = np.abs(y_true - y_pred)
    within_1mm = float(np.mean(abs_errors <= 1.0) * 100)
    within_05mm = float(np.mean(abs_errors <= 0.5) * 100)
    median_ae = float(np.median(abs_errors))
    sign_true = np.sign(y_true)
    sign_pred = np.sign(y_pred)
    nonzero = sign_true != 0
    directional_acc = float(np.mean(sign_true[nonzero] == sign_pred[nonzero]) * 100) if nonzero.any() else 0.0
    mae_by_range = {}
    abs_true = np.abs(y_true)
    for label, lo, hi in [("low (<0.3mm)", 0, 0.3), ("mid (0.3-1mm)", 0.3, 1.0), ("high (>1mm)", 1.0, float("inf"))]:
        mask = (abs_true >= lo) & (abs_true < hi)
        mae_by_range[label] = round(float(np.mean(abs_errors[mask])), 4) if mask.any() else None
    return {
        "within_1mm_pct": round(within_1mm, 1),
        "within_05mm_pct": round(within_05mm, 1),
        "directional_accuracy_pct": round(directional_acc, 1),
        "median_abs_error": round(median_ae, 4),
        "mae_by_range": mae_by_range,
    }


def main():
    parser = argparse.ArgumentParser(description="Đánh giá model XGBoost và vẽ biểu đồ.")
    parser.add_argument("csv_path", type=str, help="Đường dẫn CSV (cùng file dùng để train).")
    parser.add_argument("--out-dir", type=str, default=None, help="Thư mục lưu biểu đồ (mặc định: ai-service/app/ml/models/eval_plots).")
    parser.add_argument("--time-col", type=str, default="timestamp")
    parser.add_argument("--target", type=str, default="residual_target")
    args = parser.parse_args()

    time_col = args.time_col if args.time_col else None
    out_dir = Path(args.out_dir) if args.out_dir else (MODEL_DIR / "eval_plots")
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load model
    pipeline = load_latest_model("xgb")
    if pipeline is None:
        print("Model not found: no xgb_v*.joblib in", MODEL_DIR)
        return 1
    bias_correction = getattr(pipeline, "bias_correction_", 0.0)
    print("Loaded model, bias_correction =", bias_correction)

    # Load data
    X, y, _ = load_and_prepare_data(args.csv_path, target_column=args.target, time_column=time_col)
    n = len(X)
    split_idx = int(n * (1 - TEST_RATIO))
    X_test = X.iloc[split_idx:]
    y_test = y.iloc[split_idx:]

    # Predict residual (with bias correction)
    y_pred_residual = pipeline.predict(X_test)
    y_pred_residual = np.asarray(y_pred_residual, dtype=float).ravel() + bias_correction

    # Metrics — residual
    r2 = r2_score(y_test, y_pred_residual)
    mae = mean_absolute_error(y_test, y_pred_residual)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred_residual))
    residuals = y_test.values - y_pred_residual
    practical = _compute_practical_metrics(y_test.values, y_pred_residual)

    print("\n========== METRICS (Residual - test set) ==========")
    print(f"  R²     = {r2:.4f}")
    print(f"  MAE    = {mae:.4f}")
    print(f"  RMSE   = {rmse:.4f}")
    print(f"  Bias   = {np.mean(residuals):.4f}")
    print(f"  Within ±0.5mm = {practical['within_05mm_pct']}%")
    print(f"  Within ±1.0mm = {practical['within_1mm_pct']}%")
    print(f"  Directional accuracy = {practical['directional_accuracy_pct']}%")
    print(f"  Median AE = {practical['median_abs_error']}")
    print(f"  MAE by range: {practical['mae_by_range']}")

    # Hybrid: need fao_pred_24h and actual depletion
    df_raw = pd.read_csv(args.csv_path)
    if args.time_col and args.time_col in df_raw.columns:
        df_raw[args.time_col] = pd.to_datetime(df_raw[args.time_col])
        df_raw = df_raw.sort_values(args.time_col).reset_index(drop=True)
    df_raw = df_raw.dropna(subset=[args.target]).reset_index(drop=True)
    if "fao_pred_24h" in df_raw.columns and "depletion_after_24h" in df_raw.columns:
        fao_test = df_raw["fao_pred_24h"].values[split_idx:]
        actual_depl = df_raw["depletion_after_24h"].values[split_idx:]
        hybrid_pred = np.clip(fao_test + y_pred_residual, 0, 50)
        h_r2 = r2_score(actual_depl, hybrid_pred)
        h_mae = mean_absolute_error(actual_depl, hybrid_pred)
        h_rmse = np.sqrt(mean_squared_error(actual_depl, hybrid_pred))
        hybrid_practical = _compute_practical_metrics(actual_depl, hybrid_pred)
        print("\n========== HYBRID METRICS (FAO-56 + XGBoost -> depletion_after_24h) ==========")
        print(f"  Hybrid R²   = {h_r2:.4f}")
        print(f"  Hybrid MAE  = {h_mae:.4f}")
        print(f"  Hybrid RMSE = {h_rmse:.4f}")
        print(f"  Within ±1mm = {hybrid_practical['within_1mm_pct']}%")
    else:
        fao_test = actual_depl = hybrid_pred = None
        hybrid_practical = None

    # ─── Plots ───
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("\nMissing matplotlib. Install: pip install matplotlib")
        return 0

    fig_size = (5.5, 4.5)
    fontsize = 10

    # 1) Actual vs Predicted (residual)
    fig, ax = plt.subplots(figsize=fig_size)
    ax.scatter(y_test, y_pred_residual, alpha=0.25, s=8, c="steelblue", edgecolors="none")
    mn = min(y_test.min(), y_pred_residual.min())
    mx = max(y_test.max(), y_pred_residual.max())
    ax.plot([mn, mx], [mn, mx], "k--", lw=1.5, label="Ideal (y=x)")
    ax.set_xlabel("Actual residual (mm)", fontsize=fontsize)
    ax.set_ylabel("Predicted residual (mm)", fontsize=fontsize)
    ax.set_title(f"Residual: Actual vs Predicted (Test set)\nR² = {r2:.3f}, MAE = {mae:.3f}", fontsize=fontsize)
    ax.legend(loc="upper left", fontsize=fontsize - 1)
    ax.set_aspect("equal", adjustable="box")
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_dir / "residual_actual_vs_predicted.png", dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved:", out_dir / "residual_actual_vs_predicted.png")

    # 2) Boxplot of residuals
    fig, ax = plt.subplots(figsize=(5, 4))
    bp = ax.boxplot(
        [residuals],
        tick_labels=["Residual (actual - predicted)"],
        patch_artist=True,
        showfliers=True,
        flierprops=dict(marker=".", markersize=3, alpha=0.5),
    )
    for patch in bp["boxes"]:
        patch.set_facecolor("lightsteelblue")
    ax.axhline(0, color="gray", linestyle="--", linewidth=1)
    ax.set_ylabel("Residual (mm)", fontsize=fontsize)
    ax.set_title(f"Residual distribution (Test set)\nMean = {np.mean(residuals):.3f}, Std = {np.std(residuals):.3f}", fontsize=fontsize)
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()
    plt.savefig(out_dir / "residuals_boxplot.png", dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved:", out_dir / "residuals_boxplot.png")

    # 3) MAE by range (bar chart)
    mae_range = practical["mae_by_range"]
    labels = [k for k, v in mae_range.items() if v is not None]
    values = [mae_range[k] for k in labels]
    if labels:
        fig, ax = plt.subplots(figsize=fig_size)
        bars = ax.bar(labels, values, color="steelblue", edgecolor="navy", alpha=0.8)
        ax.set_ylabel("MAE (mm)", fontsize=fontsize)
        ax.set_xlabel("|residual| range", fontsize=fontsize)
        ax.set_title("MAE by residual magnitude (Test set)", fontsize=fontsize)
        for b, v in zip(bars, values):
            ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.01, f"{v:.3f}", ha="center", fontsize=fontsize - 1)
        ax.grid(True, alpha=0.3, axis="y")
        plt.xticks(rotation=15)
        plt.tight_layout()
        plt.savefig(out_dir / "mae_by_range.png", dpi=150, bbox_inches="tight")
        plt.close()
        print("Saved:", out_dir / "mae_by_range.png")

    # 4) Hybrid: Actual depletion vs Predicted depletion
    if fao_test is not None and actual_depl is not None:
        fig, ax = plt.subplots(figsize=fig_size)
        ax.scatter(actual_depl, hybrid_pred, alpha=0.25, s=8, c="darkgreen", edgecolors="none")
        mn = min(actual_depl.min(), hybrid_pred.min())
        mx = max(actual_depl.max(), hybrid_pred.max())
        ax.plot([mn, mx], [mn, mx], "k--", lw=1.5, label="Ideal (y=x)")
        ax.set_xlabel("Actual depletion after 24h (mm)", fontsize=fontsize)
        ax.set_ylabel("Hybrid predicted depletion (mm)", fontsize=fontsize)
        ax.set_title(f"Hybrid: Actual vs Predicted depletion (Test set)\nR² = {h_r2:.3f}, MAE = {h_mae:.3f}", fontsize=fontsize)
        ax.legend(loc="upper left", fontsize=fontsize - 1)
        ax.set_aspect("equal", adjustable="box")
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig(out_dir / "hybrid_actual_vs_predicted.png", dpi=150, bbox_inches="tight")
        plt.close()
        print("Saved:", out_dir / "hybrid_actual_vs_predicted.png")

    # 5) Residual histogram
    fig, ax = plt.subplots(figsize=fig_size)
    ax.hist(residuals, bins=50, color="steelblue", edgecolor="white", alpha=0.8)
    ax.axvline(0, color="black", linestyle="--", linewidth=1)
    ax.axvline(np.mean(residuals), color="red", linestyle="-", linewidth=1.5, label=f"Mean = {np.mean(residuals):.3f}")
    ax.set_xlabel("Residual (mm)", fontsize=fontsize)
    ax.set_ylabel("Count", fontsize=fontsize)
    ax.set_title("Residual error histogram (Test set)", fontsize=fontsize)
    ax.legend(loc="upper right", fontsize=fontsize - 1)
    ax.grid(True, alpha=0.3, axis="y")
    plt.tight_layout()
    plt.savefig(out_dir / "residuals_histogram.png", dpi=150, bbox_inches="tight")
    plt.close()
    print("Saved:", out_dir / "residuals_histogram.png")

    # 6) Summary table (text)
    summary_path = out_dir / "evaluation_summary.txt"
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("========== ĐÁNH GIÁ MODEL XGBOOST (MSE) ==========\n\n")
        f.write("[RESIDUAL — Test set]\n")
        f.write(f"  R²   = {r2:.4f}\n")
        f.write(f"  MAE  = {mae:.4f}\n")
        f.write(f"  RMSE = {rmse:.4f}\n")
        f.write(f"  Bias = {np.mean(residuals):.4f}\n")
        f.write(f"  Within ±0.5mm = {practical['within_05mm_pct']}%\n")
        f.write(f"  Within ±1.0mm = {practical['within_1mm_pct']}%\n")
        f.write(f"  Directional accuracy = {practical['directional_accuracy_pct']}%\n")
        f.write(f"  Median AE = {practical['median_abs_error']}\n")
        f.write(f"  MAE by range: {practical['mae_by_range']}\n\n")
        if hybrid_practical is not None:
            f.write("[HYBRID — depletion_after_24h]\n")
            f.write(f"  R²   = {h_r2:.4f}\n")
            f.write(f"  MAE  = {h_mae:.4f}\n")
            f.write(f"  RMSE = {h_rmse:.4f}\n")
            f.write(f"  Within ±1mm = {hybrid_practical['within_1mm_pct']}%\n")
    print("Saved:", summary_path)

    print("\nDone. Evaluation and plots written to", out_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
