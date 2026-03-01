"""
Water Balance State Store — MySQL-backed via REST API.
Replaces in-memory storage with persistent database storage.

Hybrid strategy:
  - Base state (depletion, TAW, RAW, irrigation) → persisted to DB via REST API.
  - Lag histories (depletion/rain/etc 6h–24h) → kept in-memory cache,
    rebuilt naturally as prediction cycles run after restart.
  - soil_moist_history → persisted to DB (small window, needed for trend_1h).
"""

import logging
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Deque, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TREND_WINDOW = 6        # ~1h (mỗi 10 phút đọc 1 lần)
LAG_WINDOW_24H = 144    # ~24h (24*6=144 readings at 10-min interval)


@dataclass
class LayerState:
    """State cho một tầng đất (shallow hoặc deep)."""
    depletion: float = 0.0   # mm
    taw: float = 0.0         # Total Available Water (mm)
    raw: float = 0.0         # Readily Available Water (mm)


@dataclass
class WaterBalanceState:
    """Multi-layer state cho một device."""
    shallow: LayerState = field(default_factory=LayerState)
    deep: LayerState = field(default_factory=LayerState)
    last_irrigation: float = 0.0  # mm — lượng tưới lần cuối
    last_updated: datetime = field(default_factory=datetime.now)
    # Soil moisture trend tracking (for soil_moist_trend_1h)
    soil_moist_history: Deque[Tuple[datetime, float]] = field(
        default_factory=lambda: deque(maxlen=TREND_WINDOW)
    )
    # Lag feature tracking (24h window covers 6h/12h/24h queries)
    depletion_history: Deque[Tuple[datetime, float]] = field(
        default_factory=lambda: deque(maxlen=LAG_WINDOW_24H)
    )
    rain_history: Deque[Tuple[datetime, float]] = field(
        default_factory=lambda: deque(maxlen=LAG_WINDOW_24H)
    )
    etc_history: Deque[Tuple[datetime, float]] = field(
        default_factory=lambda: deque(maxlen=LAG_WINDOW_24H)
    )

    @property
    def weighted_depletion(self) -> float:
        """Weighted average depletion: 60% deep + 40% shallow."""
        return 0.6 * self.deep.depletion + 0.4 * self.shallow.depletion

    @property
    def total_taw(self) -> float:
        return self.shallow.taw + self.deep.taw

    @property
    def total_raw(self) -> float:
        return self.shallow.raw + self.deep.raw


class WaterBalanceStore:
    """
    MySQL-backed store via REST API, key = device_id.
    In-memory cache for lag histories + fast synchronous access.
    Base state synced to DB in background for persistence across restarts.
    """

    def __init__(self, backend_url: Optional[str] = None):
        self.backend_url = backend_url or settings.BACKEND_URL
        self._cache: Dict[int, WaterBalanceState] = {}
        self._client = httpx.AsyncClient(timeout=5.0)

    def _api_url(self, device_id: int) -> str:
        return f"{self.backend_url}/devices/{device_id}/water-balance-state"

    # ── Async API operations ───────────────────────────────────

    async def _fetch_state(self, device_id: int) -> WaterBalanceState:
        """Fetch base state from backend API, merge with cached lag histories."""
        try:
            url = self._api_url(device_id)
            response = await self._client.get(url)
            response.raise_for_status()
            data = response.json()

            if data.get("success") and data.get("data"):
                state = self._deserialize_state(data["data"])
                self._restore_lag_from_cache(device_id, state)
                return state
            else:
                logger.warning("API returned non-success for device %s", device_id)
                return self._cache.get(device_id, self._create_default_state())
        except httpx.HTTPError as e:
            logger.error("Failed to fetch state for device %s: %s", device_id, e)
            return self._cache.get(device_id, self._create_default_state())
        except Exception as e:
            logger.error("Unexpected error fetching state for device %s: %s", device_id, e)
            return self._cache.get(device_id, self._create_default_state())

    async def _update_state_api(
        self,
        device_id: int,
        shallow_depletion: float,
        deep_depletion: float,
        shallow_taw: float,
        deep_taw: float,
        shallow_raw: float,
        deep_raw: float,
        irrigation: float = 0.0,
        soil_moist_avg: float = 50.0,
        rain: float = 0.0,
        etc: float = 0.0,
    ) -> WaterBalanceState:
        """Persist base state to backend API."""
        try:
            url = self._api_url(device_id)

            soil_history_payload: List[dict] = []
            cached = self._cache.get(device_id)
            if cached and cached.soil_moist_history:
                for dt, val in cached.soil_moist_history:
                    soil_history_payload.append({
                        "timestamp": dt.isoformat(),
                        "value": val,
                    })
            soil_history_payload.append({
                "timestamp": datetime.now().isoformat(),
                "value": soil_moist_avg,
            })
            if len(soil_history_payload) > TREND_WINDOW:
                soil_history_payload = soil_history_payload[-TREND_WINDOW:]

            payload = {
                "shallowDepletion": shallow_depletion,
                "deepDepletion": deep_depletion,
                "shallowTaw": shallow_taw,
                "deepTaw": deep_taw,
                "shallowRaw": shallow_raw,
                "deepRaw": deep_raw,
                "lastIrrigation": irrigation,
                "soilMoisAvg": soil_moist_avg,
                "soilMoisHistory": soil_history_payload,
            }

            response = await self._client.put(url, json=payload)
            response.raise_for_status()
            data = response.json()

            if data.get("success") and data.get("data"):
                state = self._deserialize_state(data["data"])
                self._restore_lag_from_cache(device_id, state)
                return state
            else:
                logger.warning("API update non-success for device %s", device_id)
                return self._update_state_memory(
                    device_id, shallow_depletion, deep_depletion,
                    shallow_taw, deep_taw, shallow_raw, deep_raw,
                    irrigation, soil_moist_avg, rain, etc,
                )
        except httpx.HTTPError as e:
            logger.error("Failed to update state via API for device %s: %s", device_id, e)
            return self._update_state_memory(
                device_id, shallow_depletion, deep_depletion,
                shallow_taw, deep_taw, shallow_raw, deep_raw,
                irrigation, soil_moist_avg, rain, etc,
            )
        except Exception as e:
            logger.error("Unexpected error updating state for device %s: %s", device_id, e)
            return self._update_state_memory(
                device_id, shallow_depletion, deep_depletion,
                shallow_taw, deep_taw, shallow_raw, deep_raw,
                irrigation, soil_moist_avg, rain, etc,
            )

    # ── Synchronous public interface (used by preprocessing) ──

    def get_state(self, device_id: int) -> WaterBalanceState:
        """Get state synchronously from cache, or create default."""
        if device_id in self._cache:
            return self._cache[device_id]

        logger.debug("State not in cache for device %s, returning default", device_id)
        state = self._create_default_state()
        self._cache[device_id] = state
        return state

    async def get_state_async(self, device_id: int) -> WaterBalanceState:
        """Get state asynchronously (fetch from DB, update cache)."""
        state = await self._fetch_state(device_id)
        self._cache[device_id] = state
        return state

    def update_state(
        self,
        device_id: int,
        shallow_depletion: float,
        deep_depletion: float,
        shallow_taw: float,
        deep_taw: float,
        shallow_raw: float,
        deep_raw: float,
        irrigation: float = 0.0,
        soil_moist_avg: float = 50.0,
        rain: float = 0.0,
        etc: float = 0.0,
    ) -> WaterBalanceState:
        """
        Update state synchronously.
        Cache updated immediately; DB synced in background.
        """
        state = self._update_state_memory(
            device_id, shallow_depletion, deep_depletion,
            shallow_taw, deep_taw, shallow_raw, deep_raw,
            irrigation, soil_moist_avg, rain, etc,
        )

        try:
            import asyncio
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(self._update_state_api(
                    device_id, shallow_depletion, deep_depletion,
                    shallow_taw, deep_taw, shallow_raw, deep_raw,
                    irrigation, soil_moist_avg, rain, etc,
                ))
            else:
                loop.run_until_complete(self._update_state_api(
                    device_id, shallow_depletion, deep_depletion,
                    shallow_taw, deep_taw, shallow_raw, deep_raw,
                    irrigation, soil_moist_avg, rain, etc,
                ))
        except RuntimeError:
            logger.debug("No event loop, skipping async DB sync for device %s", device_id)
        except Exception as e:
            logger.warning("Failed to sync state to DB for device %s: %s", device_id, e)

        return state

    async def update_state_async(
        self,
        device_id: int,
        shallow_depletion: float,
        deep_depletion: float,
        shallow_taw: float,
        deep_taw: float,
        shallow_raw: float,
        deep_raw: float,
        irrigation: float = 0.0,
        soil_moist_avg: float = 50.0,
        rain: float = 0.0,
        etc: float = 0.0,
    ) -> WaterBalanceState:
        """Update state asynchronously (cache + API)."""
        self._update_state_memory(
            device_id, shallow_depletion, deep_depletion,
            shallow_taw, deep_taw, shallow_raw, deep_raw,
            irrigation, soil_moist_avg, rain, etc,
        )
        state = await self._update_state_api(
            device_id, shallow_depletion, deep_depletion,
            shallow_taw, deep_taw, shallow_raw, deep_raw,
            irrigation, soil_moist_avg, rain, etc,
        )
        self._cache[device_id] = state
        return state

    # ── Soil moisture trend ────────────────────────────────────

    def get_soil_moist_trend(self, device_id: int) -> float:
        """
        Soil moisture trend over ~1h (mm/h equivalent).
        Positive = wetter, negative = drying.
        """
        state = self.get_state(device_id)
        history = state.soil_moist_history

        if len(history) < 2:
            return 0.0

        oldest_time, oldest_val = history[0]
        newest_time, newest_val = history[-1]

        elapsed_hours = (newest_time - oldest_time).total_seconds() / 3600.0
        if elapsed_hours < 0.01:
            return 0.0

        return (newest_val - oldest_val) / elapsed_hours

    # ── 6h lag features ────────────────────────────────────────

    def get_depletion_trend_6h(self, device_id: int) -> float:
        return self._lag_trend(self.get_state(device_id).depletion_history, hours=6)

    def get_rain_last_6h(self, device_id: int) -> float:
        return self._lag_sum(self.get_state(device_id).rain_history, hours=6)

    def get_etc_rolling_6h(self, device_id: int) -> float:
        return self._lag_mean(self.get_state(device_id).etc_history, hours=6)

    # ── 12h lag features ───────────────────────────────────────

    def get_depletion_trend_12h(self, device_id: int) -> float:
        return self._lag_trend(self.get_state(device_id).depletion_history, hours=12)

    def get_rain_last_12h(self, device_id: int) -> float:
        return self._lag_sum(self.get_state(device_id).rain_history, hours=12)

    def get_etc_rolling_12h(self, device_id: int) -> float:
        return self._lag_mean(self.get_state(device_id).etc_history, hours=12)

    # ── 24h lag features ───────────────────────────────────────

    def get_depletion_trend_24h(self, device_id: int) -> float:
        return self._lag_trend(self.get_state(device_id).depletion_history, hours=24)

    def get_rain_last_24h(self, device_id: int) -> float:
        return self._lag_sum(self.get_state(device_id).rain_history, hours=24)

    # ── Lag computation helpers ────────────────────────────────

    @staticmethod
    def _lag_trend(history: Deque[Tuple[datetime, float]], hours: int = 6) -> float:
        if len(history) < 2:
            return 0.0
        cutoff = datetime.now() - timedelta(hours=hours)
        vals = [(t, v) for t, v in history if t >= cutoff]
        if len(vals) < 2:
            vals = list(history)
        if len(vals) < 2:
            return 0.0
        return vals[-1][1] - vals[0][1]

    @staticmethod
    def _lag_sum(history: Deque[Tuple[datetime, float]], hours: int = 6) -> float:
        cutoff = datetime.now() - timedelta(hours=hours)
        return sum(v for t, v in history if t >= cutoff)

    @staticmethod
    def _lag_mean(history: Deque[Tuple[datetime, float]], hours: int = 6) -> float:
        cutoff = datetime.now() - timedelta(hours=hours)
        values = [v for t, v in history if t >= cutoff]
        return sum(values) / len(values) if values else 0.0

    # ── Internal helpers ───────────────────────────────────────

    def _update_state_memory(
        self,
        device_id: int,
        shallow_depletion: float,
        deep_depletion: float,
        shallow_taw: float,
        deep_taw: float,
        shallow_raw: float,
        deep_raw: float,
        irrigation: float,
        soil_moist_avg: float,
        rain: float = 0.0,
        etc: float = 0.0,
    ) -> WaterBalanceState:
        """Update state in memory cache (including lag histories)."""
        state = self.get_state(device_id)

        state.shallow.depletion = max(0.0, min(shallow_depletion, shallow_taw))
        state.shallow.taw = shallow_taw
        state.shallow.raw = shallow_raw
        state.deep.depletion = max(0.0, min(deep_depletion, deep_taw))
        state.deep.taw = deep_taw
        state.deep.raw = deep_raw
        state.last_irrigation = irrigation
        state.last_updated = datetime.now()

        now = datetime.now()
        state.soil_moist_history.append((now, soil_moist_avg))
        state.depletion_history.append((now, state.weighted_depletion))
        state.rain_history.append((now, rain))
        state.etc_history.append((now, etc))

        logger.debug(
            "Updated WB device=%s shallow_depl=%.2f deep_depl=%.2f "
            "weighted=%.2f taw=%.2f",
            device_id, shallow_depletion, deep_depletion,
            state.weighted_depletion, state.total_taw,
        )
        return state

    def _restore_lag_from_cache(self, device_id: int, state: WaterBalanceState):
        """Preserve lag histories from cache when API returns base-only state."""
        cached = self._cache.get(device_id)
        if cached is None:
            return
        if cached.depletion_history:
            state.depletion_history = cached.depletion_history
        if cached.rain_history:
            state.rain_history = cached.rain_history
        if cached.etc_history:
            state.etc_history = cached.etc_history

    def _create_default_state(self) -> WaterBalanceState:
        return WaterBalanceState()

    def _create_state_from_params(
        self,
        shallow_depletion: float,
        deep_depletion: float,
        shallow_taw: float,
        deep_taw: float,
        shallow_raw: float,
        deep_raw: float,
        irrigation: float,
        soil_moist_avg: float,
    ) -> WaterBalanceState:
        state = WaterBalanceState()
        state.shallow.depletion = max(0.0, min(shallow_depletion, shallow_taw))
        state.shallow.taw = shallow_taw
        state.shallow.raw = shallow_raw
        state.deep.depletion = max(0.0, min(deep_depletion, deep_taw))
        state.deep.taw = deep_taw
        state.deep.raw = deep_raw
        state.last_irrigation = irrigation
        state.last_updated = datetime.now()
        state.soil_moist_history.append((datetime.now(), soil_moist_avg))
        return state

    def _deserialize_state(self, data: dict) -> WaterBalanceState:
        """Deserialize base state from API response."""
        state = WaterBalanceState()

        state.shallow.depletion = float(data.get("shallowDepletion", 0.0))
        state.shallow.taw = float(data.get("shallowTaw", 0.0))
        state.shallow.raw = float(data.get("shallowRaw", 0.0))
        state.deep.depletion = float(data.get("deepDepletion", 0.0))
        state.deep.taw = float(data.get("deepTaw", 0.0))
        state.deep.raw = float(data.get("deepRaw", 0.0))
        state.last_irrigation = float(data.get("lastIrrigation", 0.0))

        if data.get("lastUpdated"):
            try:
                state.last_updated = datetime.fromisoformat(
                    data["lastUpdated"].replace("Z", "+00:00")
                )
            except Exception:
                state.last_updated = datetime.now()

        history_list = data.get("soilMoisHistory", [])
        if history_list:
            state.soil_moist_history = deque(maxlen=TREND_WINDOW)
            for entry in history_list:
                try:
                    ts = entry.get("timestamp", "")
                    val = float(entry.get("value", 0.0))
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    state.soil_moist_history.append((dt, val))
                except Exception as e:
                    logger.warning("Failed to parse history entry: %s", e)

        return state

    async def close(self):
        """Close HTTP client."""
        await self._client.aclose()


def compute_effective_rain(
    sensor_rain: int,
    forecast_rain_mm: Optional[float],
) -> float:
    """
    Tính lượng mưa hiệu quả (mm).
    - sensor_rain: 0/1 (binary detection)
    - forecast_rain_mm: lượng mưa dự báo từ OpenWeather (mm)
    """
    eff = 0.0

    if forecast_rain_mm is not None and forecast_rain_mm > 0:
        factor = 0.80 if forecast_rain_mm > 5 else 0.85
        eff += forecast_rain_mm * factor

    if sensor_rain == 1 and eff == 0:
        eff = 2.0

    return eff
