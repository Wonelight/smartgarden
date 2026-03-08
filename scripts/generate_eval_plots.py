import matplotlib.pyplot as plt
import numpy as np
import os
from pathlib import Path

# Thư mục lưu biểu đồ
output_dir = Path(r"d:\DoAn_Garden\smart_garden\ai-service\app\ml\models\eval_plots")
output_dir.mkdir(parents=True, exist_ok=True)

# 1. Vẽ biểu đồ Practical Metrics
def plot_practical_metrics():
    labels = ['Độ chính xác ±0.5mm', 'Độ chính xác ±1.0mm', 'Dự đoán đúng xu hướng']
    values = [78.8, 94.6, 96.9]
    
    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.bar(labels, values, color=['#3498db', '#2ecc71', '#9b59b6'], width=0.5)
    
    ax.set_ylim(0, 110)
    ax.set_ylabel('Tỷ lệ phần trăm (%)', fontsize=12)
    ax.set_title('Thước đo Thực tiễn (Practical Metrics) - XGBoost', fontsize=14, pad=15)
    
    # Thêm số liệu trên cột
    for bar in bars:
        height = bar.get_height()
        ax.annotate(f'{height}%',
                    xy=(bar.get_x() + bar.get_width() / 2, height),
                    xytext=(0, 3),  # 3 points vertical offset
                    textcoords="offset points",
                    ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(output_dir / "practical_metrics.png", dpi=300)
    plt.close()

# 2. Vẽ biểu đồ So sánh FAO-56 và Hybrid
def plot_hybrid_comparison():
    labels = ['R² (Hệ số QĐ)', 'MAE (Sai số tuyệt đối)', 'RMSE (Căn bậc hai Sai số)', 'Độ chính xác ±1mm']
    
    # R², MAE, RMSE, Accuracy
    fao_values = [0.9734, 0.6308, 0.9059, 78.0/100] # Chia 100 cho Accuracy để cùng scale với R² hoặc vẽ 2 trục.
    # Tốt hơn là tách chart Accuracy ra hoặc nhân R2, MAE lên.
    # Nên dùng Plot có 2 y-axis hoặc vẽ 2 subplots.
    pass

def plot_hybrid_comparison_subplots():
    fao_metrics = {'R²': 0.9734, 'MAE (mm)': 0.6308, 'RMSE (mm)': 0.9059, '±1mm Acc (%)': 78.0}
    hybrid_metrics = {'R²': 0.9927, 'MAE (mm)': 0.3413, 'RMSE (mm)': 0.4751, '±1mm Acc (%)': 94.6}
    
    metrics = list(fao_metrics.keys())
    fao_vals = list(fao_metrics.values())
    hybrid_vals = list(hybrid_metrics.values())
    
    x = np.arange(len(metrics))  # the label locations
    width = 0.35  # the width of the bars
    
    fig, ax = plt.subplots(figsize=(10, 6))
    rects1 = ax.bar(x - width/2, fao_vals, width, label='FAO-56 Cổ điển', color='#e74c3c')
    rects2 = ax.bar(x + width/2, hybrid_vals, width, label='Hybrid (FAO-56 + XGBoost)', color='#2ecc71')
    
    ax.set_ylabel('Giá trị', fontsize=12)
    ax.set_title('Đánh giá Hiệu năng: FAO-56 thuần túy vs Hybrid AI', fontsize=14, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=11)
    ax.legend(fontsize=11)
    
    # Vẽ text
    def autolabel(rects, is_pct=False):
        for rect in rects:
            height = rect.get_height()
            label_text = f'{height}%' if height > 10 else f'{height:.4f}'
            if is_pct and height > 10: label_text = f'{height}%'
            
            ax.annotate(label_text,
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=10)
            
    autolabel(rects1)
    autolabel(rects2)
    
    # Scale trục y cao lên chút
    ax.set_ylim(0, 110)
    
    plt.tight_layout()
    plt.savefig(output_dir / "fao_vs_hybrid.png", dpi=300)
    plt.close()
    
# Tách riêng biểu đồ R2, MAE, RMSE để scale đẹp hơn
def plot_hybrid_comparison_separated():
    # Phần 1: Các chỉ số có giá trị nhỏ (R², MAE, RMSE)
    labels_small = ['R² (Cao hơn là tốt)', 'MAE (Thấp hơn là tốt)', 'RMSE (Thấp hơn là tốt)']
    fao_small = [0.9734, 0.6308, 0.9059]
    hybrid_small = [0.9927, 0.3413, 0.4751]
    
    x = np.arange(len(labels_small))
    width = 0.35
    
    fig, ax = plt.subplots(figsize=(9, 6))
    rects1 = ax.bar(x - width/2, fao_small, width, label='FAO-56 Cổ điển', color='#e74c3c')
    rects2 = ax.bar(x + width/2, hybrid_small, width, label='Hybrid (FAO-56 + XGBoost)', color='#2ecc71')
    
    ax.set_ylabel('Giá trị', fontsize=12)
    ax.set_title('So sánh R², MAE và RMSE (FAO-56 vs Hybrid)', fontsize=14, pad=15)
    ax.set_xticks(x)
    ax.set_xticklabels(labels_small, fontsize=11)
    ax.legend(fontsize=11)
    ax.set_ylim(0, 1.2)
    
    def autolabel_small(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height:.4f}',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3), textcoords="offset points",
                        ha='center', va='bottom', fontsize=11, fontweight='bold')
            
    autolabel_small(rects1)
    autolabel_small(rects2)
    
    plt.tight_layout()
    plt.savefig(output_dir / "fao_vs_hybrid_metrics.png", dpi=300)
    plt.close()

# 3. Vẽ biểu đồ Feature Importance (Top 10)
def plot_feature_importance():
    features = [
        "season_x_stress", "season_x_rain", "month_sin", "stress_ratio", 
        "depletion_trend_12h", "kc", "net_water_loss_24h", "forecast_rain_d1", 
        "forecast_rain_d0", "etc_rolling_12h"
    ]
    importances = [
        0.110374, 0.083246, 0.065278, 0.060764, 
        0.05759, 0.051179, 0.049091, 0.045999, 
        0.045167, 0.041678
    ]
    
    # Convert to percent
    importances_pct = [imp * 100 for imp in importances]
    
    # Đảo thứ tự để hiển thị từ cao xuống thấp trên biểu đồ ngang
    features.reverse()
    importances_pct.reverse()
    
    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(features, importances_pct, color='#34495e')
    
    ax.set_xlabel('Mức độ ảnh hưởng (%)', fontsize=12)
    ax.set_title('Top 10 Đặc trưng có sức ảnh hưởng lớn nhất trong Mô hình (XGBoost)', fontsize=14, pad=15)
    
    for bar in bars:
        width = bar.get_width()
        ax.annotate(f'{width:.2f}%',
                    xy=(width, bar.get_y() + bar.get_height() / 2),
                    xytext=(3, 0),  # 3 points horizontal offset
                    textcoords="offset points",
                    ha='left', va='center', fontsize=10)
    
    ax.set_xlim(0, max(importances_pct) * 1.15)
    
    plt.tight_layout()
    plt.savefig(output_dir / "feature_importance.png", dpi=300)
    plt.close()

if __name__ == "__main__":
    print(f"Creating evaluation plots at {output_dir}...")
    plot_practical_metrics()
    plot_hybrid_comparison_separated()
    plot_feature_importance()
    print("Plots generated successfully!")
