from __future__ import annotations
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from services.scanner import run_scan, ScanFilter, PRESET_FILTERS, PRESET_GROUPS
from services.alerts import (
    create_alert, list_alerts, delete_alert, toggle_alert, check_alerts, CONDITION_TYPES
)
from services.tradingview_webhook import enrich_tradingview_alert, get_alert_feed
from services.mock_data import generate_ohlcv, MOCK_SYMBOLS
from services.technical_analysis import build_indicators
from services.scenario_engine import build_scenarios
from services.watchlist_scan import scan_watchlist

router = APIRouter()


# ── Scanner ──────────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    rsi_min: Optional[float] = None
    rsi_max: Optional[float] = None
    macd_bullish: Optional[bool] = None
    price_above_ema20: Optional[bool] = None
    price_above_ema50: Optional[bool] = None
    adx_min: Optional[float] = None
    uncertainty_max: Optional[float] = None
    bull_prob_min: Optional[float] = None
    bb_position: Optional[str] = None
    stoch_signal: Optional[str] = None
    markets: list[str] = []


@router.get("/scan/presets")
def scan_presets():
    return [
        {"id": k, "label": v.label, "emoji": v.emoji, "description": v.description}
        for k, v in PRESET_FILTERS.items()
    ]


@router.get("/scan/preset-groups")
def scan_preset_groups():
    """Preset gruplarını döner — UI için kategorilere ayrılmış."""
    groups = []
    for group_label, preset_ids in PRESET_GROUPS.items():
        presets = []
        for pid in preset_ids:
            if pid in PRESET_FILTERS:
                f = PRESET_FILTERS[pid]
                presets.append({"id": pid, "label": f.label, "emoji": f.emoji, "description": f.description})
        groups.append({"group": group_label, "presets": presets})
    return groups


@router.get("/scan/watchlist")
def watchlist_scan():
    """Scan default watchlist — ranked AI commentary per symbol."""
    return scan_watchlist()


@router.get("/scan/preset/{preset_id}")
def scan_preset(preset_id: str):
    if preset_id not in PRESET_FILTERS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Preset not found")
    return run_scan(PRESET_FILTERS[preset_id])


@router.post("/scan/custom")
def scan_custom(body: ScanRequest):
    f = ScanFilter(
        rsi_min=body.rsi_min, rsi_max=body.rsi_max,
        macd_bullish=body.macd_bullish,
        price_above_ema20=body.price_above_ema20,
        price_above_ema50=body.price_above_ema50,
        adx_min=body.adx_min,
        uncertainty_max=body.uncertainty_max,
        bull_prob_min=body.bull_prob_min,
        bb_position=body.bb_position,
        stoch_signal=body.stoch_signal,
        markets=body.markets,
    )
    return run_scan(f)


# ── Alerts ───────────────────────────────────────────────────────────────────

class AlertRequest(BaseModel):
    symbol: str
    condition_type: str
    threshold: float
    notify_channels: list[str] = ["in_app"]
    label: Optional[str] = None


@router.get("/alerts/conditions")
def alert_conditions():
    return [{"id": k, "label": v} for k, v in CONDITION_TYPES.items()]


@router.get("/alerts")
def get_alerts():
    return list_alerts()


@router.post("/alerts")
def add_alert(body: AlertRequest):
    return create_alert(
        symbol=body.symbol,
        condition_type=body.condition_type,
        threshold=body.threshold,
        notify_channels=body.notify_channels,
        label=body.label,
    )


@router.delete("/alerts/{alert_id}")
def remove_alert(alert_id: str):
    ok = delete_alert(alert_id)
    return {"ok": ok}


@router.patch("/alerts/{alert_id}/toggle")
def toggle(alert_id: str):
    return toggle_alert(alert_id)


@router.get("/alerts/check/{symbol}")
def check(symbol: str):
    s = symbol.upper()
    if s not in MOCK_SYMBOLS:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Symbol not found")
    df  = generate_ohlcv(s, days=180)
    ind = build_indicators(df)
    sc  = build_scenarios(df)
    return check_alerts(s, ind, sc)


# ── TradingView Webhook ───────────────────────────────────────────────────────

class TVPayload(BaseModel):
    symbol: str
    price: Optional[float] = None
    condition: str = ""
    timeframe: str = ""


@router.post("/webhook/tradingview")
def tradingview_webhook(body: TVPayload):
    return enrich_tradingview_alert(body.model_dump())


@router.get("/webhook/tradingview/feed")
def tradingview_feed():
    """Alert feed — son 50 TradingView alert'i döner."""
    return {"alerts": get_alert_feed(), "count": len(get_alert_feed())}


@router.get("/webhook/tradingview/test/{symbol}")
def tradingview_test(symbol: str):
    """Test endpoint — TV webhook'unu simüle eder"""
    return enrich_tradingview_alert({
        "symbol": symbol,
        "condition": "EMA20 yukarı kesti (test)",
        "timeframe": "1D",
    })
