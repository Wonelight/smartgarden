"""
Application settings via pydantic-settings.
Reads from .env file and environment variables.
"""

from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Application ────────────────────────────────────
    APP_NAME: str = "Smart Garden AI Service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── API ────────────────────────────────────────────
    API_V1_PREFIX: str = "/api/v1"

    # ── CORS ───────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:8081",
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    # ── Backend ────────────────────────────────────────
    BACKEND_URL: str = "http://localhost:8081/api"

    # ── ML Models ──────────────────────────────────────
    MODEL_DIR: str = "app/ml/pipelines"

    # ── Storage ────────────────────────────────────────
    USE_DB_STORAGE: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
