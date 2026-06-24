"""
Model Builder: Bireysel yatırımcı için interaktif değerleme modeli.
DCF (İndirgenmiş Nakit Akışı), Çarpan Analizi ve Senaryo Karşılaştırması.
"""
from __future__ import annotations
from typing import Optional
import math


def run_dcf(
    symbol: str,
    base_revenue: float,           # Son yıl gelir (milyon)
    revenue_growth_rates: list[float],  # Her yıl için büyüme oranı (%) — maks 10 yıl
    ebitda_margin_pct: float,      # EBITDA marjı %
    tax_rate_pct: float,           # Vergi oranı %
    capex_pct_revenue: float,      # CapEx / Gelir %
    wacc_pct: float,               # Ağırlıklı ortalama sermaye maliyeti %
    terminal_growth_pct: float,    # Sürekli büyüme oranı %
    net_debt: float,               # Net borç (milyon) — negatif = net nakit
    shares_outstanding: float,     # Hisse sayısı (milyon)
    currency: str = "TRY",
) -> dict:
    """
    Basit DCF değerlemesi.
    Her yıl FCF = EBITDA * (1 - vergi) - CapEx hesaplanır.
    """
    years = min(len(revenue_growth_rates), 10)
    wacc = wacc_pct / 100
    terminal_growth = terminal_growth_pct / 100

    projections = []
    current_revenue = base_revenue

    total_pv_fcf = 0.0
    for i, growth_rate in enumerate(revenue_growth_rates[:years], 1):
        current_revenue *= (1 + growth_rate / 100)
        ebitda = current_revenue * (ebitda_margin_pct / 100)
        nopat = ebitda * (1 - tax_rate_pct / 100)
        capex = current_revenue * (capex_pct_revenue / 100)
        fcf = nopat - capex
        discount_factor = 1 / ((1 + wacc) ** i)
        pv_fcf = fcf * discount_factor
        total_pv_fcf += pv_fcf

        projections.append({
            "year": f"Yıl {i}",
            "revenue": round(current_revenue, 1),
            "ebitda": round(ebitda, 1),
            "fcf": round(fcf, 1),
            "pv_fcf": round(pv_fcf, 1),
            "growth_rate": growth_rate,
        })

    # Terminal değer
    terminal_fcf = projections[-1]["fcf"] * (1 + terminal_growth) if projections else 0
    terminal_value = terminal_fcf / (wacc - terminal_growth) if wacc > terminal_growth else 0
    pv_terminal = terminal_value / ((1 + wacc) ** years)

    enterprise_value = total_pv_fcf + pv_terminal
    equity_value = enterprise_value - net_debt
    intrinsic_per_share = equity_value / shares_outstanding if shares_outstanding > 0 else 0

    return {
        "symbol": symbol,
        "currency": currency,
        "assumptions": {
            "base_revenue": base_revenue,
            "ebitda_margin_pct": ebitda_margin_pct,
            "tax_rate_pct": tax_rate_pct,
            "capex_pct_revenue": capex_pct_revenue,
            "wacc_pct": wacc_pct,
            "terminal_growth_pct": terminal_growth_pct,
            "net_debt": net_debt,
            "shares_outstanding": shares_outstanding,
        },
        "projections": projections,
        "valuation": {
            "pv_fcf_sum": round(total_pv_fcf, 1),
            "terminal_value": round(terminal_value, 1),
            "pv_terminal": round(pv_terminal, 1),
            "enterprise_value": round(enterprise_value, 1),
            "equity_value": round(equity_value, 1),
            "intrinsic_per_share": round(intrinsic_per_share, 2),
            "pv_terminal_pct": round(pv_terminal / enterprise_value * 100, 1) if enterprise_value else 0,
        },
    }


def run_multiples(
    symbol: str,
    eps_ttm: float,
    revenue_ttm: float,
    ebitda_ttm: float,
    book_value_per_share: float,
    current_price: float,
    sector_pe: float,
    sector_ev_ebitda: float,
    net_debt: float,
    shares_outstanding: float,
    currency: str = "TRY",
) -> dict:
    """Çarpan bazlı değerleme — sektör karşılaştırmalı."""
    market_cap = current_price * shares_outstanding
    ev = market_cap + net_debt

    current_pe   = current_price / eps_ttm if eps_ttm > 0 else None
    current_pb   = current_price / book_value_per_share if book_value_per_share > 0 else None
    current_ps   = market_cap / revenue_ttm if revenue_ttm > 0 else None
    current_ev_e = ev / ebitda_ttm if ebitda_ttm > 0 else None

    # Sektör PE'ye göre adil değer
    fair_pe  = sector_pe * eps_ttm if eps_ttm > 0 else None
    fair_ev  = sector_ev_ebitda * ebitda_ttm if ebitda_ttm > 0 else None
    fair_ev_per_share = (fair_ev - net_debt) / shares_outstanding if fair_ev and shares_outstanding > 0 else None

    # Ortalama adil değer
    fair_values = [v for v in [fair_pe, fair_ev_per_share] if v is not None]
    avg_fair = sum(fair_values) / len(fair_values) if fair_values else None
    upside = ((avg_fair - current_price) / current_price * 100) if avg_fair else None

    return {
        "symbol": symbol,
        "currency": currency,
        "current_price": current_price,
        "current_multiples": {
            "pe":       round(current_pe, 1) if current_pe else None,
            "pb":       round(current_pb, 1) if current_pb else None,
            "ps":       round(current_ps, 1) if current_ps else None,
            "ev_ebitda":round(current_ev_e, 1) if current_ev_e else None,
        },
        "sector_multiples": {
            "pe":       sector_pe,
            "ev_ebitda":sector_ev_ebitda,
        },
        "fair_values": {
            "by_pe":       round(fair_pe, 2) if fair_pe else None,
            "by_ev_ebitda":round(fair_ev_per_share, 2) if fair_ev_per_share else None,
            "average":     round(avg_fair, 2) if avg_fair else None,
            "upside_pct":  round(upside, 1) if upside else None,
        },
        "assessment": (
            "İskontolu — potansiyel alım fırsatı" if upside and upside > 15 else
            "Adil değerli — nötr" if upside and -10 <= upside <= 15 else
            "Primli — dikkatli olun" if upside else "Yetersiz veri"
        ),
    }


def run_scenario_model(
    symbol: str,
    base_dcf_value: float,
    current_price: float,
    bull_assumptions: dict,
    bear_assumptions: dict,
    currency: str = "TRY",
) -> dict:
    """
    Bull / Base / Bear DCF senaryosu karşılaştırması.
    Her senaryo için hisse başına değer ve potansiyel getiri hesaplar.
    """
    def scenario_value(multiplier: float, discount: float) -> float:
        return round(base_dcf_value * multiplier * (1 - discount / 100), 2)

    bull_value = scenario_value(
        bull_assumptions.get("growth_multiplier", 1.3),
        bull_assumptions.get("risk_discount", -5),   # negatif = prim
    )
    bear_value = scenario_value(
        bear_assumptions.get("growth_multiplier", 0.7),
        bear_assumptions.get("risk_discount", 20),
    )

    def upside(target: float) -> float:
        return round((target - current_price) / current_price * 100, 1) if current_price else 0

    return {
        "symbol": symbol,
        "currency": currency,
        "current_price": current_price,
        "scenarios": {
            "bull": {
                "label": "İyimser Senaryo",
                "value": bull_value,
                "upside_pct": upside(bull_value),
                "assumptions": bull_assumptions,
            },
            "base": {
                "label": "Baz Senaryo",
                "value": round(base_dcf_value, 2),
                "upside_pct": upside(base_dcf_value),
                "assumptions": {"description": "Mevcut tahminler"},
            },
            "bear": {
                "label": "Karamsar Senaryo",
                "value": bear_value,
                "upside_pct": upside(bear_value),
                "assumptions": bear_assumptions,
            },
        },
    }


# ── Hazır Şablonlar (kullanıcı buradan başlar) ────────────────────────────────
DCF_TEMPLATES: dict[str, dict] = {
    "THYAO": {
        "base_revenue": 480_000,
        "revenue_growth_rates": [18, 15, 12, 10, 8, 7, 6, 5, 5, 4],
        "ebitda_margin_pct": 24.0,
        "tax_rate_pct": 25.0,
        "capex_pct_revenue": 8.0,
        "wacc_pct": 28.0,
        "terminal_growth_pct": 8.0,
        "net_debt": 42_000,
        "shares_outstanding": 1_380,
        "currency": "TRY",
    },
    "GARAN": {
        "base_revenue": 320_000,
        "revenue_growth_rates": [22, 18, 14, 12, 10, 8, 7, 6, 5, 4],
        "ebitda_margin_pct": 44.0,
        "tax_rate_pct": 25.0,
        "capex_pct_revenue": 2.0,
        "wacc_pct": 28.0,
        "terminal_growth_pct": 8.0,
        "net_debt": 0,
        "shares_outstanding": 4_200,
        "currency": "TRY",
    },
    "AAPL": {
        "base_revenue": 391_000,
        "revenue_growth_rates": [5, 6, 8, 9, 8, 7, 6, 5, 4, 3],
        "ebitda_margin_pct": 34.0,
        "tax_rate_pct": 16.0,
        "capex_pct_revenue": 3.0,
        "wacc_pct": 9.0,
        "terminal_growth_pct": 3.0,
        "net_debt": -50_000,
        "shares_outstanding": 15_200,
        "currency": "USD",
    },
    "MSFT": {
        "base_revenue": 245_000,
        "revenue_growth_rates": [14, 15, 16, 14, 12, 10, 9, 8, 7, 5],
        "ebitda_margin_pct": 52.0,
        "tax_rate_pct": 18.0,
        "capex_pct_revenue": 6.0,
        "wacc_pct": 9.5,
        "terminal_growth_pct": 3.5,
        "net_debt": -20_000,
        "shares_outstanding": 7_430,
        "currency": "USD",
    },
    "NVDA": {
        "base_revenue": 130_000,
        "revenue_growth_rates": [60, 40, 25, 18, 14, 12, 10, 8, 6, 5],
        "ebitda_margin_pct": 64.0,
        "tax_rate_pct": 13.0,
        "capex_pct_revenue": 4.0,
        "wacc_pct": 12.0,
        "terminal_growth_pct": 4.0,
        "net_debt": -8_000,
        "shares_outstanding": 24_400,
        "currency": "USD",
    },
}
