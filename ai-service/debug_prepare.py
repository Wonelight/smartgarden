"""Quick test to debug prepare script."""
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ARCHIVE_DIR = SCRIPT_DIR / "dataforYolo" / "archive"
OUTPUT_DIR = SCRIPT_DIR / "dataforYolo" / "tomato_detection"
REPORT = SCRIPT_DIR / "dataforYolo" / "debug_output.txt"

lines = []
lines.append(f"SCRIPT_DIR: {SCRIPT_DIR}")
lines.append(f"ARCHIVE_DIR: {ARCHIVE_DIR}")
lines.append(f"ARCHIVE exists: {ARCHIVE_DIR.exists()}")

for split in ["train", "valid", "test"]:
    img_dir = ARCHIVE_DIR / split / "images"
    lbl_dir = ARCHIVE_DIR / split / "labels"
    lines.append(f"{split}/images exists: {img_dir.exists()}")
    lines.append(f"{split}/labels exists: {lbl_dir.exists()}")
    if img_dir.exists():
        imgs = [f for f in img_dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")]
        lines.append(f"  {split} images count: {len(imgs)}")
        if imgs:
            lines.append(f"  first: {imgs[0].name}")
            lbl = lbl_dir / (imgs[0].stem + ".txt")
            lines.append(f"  label exists: {lbl.exists()}")
            if lbl.exists():
                with open(lbl) as fh:
                    lines.append(f"  label content: {fh.readline().strip()}")

try:
    import yaml
    lines.append("yaml import: OK")
except ImportError:
    lines.append("yaml import: FAILED")

with open(REPORT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
