"""
Portfolio Analysis: Kullanıcı portföyü — pozisyon P&L, dağılım, risk metrikleri.
In-memory (DB'ye hazır yapı).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
import uuid
from .mock_data import generate_ohlcv, MOCK_SYMBOLS

_PORTFOLIOS: dict[str, list[dict]] = {"demo_user": []}


def _current_price(symbol: str) -> float:
    try:
        df = generate_ohlcv(symbol, days=5)
        return float(df["close"].iloc[-1])
    except Exception:
        return 0.0


def add_position(
    symbol: str,
    quantity: float,
    avg_cost: float,
    user_id: str = "demo_user",
    notes: str = "",
) -> dict:
    pos = {
        "id": str(uuid.uuid4())[:8],
        "symbol": symbol.upper(),
        "quantity": quantity,
        "avg_cost": avg_cost,
        "notes": notes,
        "added_at": datetime.now().isoformat(),
    }
    if user_id not in _PORTFOLIOS:
        _PORTFOLIOS[user_id] = []
    _PORTFOLIOS[user_id].append(pos)
    return _enrich(pos)


def remove_position(pos_id: str, user_id: str = "demo_user") -> bool:
    before = len(_PORTFOLIOS.get(user_id, []))
    _PORTFOLIOS[user_id] = [p for p in _PORTFOLIOS.get(user_id, []) if p["id"] != pos_id]
    return len(_PORTFOLIOS[user_id]) < before


def get_portfolio(user_id: str = "demo_user") -> dict:
    positions = _PORTFOLIOS.get(user_id, [])
    enriched = [_enrich(p) for p in positions]

    total_cost   = sum(e["cost_basis"] for e in enriched)
    total_value  = sum(e["market_value"] for e in enriched)
    total_pnl    = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost else 0

    # Allocation
    for e in enriched:
        e["allocation_pct"] = round(e["market_value"] / total_value * 100, 1) if total_value else 0

    # Market breakdown
    market_alloc: dict[str, float] = {}
    for e in enriched:
        mkt = MOCK_SYMBOLS.get(e["symbol"], {}).get("market", "Diğer")
        market_alloc[mkt] = market_alloc.get(mkt, 0) + e["market_value"]
    market_alloc_pct = {k: round(v / total_value * 100, 1) if total_value else 0 for k, v in market_alloc.items()}

    # Best / worst
    winners = sorted(enriched, key=lambda x: x["pnl_pct"], reverse=True)

    return {
        "positions": enriched,
        "summary": {
            "total_cost": round(total_cost, 2),
            "total_value": round(total_value, 2),
            "total_pnl": round(total_pnl, 2),
            "total_pnl_pct": round(total_pnl_pct, 2),
            "position_count": len(enriched),
            "profitable_count": sum(1 for e in enriched if e["pnl"] >= 0),
        },
        "market_allocation": market_alloc_pct,
        "top_winners": winners[:3] if winners else [],
        "top_losers": list(reversed(winners))[:3] if winners else [],
    }


def _enrich(pos: dict) -> dict:
    symbol = pos["symbol"]
    curr = _current_price(symbol)
    cost_basis   = pos["quantity"] * pos["avg_cost"]
    market_value = pos["quantity"] * curr
    pnl          = market_value - cost_basis
    pnl_pct      = (pnl / cost_basis * 100) if cost_basis else 0
    meta = MOCK_SYMBOLS.get(symbol, {})
    return {
        **pos,
        "current_price": round(curr, 2),
        "cost_basis":    round(cost_basis, 2),
        "market_value":  round(market_value, 2),
        "pnl":           round(pnl, 2),
        "pnl_pct":       round(pnl_pct, 2),
        "name":          meta.get("name", symbol),
        "market":        meta.get("market", ""),
        "currency":      meta.get("currency", "TRY"),
    }
