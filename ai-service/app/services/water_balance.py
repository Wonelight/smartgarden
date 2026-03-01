"""
Water Balance State Store — thin re-export layer.

Primary: MySQL-backed store (water_balance_db.py) with in-memory lag cache.
The DB store caches all state locally and syncs to DB in background;
if the backend API is unreachable, it falls back to cache-only gracefully.
"""

import logging
from typing import Optional

from app.services.water_balance_db import (
    WaterBalanceState,
    WaterBalanceStore,
    LayerState,
    compute_effective_rain,
)

logger = logging.getLogger(__name__)

# Re-export for existing consumers (preprocessing_service, anfis_service, …)
__all__ = [
    "WaterBalanceState",
    "WaterBalanceStore",
    "LayerState",
    "compute_effective_rain",
    "water_balance_store",
]

water_balance_store = WaterBalanceStore()
logger.info("Water balance store initialized (DB-backed + in-memory lag cache)")
