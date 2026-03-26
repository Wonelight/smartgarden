"""
Prepare Tomato Disease Dataset for YOLO11 Training
───────────────────────────────────────────────────
Pools all images+labels from train/valid/test of the archive dataset,
then performs a stratified re-split (80/10/10) so every class appears
in every split.

Output: dataforYolo/tomato_detection/  (ready for YOLO training)
"""

import os
import random
import shutil
import yaml
from collections import defaultdict
from pathlib import Path

SEED = 42
TRAIN_RATIO = 0.80
VALID_RATIO = 0.10
# TEST_RATIO = 0.10 (remainder)

SCRIPT_DIR = Path(__file__).resolve().parent
ARCHIVE_DIR = SCRIPT_DIR / "dataforYolo" / "archive"
OUTPUT_DIR = SCRIPT_DIR / "dataforYolo" / "tomato_detection"
REPORT_FILE = SCRIPT_DIR / "dataforYolo" / "prepare_report.txt"

CLASS_NAMES = [
    "Tomato Bacterial Spot",
    "Tomato Early blight",
    "Tomato Late blight",
    "Tomato Leaf Mold",
    "Tomato Septoria leaf spot",
    "Tomato Spider mites Two-spotted spider mite",
    "Tomato Target Spot",
    "Tomato Yellow Leaf Curl Virus",
    "Tomato healthy",
    "Tomato mosaic virus",
]


def get_primary_class(label_path: Path) -> int:
    """Read first annotation line and return the class ID."""
    with open(label_path, "r") as f:
        for line in f:
            parts = line.strip().split()
            if parts:
                return int(parts[0])
    return -1  # empty label


def collect_all_samples(archive: Path) -> dict:
    """Collect all (image, label) pairs grouped by class from all splits."""
    class_samples = defaultdict(list)  # class_id -> [(img_path, label_path)]

    for split in ["train", "valid", "test"]:
        img_dir = archive / split / "images"
        lbl_dir = archive / split / "labels"

        if not img_dir.exists():
            continue

        for img_file in img_dir.iterdir():
            if img_file.suffix.lower() not in (".jpg", ".jpeg", ".png", ".bmp"):
                continue

            lbl_file = lbl_dir / (img_file.stem + ".txt")
            if not lbl_file.exists():
                continue

            cls_id = get_primary_class(lbl_file)
            if cls_id < 0:
                continue

            class_samples[cls_id].append((img_file, lbl_file))

    return class_samples


def stratified_split(class_samples: dict, train_r: float, valid_r: float, seed: int):
    """Split samples per class into train/valid/test."""
    rng = random.Random(seed)
    train, valid, test = [], [], []

    for cls_id in sorted(class_samples.keys()):
        samples = class_samples[cls_id][:]
        rng.shuffle(samples)

        n = len(samples)
        n_train = max(1, int(n * train_r))
        n_valid = max(1, int(n * valid_r))

        train.extend(samples[:n_train])
        valid.extend(samples[n_train : n_train + n_valid])
        test.extend(samples[n_train + n_valid :])

    # Shuffle within splits
    rng.shuffle(train)
    rng.shuffle(valid)
    rng.shuffle(test)

    return train, valid, test


def copy_samples(samples: list, split_name: str, output_dir: Path):
    """Copy image+label pairs to output split directory."""
    img_out = output_dir / split_name / "images"
    lbl_out = output_dir / split_name / "labels"
    img_out.mkdir(parents=True, exist_ok=True)
    lbl_out.mkdir(parents=True, exist_ok=True)

    for img_src, lbl_src in samples:
        shutil.copy2(img_src, img_out / img_src.name)
        shutil.copy2(lbl_src, lbl_out / lbl_src.name)


def write_data_yaml(output_dir: Path, class_names: list):
    """Write data.yaml for Ultralytics YOLO training."""
    data = {
        "path": str(output_dir),
        "train": "train/images",
        "val": "valid/images",
        "test": "test/images",
        "nc": len(class_names),
        "names": class_names,
    }
    yaml_path = output_dir / "data.yaml"
    with open(yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, default_flow_style=False, allow_unicode=True)
    return yaml_path


def generate_report(class_samples, train, valid, test, class_names) -> str:
    """Generate a text report of the split statistics."""
    lines = ["=" * 60, "TOMATO DETECTION DATASET — STRATIFIED SPLIT REPORT", "=" * 60, ""]

    # Count per class in each split
    def count_classes(samples):
        from collections import Counter
        c = Counter()
        for img, lbl in samples:
            c[get_primary_class(lbl)] += 1
        return c

    tc = count_classes(train)
    vc = count_classes(valid)
    sc = count_classes(test)

    lines.append(f"{'Class':<50s} {'Train':>6s} {'Valid':>6s} {'Test':>6s} {'Total':>6s}")
    lines.append("-" * 75)
    for i in range(len(class_names)):
        t, v, s = tc.get(i, 0), vc.get(i, 0), sc.get(i, 0)
        lines.append(f"{i}: {class_names[i]:<47s} {t:>6d} {v:>6d} {s:>6d} {t+v+s:>6d}")

    lines.append("-" * 75)
    lines.append(f"{'TOTAL':<50s} {len(train):>6d} {len(valid):>6d} {len(test):>6d} {len(train)+len(valid)+len(test):>6d}")
    lines.append("")
    lines.append(f"Split ratios: {len(train)/(len(train)+len(valid)+len(test))*100:.1f}% / "
                 f"{len(valid)/(len(train)+len(valid)+len(test))*100:.1f}% / "
                 f"{len(test)/(len(train)+len(valid)+len(test))*100:.1f}%")
    return "\n".join(lines)


def main():
    print("Collecting samples from archive...")
    class_samples = collect_all_samples(ARCHIVE_DIR)

    total = sum(len(v) for v in class_samples.values())
    print(f"  Found {total} annotated images across {len(class_samples)} classes")

    print("Performing stratified split...")
    train, valid, test = stratified_split(class_samples, TRAIN_RATIO, VALID_RATIO, SEED)
    print(f"  Train: {len(train)}  Valid: {len(valid)}  Test: {len(test)}")

    # Clean output directory
    if OUTPUT_DIR.exists():
        # On Windows, rmtree can fail due to file locks.
        # Use a rename-then-delete approach, or just remove files individually.
        import time
        tmp = OUTPUT_DIR.parent / f"_old_{int(time.time())}"
        try:
            OUTPUT_DIR.rename(tmp)
            shutil.rmtree(tmp, ignore_errors=True)
        except OSError:
            # If rename fails, just clean subdirectories individually
            for sub in OUTPUT_DIR.rglob("*"):
                if sub.is_file():
                    try:
                        sub.unlink()
                    except OSError:
                        pass
            for sub in sorted(OUTPUT_DIR.rglob("*"), reverse=True):
                if sub.is_dir():
                    try:
                        sub.rmdir()
                    except OSError:
                        pass
            try:
                OUTPUT_DIR.rmdir()
            except OSError:
                pass

    print("Copying files to output directory...")
    copy_samples(train, "train", OUTPUT_DIR)
    copy_samples(valid, "valid", OUTPUT_DIR)
    copy_samples(test, "test", OUTPUT_DIR)

    print("Writing data.yaml...")
    yaml_path = write_data_yaml(OUTPUT_DIR, CLASS_NAMES)
    print(f"  {yaml_path}")

    report = generate_report(class_samples, train, valid, test, CLASS_NAMES)
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\nReport saved to: {REPORT_FILE}")
    print(report)


if __name__ == "__main__":
    log = open(str(REPORT_FILE).replace("prepare_report", "prepare_log"), "w", encoding="utf-8")
    try:
        log.write("Starting prepare script...\n")
        log.flush()
        main()
        log.write("Done!\n")
    except Exception as e:
        import traceback
        log.write(f"ERROR: {e}\n")
        log.write(traceback.format_exc())
    finally:
        log.close()
