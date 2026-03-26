"""Evaluate best.pt on test set"""
from ultralytics import YOLO

best_pt = r'd:\DoAn_Garden\smart_garden\ai-service\runs\tomato_detect\yolo11s_tomato\weights\best.pt'
data_yaml = r'd:\DoAn_Garden\smart_garden\ai-service\dataforYolo\tomato_detection\data.yaml'

model = YOLO(best_pt)
print('=== EVALUATING ON TEST SET ===')
metrics = model.val(
    data=data_yaml,
    split='test',
    batch=8,
    imgsz=640,
    device=0,
    workers=0,
    plots=True,
    verbose=True,
    project=r'd:\DoAn_Garden\smart_garden\ai-service\runs\tomato_detect',
    name='test_eval',
    exist_ok=True,
)

print()
print('=' * 60)
print('TEST SET RESULTS')
print('=' * 60)
print(f'mAP50:    {metrics.box.map50:.4f}')
print(f'mAP50-95: {metrics.box.map:.4f}')
print(f'Precision: {metrics.box.mp:.4f}')
print(f'Recall:    {metrics.box.mr:.4f}')
print()

names = metrics.names
ap50 = metrics.box.ap50
ap = metrics.box.ap
header = f"{'Class':<50s} {'AP50':>8s} {'AP50-95':>8s}"
print(header)
print('-' * 70)
for i in range(len(names)):
    print(f'{names[i]:<50s} {ap50[i]:>8.4f} {ap[i]:>8.4f}')
print('-' * 70)
avg_label = 'ALL (mean)'
print(f'{avg_label:<50s} {metrics.box.map50:>8.4f} {metrics.box.map:>8.4f}')

# Save to file
with open(r'd:\DoAn_Garden\smart_garden\ai-service\runs\tomato_detect\test_results.txt', 'w') as f:
    f.write(f'mAP50:    {metrics.box.map50:.4f}\n')
    f.write(f'mAP50-95: {metrics.box.map:.4f}\n')
    f.write(f'Precision: {metrics.box.mp:.4f}\n')
    f.write(f'Recall:    {metrics.box.mr:.4f}\n\n')
    f.write(header + '\n')
    f.write('-' * 70 + '\n')
    for i in range(len(names)):
        f.write(f'{names[i]:<50s} {ap50[i]:>8.4f} {ap[i]:>8.4f}\n')
    f.write('-' * 70 + '\n')
    f.write(f'{avg_label:<50s} {metrics.box.map50:>8.4f} {metrics.box.map:>8.4f}\n')

print('\nResults saved to runs/tomato_detect/test_results.txt')
