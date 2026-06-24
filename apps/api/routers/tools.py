"""
Earnings Reviewer, Market Researcher, Model Builder, Portfolio, ETF, Trade Setup router'ı.
"""
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.earnings import get_earnings, get_earnings_calendar
from services.market_research import get_market_overview, get_all_sectors, get_sector_research
from services.model_builder import run_dcf, run_multiples, run_scenario_model, DCF_TEMPLATES
from services.portfolio import add_position, remove_position, get_portfolio
from services.etf import get_etf, compare_etfs, ETF_LIST
from services.trade_setup import detect_setup
from services.market_updates import get_briefing, get_commentary, get_market_snapshot
from services.mock_data import generate_ohlcv, MOCK_SYMBOLS

router = APIRouter()


# ── Earnings Reviewer ─────────────────────────────────────────────────────────

@router.get("/earnings/calendar")
def earnings_calendar(days: int = 45):
    return get_earnings_calendar(days_ahead=days)


@router.get("/earnings/{symbol}")
def earnings_detail(symbol: str):
    data = get_earnings(symbol.upper())
    if data is None:
        raise HTTPException(status_code=404, detail=f"{symbol} için kazanç verisi bulunamadı (kripto desteklenmiyor)")
    return data


# ── Market Researcher ─────────────────────────────────────────────────────────

@router.get("/research/overview")
def market_overview():
    return get_market_overview()


@router.get("/research/sectors")
def all_sectors():
    return get_all_sectors()


@router.get("/research/sector/{sector_name}")
def sector_detail(sector_name: str):
    data = get_sector_research(sector_name)
    if not data:
        raise HTTPException(status_code=404, detail="Sektör bulunamadı")
    return data


# ── Model Builder ─────────────────────────────────────────────────────────────

class DCFRequest(BaseModel):
    symbol: str
    base_revenue: float
    revenue_growth_rates: list[float]
    ebitda_margin_pct: float
    tax_rate_pct: float
    capex_pct_revenue: float
    wacc_pct: float
    terminal_growth_pct: float
    net_debt: float
    shares_outstanding: float
    currency: str = "TRY"


class MultiplesRequest(BaseModel):
    symbol: str
    eps_ttm: float
    revenue_ttm: float
    ebitda_ttm: float
    book_value_per_share: float
    current_price: float
    sector_pe: float
    sector_ev_ebitda: float
    net_debt: float
    shares_outstanding: float
    currency: str = "TRY"


class ScenarioRequest(BaseModel):
    symbol: str
    base_dcf_value: float
    current_price: float
    bull_assumptions: dict
    bear_assumptions: dict
    currency: str = "TRY"


@router.get("/model/templates")
def dcf_templates():
    return list(DCF_TEMPLATES.keys())


@router.get("/model/template/{symbol}")
def get_template(symbol: str):
    t = DCF_TEMPLATES.get(symbol.upper())
    if not t:
        raise HTTPException(status_code=404, detail="Şablon bulunamadı")
    return {"symbol": symbol.upper(), **t}


@router.post("/model/dcf")
def dcf_model(body: DCFRequest):
    return run_dcf(
        symbol=body.symbol,
        base_revenue=body.base_revenue,
        revenue_growth_rates=body.revenue_growth_rates,
        ebitda_margin_pct=body.ebitda_margin_pct,
        tax_rate_pct=body.tax_rate_pct,
        capex_pct_revenue=body.capex_pct_revenue,
        wacc_pct=body.wacc_pct,
        terminal_growth_pct=body.terminal_growth_pct,
        net_debt=body.net_debt,
        shares_outstanding=body.shares_outstanding,
        currency=body.currency,
    )


@router.post("/model/multiples")
def multiples_model(body: MultiplesRequest):
    return run_multiples(
        symbol=body.symbol,
        eps_ttm=body.eps_ttm,
        revenue_ttm=body.revenue_ttm,
        ebitda_ttm=body.ebitda_ttm,
        book_value_per_share=body.book_value_per_share,
        current_price=body.current_price,
        sector_pe=body.sector_pe,
        sector_ev_ebitda=body.sector_ev_ebitda,
        net_debt=body.net_debt,
        shares_outstanding=body.shares_outstanding,
        currency=body.currency,
    )


@router.post("/model/scenario")
def scenario_model(body: ScenarioRequest):
    return run_scenario_model(
        symbol=body.symbol,
        base_dcf_value=body.base_dcf_value,
        current_price=body.current_price,
        bull_assumptions=body.bull_assumptions,
        bear_assumptions=body.bear_assumptions,
        currency=body.currency,
    )


# ── Portfolio ────────────────────────────────────────────────────────────────

class PositionRequest(BaseModel):
    symbol: str
    quantity: float
    avg_cost: float
    notes: str = ""


@router.get("/portfolio")
def portfolio():
    return get_portfolio()


@router.post("/portfolio")
def add_pos(body: PositionRequest):
    sym = body.symbol.upper()
    if sym not in MOCK_SYMBOLS:
        raise HTTPException(status_code=404, detail=f"{sym} bulunamadı")
    return add_position(sym, body.quantity, body.avg_cost, notes=body.notes)


@router.delete("/portfolio/{pos_id}")
def remove_pos(pos_id: str):
    ok = remove_position(pos_id)
    return {"ok": ok}


# ── ETF ──────────────────────────────────────────────────────────────────────

@router.get("/etf/list")
def etf_list():
    return ETF_LIST


@router.get("/etf/{symbol}")
def etf_detail(symbol: str):
    data = get_etf(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail="ETF bulunamadı")
    return {"symbol": symbol.upper(), **data}


@router.get("/etf/compare/{symbols}")
def etf_compare(symbols: str):
    syms = [s.strip().upper() for s in symbols.split(",")]
    return compare_etfs(syms)


# ── Trade Setup ──────────────────────────────────────────────────────────────

@router.get("/setup/{symbol}")
def trade_setup(symbol: str):
    sym = symbol.upper()
    if sym not in MOCK_SYMBOLS:
        raise HTTPException(status_code=404, detail="Sembol bulunamadı")
    df = generate_ohlcv(sym, days=200)
    return detect_setup(df)


# ── Market Updates / Briefing ─────────────────────────────────────────────────

@router.get("/briefing")
def briefing():
    return get_briefing()


@router.get("/commentary")
def commentary():
    return get_commentary()


@router.get("/snapshot")
def snapshot():
    return get_market_snapshot()
