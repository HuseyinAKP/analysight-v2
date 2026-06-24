from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.real_data import get_ohlcv
from services.risk_engine import calc_risk, calc_advanced_risk

router = APIRouter()


class RiskRequest(BaseModel):
    entry_price: Optional[float] = None
    account_size: float = 100_000
    risk_pct: float = 1.0


class AdvancedRiskRequest(BaseModel):
    entry_price: Optional[float] = None
    account_size: float = 100_000
    risk_pct: float = 1.0
    stop_method: str = "atr"          # "atr" | "manual" | "swing_low" | "pct"
    manual_stop: Optional[float] = None
    stop_pct_manual: Optional[float] = None
    atr_multiplier: float = 1.5
    target_rr: float = 2.0            # desired R/R ratio


@router.post("/{symbol}")
def calculate_risk(symbol: str, body: RiskRequest):
    symbol = symbol.upper()
    df = get_ohlcv(symbol, days=60)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return calc_risk(df, body.entry_price, body.account_size, body.risk_pct)


@router.get("/{symbol}")
def get_risk_defaults(symbol: str):
    symbol = symbol.upper()
    df = get_ohlcv(symbol, days=60)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return calc_risk(df)


@router.post("/{symbol}/advanced")
def calculate_advanced_risk(symbol: str, body: AdvancedRiskRequest):
    symbol = symbol.upper()
    df = get_ohlcv(symbol, days=100)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return calc_advanced_risk(
        df,
        entry_price=body.entry_price,
        account_size=body.account_size,
        risk_pct=body.risk_pct,
        stop_method=body.stop_method,
        manual_stop=body.manual_stop,
        stop_pct_manual=body.stop_pct_manual,
        atr_multiplier=body.atr_multiplier,
        target_rr=body.target_rr,
    )
