"""
Insights router: market structure, event study, ML forecast,
news, social signals, why-chain.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from services.real_data import get_ohlcv
from services.technical_analysis import build_indicators
from services.market_structure import calc_adx, calc_stochastic, detect_structure
from services.event_study import find_similar_events
from services.ml_forecast import forecast
from services.news_mock import get_news
from services.social_signal import get_social_signals, get_why_chain
from services.social_signals import get_social_signal, get_trending_social

router = APIRouter()


def _get_df(symbol: str):
    s = symbol.upper()
    df = get_ohlcv(s, days=180)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {s}")
    return s, df


@router.get("/{symbol}/structure")
def market_structure(symbol: str):
    s, df = _get_df(symbol)
    adx    = calc_adx(df)
    stoch  = calc_stochastic(df)
    struct = detect_structure(df)
    return {"adx": adx, "stochastic": stoch, "structure": struct}


@router.get("/{symbol}/events")
def event_study(symbol: str):
    s, df = _get_df(symbol)
    return find_similar_events(df)


@router.get("/{symbol}/forecast")
def ml_forecast(symbol: str):
    s, df = _get_df(symbol)
    return forecast(df)


@router.get("/{symbol}/news")
def news(symbol: str):
    s = symbol.upper()
    return {"items": get_news(s)}


@router.get("/{symbol}/social")
def social(symbol: str):
    """Twitter/X sosyal sinyal — gerçek API veya mock."""
    return get_social_signal(symbol)


@router.get("/{symbol}/why")
def why_chain(symbol: str):
    s, df = _get_df(symbol)
    ind  = build_indicators(df)
    news_items = get_news(s)
    soc  = get_social_signals(s)
    return get_why_chain(s, ind, news_items, soc)


# ── Trending social ───────────────────────────────────────────────────────────
@router.get("/social/trending")
def trending_social(limit: int = 10):
    """En çok bahsedilen semboller — X sosyal sinyal."""
    return get_trending_social(limit=limit)
