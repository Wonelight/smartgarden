import json
import sys
from fastapi.testclient import TestClient
from app.main import app

sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

payload = {
    "device_id": 1,
    "sensor_data_id": 100,
    "sensors": {
        "temp": 30.5,
        "humidity": 65.0,
        "soil_moist1": 42.0,
        "soil_moist2": 38.0,
        "rain": 0,
        "light": 45000
    },
    "openweather": {
        "temperature": 31.0,
        "humidity": 62.0,
        "wind_speed": 2.5,
        "forecast_rain": 0.0,
        "daily_forecasts": [
            {"date": "2026-03-06", "total_rain": 0.0, "avg_clouds": 30.0},
            {"date": "2026-03-07", "total_rain": 5.2, "avg_clouds": 60.0},
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

try:
    response = client.post("/ai/predict", json=payload)
    print("STATUS_CODE:", response.status_code)
    try:
        print("JSON:", json.dumps(response.json(), indent=2, ensure_ascii=False))
    except BaseException:
        print("TEXT:", response.text)
except BaseException as e:
    print("EXCEPTION:", e)
