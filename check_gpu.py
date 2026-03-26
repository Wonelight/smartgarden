import torch

info = []
info.append(f"CUDA: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    info.append(f"Device: {torch.cuda.get_device_name(0)}")
    info.append(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    info.append("Device: CPU")

with open("d:/DoAn_Garden/smart_garden/gpu_info.txt", "w") as f:
    f.write("\n".join(info))
