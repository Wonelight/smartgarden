"""
Train YOLO11 for Tomato Disease Detection
──────────────────────────────────────────
Fine-tunes YOLO11s on the stratified tomato detection dataset.
Optimized for RTX 3050 Laptop GPU (4 GB VRAM).

Usage:
  python ai-service/train_yolo_tomato.py
  python ai-service/train_yolo_tomato.py --epochs 50 --batch 4
  python ai-service/train_yolo_tomato.py --resume
"""

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args():
    p = argparse.ArgumentParser(description="Train YOLO11 Tomato Disease Detector")
    p.add_argument("--model", default="yolo11s.pt", help="Base model (default: yolo11s.pt)")
    p.add_argument("--data", default=str(Path(__file__).resolve().parent / "dataforYolo" / "tomato_detection" / "data.yaml"))
    p.add_argument("--epochs", type=int, default=100)
    p.add_argument("--batch", type=int, default=8, help="Batch size (8 for 4GB VRAM)")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--device", default="0", help="cuda device (0) or cpu")
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--resume", action="store_true", help="Resume from last checkpoint")
    p.add_argument("--project", default=str(Path(__file__).resolve().parent / "runs" / "tomato_detect"))
    p.add_argument("--name", default="yolo11s_tomato")
    return p.parse_args()


def main():
    args = parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise FileNotFoundError(
            f"Dataset not found: {data_path}\n"
            "Run prepare_tomato_dataset.py first."
        )

    if args.resume:
        # Resume from last checkpoint
        last_pt = Path(args.project) / args.name / "weights" / "last.pt"
        if not last_pt.exists():
            raise FileNotFoundError(f"No checkpoint to resume from: {last_pt}")
        model = YOLO(str(last_pt))
        print(f"Resuming from: {last_pt}")
    else:
        model = YOLO(args.model)
        print(f"Base model: {args.model}")

    print(f"Dataset: {data_path}")
    print(f"Epochs: {args.epochs} | Batch: {args.batch} | Image size: {args.imgsz}")
    print(f"Device: {args.device} | Workers: {args.workers}")
    print(f"Output: {args.project}/{args.name}")
    print("=" * 60)

    results = model.train(
        data=str(data_path),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
        workers=args.workers,
        project=args.project,
        name=args.name,
        exist_ok=True,
        # ── Optimization ──
        optimizer="SGD",
        lr0=0.01,
        lrf=0.01,
        momentum=0.937,
        weight_decay=0.0005,
        warmup_epochs=3.0,
        warmup_momentum=0.8,
        # ── Early stopping ──
        patience=20,
        # ── Augmentation ──
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        degrees=10.0,
        translate=0.1,
        scale=0.5,
        fliplr=0.5,
        mosaic=1.0,
        mixup=0.1,
        # ── Loss weights ──
        box=7.5,
        cls=1.5,
        dfl=1.5,
        # ── Saving ──
        save=True,
        save_period=10,
        plots=True,
        verbose=True,
    )

    # ── Post-training evaluation on test set ──
    print("\n" + "=" * 60)
    print("EVALUATING ON TEST SET...")
    print("=" * 60)

    best_pt = Path(args.project) / args.name / "weights" / "best.pt"
    if best_pt.exists():
        best_model = YOLO(str(best_pt))
        metrics = best_model.val(
            data=str(data_path),
            split="test",
            batch=args.batch,
            imgsz=args.imgsz,
            device=args.device,
            plots=True,
            verbose=True,
        )
        print(f"\nTest mAP50:    {metrics.box.map50:.4f}")
        print(f"Test mAP50-95: {metrics.box.map:.4f}")

        # Copy best model to the AI service model directory
        service_model_dir = Path(__file__).resolve().parent / "app" / "ml" / "models" / "plant" / "plant_detect" / "weights"
        service_model_dir.mkdir(parents=True, exist_ok=True)
        import shutil
        dest = service_model_dir / "best.pt"
        shutil.copy2(best_pt, dest)
        print(f"\nModel copied to: {dest}")
        print("PlantImageService will auto-load this model on next request.")
    else:
        print("WARNING: best.pt not found after training!")


if __name__ == "__main__":
    main()
