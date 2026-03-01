"""V1 API router — gộp tất cả endpoint routers."""

from fastapi import APIRouter

from app.api.v1.endpoints import health, irrigation

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(irrigation.router, prefix="/ai", tags=["AI / Irrigation"])
