from __future__ import annotations
from fastapi import APIRouter
from services.morning_briefing import build_morning_briefing

router = APIRouter()

_cache: dict = {}

@router.get("/briefing/morning")
def morning_briefing():
    """Full 60-second AI morning briefing."""
    from datetime import datetime
    # Cache for 5 minutes
    key = datetime.now().strftime("%Y-%m-%d-%H-%M")[:-1]  # 10-min buckets
    if key not in _cache:
        _cache.clear()
        _cache[key] = build_morning_briefing()
    return _cache[key]
