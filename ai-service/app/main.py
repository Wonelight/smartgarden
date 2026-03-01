"""
FastAPI entry point for AI Service.
Receives sensor data from Spring Boot backend,
provides ML prediction endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging_config import setup_logging

setup_logging()

app = FastAPI(
    title=settings.APP_NAME,
    description="AI Service cho Smart Garden — nhận sensor data, cung cấp dự đoán tưới tiêu.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────
app.include_router(api_router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }
