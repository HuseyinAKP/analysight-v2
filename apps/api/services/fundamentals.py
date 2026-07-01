"""
Gerçek temel analiz verisi — yfinance

Bilanço, gelir tablosu, değerleme çarpanları, analist hedefleri.
BIST hisseleri için .IS suffix otomatik eklenir.
5 dakika cache ile rate limit aşılmaz.
"""
from __future__ import annotations
import time
from typing import Optional

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # 5 dakika

_BIST = {
    "THYAO","GARAN","EREGL","SISE","AKBNK","ISCTR","TUPRS","BIMAS",
    "TOASO","FROTO","ASELS","KCHOL","SAHOL","TCELL","ARCLK","PETKM",
    "TTKOM","TAVHL","EKGYO","VESTL","HALKB","VAKBN","YKBNK","PGSUS",
    "MGROS","SASA","KOZAL","TKFEN","ENKAI","CIMSA","AEFES","CCOLA",
    "ULKER","LOGO","ODAS","AKCNS","ISDMR","BRISA","DOHOL","SOKM",
}

_SECTOR_TR = {
    "Technology": "Teknoloji", "Financial Services": "Finans",
    "Basic Materials": "Hammadde", "Industrials": "Sanayi",
    "Consumer Cyclical": "Tüketim (Döngüsel)", "Consumer Defensive": "Tüketim (Savunmacı)",
    "Healthcare": "Sağlık", "Energy": "Enerji", "Utilities": "Kamu Hizmetleri",
    "Real Estate": "Gayrimenkul", "Communication Services": "İletişim",
    "Aviation": "Havacılık", "Airlines": "Havacılık",
    "Steel": "Çelik", "Defense": "Savunma",
}


def _yf_symbol(symbol: str) -> str:
    s = symbol.upper()
    if s in _BIST:
        return s + ".IS"
    return s


def _safe_float(v) -> Optional[float]:
    try:
        f = float(v)
        return None if (f != f) else f  # NaN check
    except Exception:
        return None


def _pct(v) -> Optional[float]:
    f = _safe_float(v)
    return round(f * 100, 2) if f is not None else None


def get_fundamentals(symbol: str) -> dict:
    """
    Sembol için gerçek temel analiz verisi döner.
    Kripto için available=False.
    """
    symbol = symbol.upper()
    now = time.time()

    if symbol in _cache and now - _cache[symbol][0] < _CACHE_TTL:
        return _cache[symbol][1]

    if symbol in ("BTC-USD", "ETH-USD"):
        result = {"symbol": symbol, "available": False,
                  "reason": "Kripto varlıklar için bilanço verisi mevcut değildir."}
        _cache[symbol] = (now, result)
        return result

    try:
        import yfinance as yf
        ticker = _yf_symbol(symbol)
        t = yf.Ticker(ticker)
        info = t.info or {}

        if not info.get("regularMarketPrice") and not info.get("currentPrice"):
            # yfinance bazen boş info döner — fallback
            raise ValueError("empty info")

        sector_raw = info.get("sector", "")
        sector = _SECTOR_TR.get(sector_raw, sector_raw or "Diğer")

        # Değerleme çarpanları
        pe       = _safe_float(info.get("trailingPE"))
        fwd_pe   = _safe_float(info.get("forwardPE"))
        pb       = _safe_float(info.get("priceToBook"))
        ps       = _safe_float(info.get("priceToSalesTrailing12Months"))
        ev_ebitda= _safe_float(info.get("enterpriseToEbitda"))
        ev_rev   = _safe_float(info.get("enterpriseToRevenue"))

        # Karlılık
        gross_m  = _pct(info.get("grossMargins"))
        op_m     = _pct(info.get("operatingMargins"))
        net_m    = _pct(info.get("profitMargins"))
        roe      = _pct(info.get("returnOnEquity"))
        roa      = _pct(info.get("returnOnAssets"))

        # Büyüme
        rev_growth = _pct(info.get("revenueGrowth"))
        earn_growth= _pct(info.get("earningsGrowth"))

        # Bilanço
        mktcap   = _safe_float(info.get("marketCap"))
        rev_ttm  = _safe_float(info.get("totalRevenue"))
        net_inc  = _safe_float(info.get("netIncomeToCommon"))
        total_debt = _safe_float(info.get("totalDebt"))
        total_cash = _safe_float(info.get("totalCash"))
        d_e      = _safe_float(info.get("debtToEquity"))
        curr_ratio = _safe_float(info.get("currentRatio"))
        quick_ratio= _safe_float(info.get("quickRatio"))
        fcf      = _safe_float(info.get("freeCashflow"))

        # EPS
        eps_ttm  = _safe_float(info.get("trailingEps"))
        eps_fwd  = _safe_float(info.get("forwardEps"))

        # 52H
        h52      = _safe_float(info.get("fiftyTwoWeekHigh"))
        l52      = _safe_float(info.get("fiftyTwoWeekLow"))

        # Float/Short
        short_pct = _pct(info.get("shortPercentOfFloat"))
        beta      = _safe_float(info.get("beta"))

        # Analist hedefleri
        analyst = _build_analyst(info)

        # Sektör ortalama PE kıyası
        sector_pe = {
            "Teknoloji": 32.0, "Finans": 9.0, "Bankacılık": 6.0,
            "Havacılık": 9.0, "Çelik": 8.0, "Cam": 10.0, "Savunma": 18.0,
            "Yarı İletken": 50.0, "Hammadde": 12.0, "Sanayi": 14.0,
            "Tüketim (Döngüsel)": 18.0, "Tüketim (Savunmacı)": 22.0,
            "Enerji": 11.0, "İletişim": 15.0, "Gayrimenkul": 20.0,
            "Sağlık": 28.0, "Diğer": 15.0,
        }
        avg_pe = sector_pe.get(sector, 15.0)
        pe_vs = None
        if pe and avg_pe:
            pe_vs = "ucuz" if pe < avg_pe * 0.85 else ("pahalı" if pe > avg_pe * 1.15 else "uygun")

        # İçgörüler
        insights = _build_insights(pe, pe_vs, avg_pe, net_m, roe, rev_growth, earn_growth,
                                    d_e, curr_ratio, beta, short_pct)

        # Gelir tablosu zaman serisi
        quarters = _build_quarters(t)

        result = {
            "symbol": symbol,
            "available": True,
            "company": info.get("longName") or info.get("shortName") or symbol,
            "sector": sector,
            "industry": info.get("industry", ""),
            "currency": info.get("financialCurrency") or info.get("currency") or "TRY",
            "valuation": {
                "pe": pe, "forward_pe": fwd_pe, "pb": pb, "ps": ps,
                "ev_ebitda": ev_ebitda, "ev_revenue": ev_rev,
                "sector_avg_pe": avg_pe, "pe_vs_sector": pe_vs,
                "beta": beta, "short_pct": short_pct,
            },
            "profitability": {
                "gross_margin": gross_m, "operating_margin": op_m,
                "net_margin": net_m, "roe": roe, "roa": roa,
            },
            "growth": {
                "revenue_growth_yoy": rev_growth,
                "earnings_growth_yoy": earn_growth,
            },
            "balance_sheet": {
                "market_cap": mktcap, "revenue_ttm": rev_ttm,
                "net_income_ttm": net_inc, "total_debt": total_debt,
                "total_cash": total_cash, "free_cashflow": fcf,
                "debt_to_equity": d_e, "current_ratio": curr_ratio,
                "quick_ratio": quick_ratio,
            },
            "per_share": {
                "eps_ttm": eps_ttm, "eps_forward": eps_fwd,
                "week52_high": h52, "week52_low": l52,
            },
            "analyst": analyst,
            "quarters": quarters,
            "insights": insights,
        }

        _cache[symbol] = (now, result)
        return result

    except Exception as e:
        print(f"[fundamentals] {symbol} hata: {e}")
        # Cache'e koyma — sonraki istekte tekrar dene
        return {"symbol": symbol, "available": False, "reason": str(e)}


def _build_analyst(info: dict) -> dict:
    rec_map = {
        "strongBuy": "Güçlü Al", "buy": "Al",
        "hold": "Tut", "sell": "Sat", "strongSell": "Güçlü Sat",
    }
    rec_key = info.get("recommendationKey", "")
    return {
        "recommendation": rec_map.get(rec_key, rec_key.title() if rec_key else None),
        "recommendation_key": rec_key,
        "target_mean": _safe_float(info.get("targetMeanPrice")),
        "target_high": _safe_float(info.get("targetHighPrice")),
        "target_low":  _safe_float(info.get("targetLowPrice")),
        "num_analysts": info.get("numberOfAnalystOpinions"),
    }


def _build_quarters(t) -> list[dict]:
    """Son 4 çeyrek gelir tablosu."""
    try:
        qs = t.quarterly_income_stmt
        if qs is None or qs.empty:
            return []
        cols = qs.columns[:4]
        rows = []
        for col in cols:
            rev  = _safe_float(qs.loc["Total Revenue", col]) if "Total Revenue" in qs.index else None
            ni   = _safe_float(qs.loc["Net Income", col])    if "Net Income" in qs.index else None
            gp   = _safe_float(qs.loc["Gross Profit", col])  if "Gross Profit" in qs.index else None
            rows.append({
                "period": str(col.date()) if hasattr(col, "date") else str(col),
                "revenue": rev,
                "net_income": ni,
                "gross_profit": gp,
                "net_margin": round(ni / rev * 100, 1) if (rev and ni and rev != 0) else None,
            })
        return rows
    except Exception:
        return []


def _build_insights(pe, pe_vs, avg_pe, net_m, roe, rev_growth, earn_growth,
                    d_e, curr_ratio, beta, short_pct) -> list[str]:
    out = []
    if pe and pe_vs:
        out.append(f"F/K {pe:.1f}x — sektör ortalaması {avg_pe:.1f}x ile karşılaştırıldığında {pe_vs}")
    if net_m is not None:
        level = "güçlü" if net_m > 20 else ("orta" if net_m > 8 else "düşük")
        out.append(f"Net kâr marjı %{net_m:.1f} — {level}")
    if roe is not None:
        out.append(f"Özkaynak kârlılığı (ROE) %{roe:.1f} — {'yüksek' if roe > 20 else 'orta'}")
    if rev_growth is not None:
        out.append(f"Gelir büyümesi YoY: {'%+' if rev_growth >= 0 else '%'}{rev_growth:.1f}")
    if d_e is not None:
        out.append(f"Borç/Özkaynak: {d_e:.2f}x — {'düşük risk' if d_e < 0.5 else ('orta' if d_e < 1.5 else 'yüksek kaldıraç')}")
    if beta is not None:
        out.append(f"Beta {beta:.2f} — piyasaya göre {'daha oynak' if beta > 1.2 else ('benzer' if beta > 0.8 else 'daha sakin')}")
    if short_pct and short_pct > 5:
        out.append(f"Açığa satış oranı %{short_pct:.1f} — dikkat")
    return out[:6]
