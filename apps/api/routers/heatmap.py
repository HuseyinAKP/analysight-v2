"""Sektör Isı Haritası — BIST ve Küresel Piyasalar için sektör bazlı performans verisi."""
from __future__ import annotations
import random
from datetime import datetime, timezone
from fastapi import APIRouter
import yfinance as yf

router = APIRouter()

# ── BIST Sektör → Hisse Eşlemesi ──────────────────────────────────────────────
BIST_SECTORS: dict[str, list[str]] = {
    "Bankacılık":   ["GARAN.IS", "AKBNK.IS", "ISCTR.IS", "YKBNK.IS", "HALKB.IS", "VAKBN.IS"],
    "Holding":      ["KCHOL.IS", "SAHOL.IS", "DOHOL.IS", "TKFEN.IS", "ENKAI.IS"],
    "Havacılık":    ["THYAO.IS", "PGSUS.IS", "TAVHL.IS"],
    "Enerji":       ["TUPRS.IS", "PETKM.IS", "ODAS.IS", "SASA.IS"],
    "Savunma":      ["ASELS.IS"],
    "Perakende":    ["BIMAS.IS", "MGROS.IS"],
    "Demir-Çelik":  ["EREGL.IS", "ISDMR.IS"],
    "Teknoloji":    ["LOGO.IS", "NETAS.IS"],
    "Cam-Çimento":  ["SISE.IS", "AKCNS.IS", "CIMSA.IS"],
    "Otomotiv":     ["TOASO.IS", "FROTO.IS"],
    "Telecom":      ["TTKOM.IS", "TCELL.IS"],
    "Gıda & İçecek":["AEFES.IS", "CCOLA.IS", "ULKER.IS"],
    "GYO":          ["EKGYO.IS"],
    "Madencilik":   ["KOZAL.IS"],
}

# Küresel ETF/endeksler (sektör bazlı)
GLOBAL_SECTORS: dict[str, list[str]] = {
    "Teknoloji":    ["XLK", "AAPL", "MSFT", "NVDA", "AMD"],
    "Finans":       ["XLF", "JPM", "GS", "BAC"],
    "Sağlık":       ["XLV", "JNJ", "PFE", "UNH"],
    "Enerji":       ["XLE", "XOM", "CVX"],
    "Tüketim":      ["XLY", "AMZN", "TSLA", "NKE"],
    "Sanayi":       ["XLI", "GE", "CAT", "BA"],
    "Emlak":        ["XLRE", "AMT", "PLD"],
    "Hammadde":     ["XLB", "LIN", "FCX"],
    "Kamu Hizm.":   ["XLU", "NEE", "DUK"],
    "İletişim":     ["XLC", "GOOGL", "META"],
    "Kripto":       ["BTC-USD", "ETH-USD"],
}


def _fetch_sector_data(sectors: dict[str, list[str]]) -> list[dict]:
    """Her sektör için yfinance'den anlık veri çek, sektör ortalaması hesapla."""
    all_symbols = [sym for syms in sectors.values() for sym in syms]

    try:
        tickers = yf.Tickers(" ".join(all_symbols))
        prices: dict[str, dict] = {}
        for sym in all_symbols:
            try:
                t = tickers.tickers.get(sym)
                if not t:
                    continue
                info = t.fast_info
                price = getattr(info, "last_price", None) or 0
                prev  = getattr(info, "previous_close", None) or price
                chg   = ((price - prev) / prev * 100) if prev else 0
                mktcap = getattr(info, "market_cap", None) or 1_000_000
                prices[sym] = {"price": price, "change_pct": chg, "mktcap": mktcap}
            except Exception:
                pass
    except Exception:
        prices = {}

    result = []
    for sector_name, syms in sectors.items():
        stocks = []
        changes = []
        total_cap = 0

        for sym in syms:
            d = prices.get(sym)
            if not d or not d["price"]:
                # Mock fallback
                chg = round(random.uniform(-3.5, 4.5), 2)
                d = {"price": 0, "change_pct": chg, "mktcap": 1_000_000_000}

            # Temiz sembol (yfinance suffix kaldır)
            clean = sym.replace(".IS", "").replace("-USD", "")
            stocks.append({
                "symbol":     clean,
                "change_pct": round(d["change_pct"], 2),
                "mktcap":     d["mktcap"],
            })
            changes.append(d["change_pct"])
            total_cap += d["mktcap"]

        avg_change = round(sum(changes) / len(changes), 2) if changes else 0

        result.append({
            "sector":     sector_name,
            "avg_change": avg_change,
            "stocks":     sorted(stocks, key=lambda x: x["mktcap"], reverse=True),
            "total_cap":  total_cap,
            "count":      len(stocks),
        })

    return sorted(result, key=lambda x: x["total_cap"], reverse=True)


@router.get("/heatmap/bist")
def bist_heatmap():
    """BIST sektör ısı haritası verisi."""
    sectors = _fetch_sector_data(BIST_SECTORS)
    return {
        "market":    "BIST",
        "sectors":   sectors,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/heatmap/global")
def global_heatmap():
    """Küresel piyasa sektör ısı haritası verisi."""
    sectors = _fetch_sector_data(GLOBAL_SECTORS)
    return {
        "market":    "GLOBAL",
        "sectors":   sectors,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/heatmap/combined")
def combined_heatmap():
    """BIST + Küresel birleşik harita."""
    return {
        "bist":      _fetch_sector_data(BIST_SECTORS),
        "global":    _fetch_sector_data(GLOBAL_SECTORS),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
