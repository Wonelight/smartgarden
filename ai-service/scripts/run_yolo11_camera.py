"""Run YOLO11 realtime inference from webcam or phone camera stream.

Examples:
  python scripts/run_yolo11_camera.py --source 0 --task detect
  python scripts/run_yolo11_camera.py --source http://192.168.1.20:4747/video --task detect
  python scripts/run_yolo11_camera.py --source rtsp://192.168.1.20:8554/live --task segment
  python scripts/run_yolo11_camera.py --source 0 --task classify --model yolo11n-cls.pt
"""

import argparse

from ultralytics import YOLO


def resolve_default_model(task: str) -> str:
    if task == "detect":
        return "yolo11n.pt"
    if task == "classify":
        return "yolo11n-cls.pt"
    return "yolo11n-seg.pt"


def parse_source(raw: str):
    # Ultralytics accepts webcam index as int, and URL/file as str.
    return int(raw) if raw.isdigit() else raw


def main() -> None:
    parser = argparse.ArgumentParser(description="Realtime YOLO11 from camera source")
    parser.add_argument("--source", default="0", help="Camera source: 0/1, http://..., rtsp://..., video file")
    parser.add_argument("--task", choices=["detect", "classify", "segment"], default="detect")
    parser.add_argument("--model", default="", help="Custom .pt path (optional)")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold")
    parser.add_argument("--imgsz", type=int, default=640, help="Inference image size")
    args = parser.parse_args()

    model_path = args.model.strip() or resolve_default_model(args.task)
    source = parse_source(args.source)

    model = YOLO(model_path)
    model.predict(
        source=source,
        conf=args.conf,
        imgsz=args.imgsz,
        show=True,
        stream=True,
        verbose=False,
    )


if __name__ == "__main__":
    main()
