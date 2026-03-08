import requests
import json
import sys

# Ensure utf-8 output for console
sys.stdout.reconfigure(encoding='utf-8')

urls = [
    "http://localhost:5000/ai/predict",
    "http://localhost:5000/api/v1/ai/predict",
    "http://localhost:5000/predict"
]

payload = {
    "device_id": 1,
    "sensor_data_id": 100,
    "sensors": {
        "temp": 30.5,
        "humidity": 65.0,
        "soil_moist1": 10,
        "soil_moist2": 15,
        "rain": 0,
        "light": 45000
    },
    "openweather": {
        "temperature": 31.0,
        "humidity": 62.0,
        "wind_speed": 2.5,
        "forecast_rain": 0.0,
        "daily_forecasts": [
            {"date": "2026-03-06", "total_rain": 1.0, "avg_clouds": 30.0},
            {"date": "2026-03-07", "total_rain": 15.2, "avg_clouds": 60.0},
            {"date": "2026-03-08", "total_rain": 0.0, "avg_clouds": 20.0}
        ]
    },
    "crop": {
        "type": "tomato",
        "growth_stage": "mid",
        "kc_current": 1.15,
        "root_depth": 0.5,
        "field_capacity": 30.0,
        "wilting_point": 15.0,
        "depletion_fraction": 0.5,
        "soil_type": "loam",
        "crop_height": 0.6,
        "latitude": 21.03,
        "altitude": 12.0
    }
}

headers = {
    "Content-Type": "application/json"
}

success = False
for url in urls:
    print(f"Thử gửi request tới {url}...")
    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        print("\n[THÀNH CÔNG] API trả về kết quả:")
        print(json.dumps(response.json(), indent=2, ensure_ascii=False))
        success = True
        break
    except requests.exceptions.RequestException as e:
        print(f" -> Lỗi: {e}")
        if response is not None and response.status_code != 404:
            print("Response text:", response.text)

if not success:
    print("\n[THẤT BẠI] Tất cả URL đều không truy cập được.")
