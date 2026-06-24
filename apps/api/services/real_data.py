"""
Real market data service using yfinance.
Replaces mock_data.py for live prices and OHLCV history.
Falls back to mock data if yfinance is unavailable.
"""
from __future__ import annotations
import pandas as pd
import numpy as np
import yfinance as yf
from datetime import datetime, timedelta
from functools import lru_cache
import threading

# ── Symbol mapping ─────────────────────────────────────────────────────────────
# Our internal symbols → yfinance ticker
SYMBOL_MAP: dict[str, str] = {
    # BIST — append .IS
    "THYAO":   "THYAO.IS",
    "GARAN":   "GARAN.IS",
    "EREGL":   "EREGL.IS",
    "SISE":    "SISE.IS",
    "ASELS":   "ASELS.IS",
    "AKBNK":   "AKBNK.IS",
    "KCHOL":   "KCHOL.IS",
    "BIMAS":   "BIMAS.IS",
    "FROTO":   "FROTO.IS",
    "TUPRS":   "TUPRS.IS",
    # US
    "AAPL":    "AAPL",
    "MSFT":    "MSFT",
    "NVDA":    "NVDA",
    "GOOGL":   "GOOGL",
    "AMZN":    "AMZN",
    "META":    "META",
    "TSLA":    "TSLA",
    "JPM":     "JPM",
    "V":       "V",
    "UNH":     "UNH",
    # Crypto
    "BTC-USD": "BTC-USD",
    "ETH-USD": "ETH-USD",
    "BNB-USD": "BNB-USD",
    "SOL-USD": "SOL-USD",
    "XRP-USD": "XRP-USD",
}

# Reverse map: yfinance ticker → our symbol
REVERSE_MAP = {v: k for k, v in SYMBOL_MAP.items()}

SYMBOL_META: dict[str, dict] = {
    "THYAO":   {"name": "Türk Hava Yolları",    "market": "BIST",   "currency": "TRY", "sector": "Havacılık"},
    "GARAN":   {"name": "Garanti BBVA",          "market": "BIST",   "currency": "TRY", "sector": "Bankacılık"},
    "EREGL":   {"name": "Ereğli Demir Çelik",   "market": "BIST",   "currency": "TRY", "sector": "Çelik"},
    "SISE":    {"name": "Şişe Cam",              "market": "BIST",   "currency": "TRY", "sector": "Cam"},
    "ASELS":   {"name": "Aselsan",               "market": "BIST",   "currency": "TRY", "sector": "Savunma"},
    "AKBNK":   {"name": "Akbank",                "market": "BIST",   "currency": "TRY", "sector": "Bankacılık"},
    "KCHOL":   {"name": "Koç Holding",           "market": "BIST",   "currency": "TRY", "sector": "Holding"},
    "BIMAS":   {"name": "BİM Mağazaları",        "market": "BIST",   "currency": "TRY", "sector": "Perakende"},
    "FROTO":   {"name": "Ford Otosan",           "market": "BIST",   "currency": "TRY", "sector": "Otomotiv"},
    "TUPRS":   {"name": "Tüpraş",                "market": "BIST",   "currency": "TRY", "sector": "Enerji"},
    "AAPL":    {"name": "Apple Inc.",            "market": "NASDAQ", "currency": "USD", "sector": "Teknoloji"},
    "MSFT":    {"name": "Microsoft Corp.",       "market": "NASDAQ", "currency": "USD", "sector": "Teknoloji"},
    "NVDA":    {"name": "NVIDIA Corp.",          "market": "NASDAQ", "currency": "USD", "sector": "Yarı İletken"},
    "GOOGL":   {"name": "Alphabet Inc.",         "market": "NASDAQ", "currency": "USD", "sector": "Teknoloji"},
    "AMZN":    {"name": "Amazon.com Inc.",       "market": "NASDAQ", "currency": "USD", "sector": "E-Ticaret"},
    "META":    {"name": "Meta Platforms",        "market": "NASDAQ", "currency": "USD", "sector": "Sosyal Medya"},
    "TSLA":    {"name": "Tesla Inc.",            "market": "NASDAQ", "currency": "USD", "sector": "Otomotiv"},
    "JPM":     {"name": "JPMorgan Chase",        "market": "NYSE",   "currency": "USD", "sector": "Bankacılık"},
    "BTC-USD": {"name": "Bitcoin",               "market": "CRYPTO", "currency": "USD", "sector": "Kripto"},
    "ETH-USD": {"name": "Ethereum",              "market": "CRYPTO", "currency": "USD", "sector": "Kripto"},
    "BNB-USD": {"name": "BNB",                   "market": "CRYPTO", "currency": "USD", "sector": "Kripto"},
    "SOL-USD": {"name": "Solana",                "market": "CRYPTO", "currency": "USD", "sector": "Kripto"},
    "XRP-USD": {"name": "XRP",                   "market": "CRYPTO", "currency": "USD", "sector": "Kripto"},
}

# Known symbols set (our internal keys)
KNOWN_SYMBOLS = set(SYMBOL_MAP.keys())

# In-memory price cache (TTL: 5 minutes)
_price_cache: dict[str, tuple[dict, datetime]] = {}
_cache_lock = threading.Lock()
CACHE_TTL = timedelta(minutes=5)


def _yf_ticker(symbol: str) -> str:
    """Convert our internal symbol to yfinance ticker."""
    return SYMBOL_MAP.get(symbol.upper(), symbol.upper())


def get_ohlcv(symbol: str, days: int = 180) -> pd.DataFrame:
    """Fetch real OHLCV data from yfinance. Falls back to mock on error."""
    try:
        ticker = _yf_ticker(symbol)
        # yfinance period mapping
        if days <= 5:    period = "5d"
        elif days <= 30: period = "1mo"
        elif days <= 90: period = "3mo"
        elif days <= 180: period = "6mo"
        elif days <= 365: period = "1y"
        else:             period = "2y"

        df = yf.download(ticker, period=period, interval="1d", progress=False, auto_adjust=True)
        if df.empty:
            return _fallback_ohlcv(symbol, days)

        # Flatten multi-index columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        df = df.rename(columns={
            "Open": "open", "High": "high", "Low": "low",
            "Close": "close", "Volume": "volume"
        })
        df = df[["open", "high", "low", "close", "volume"]].copy()
        df.index = pd.to_datetime(df.index)
        df = df.reset_index().rename(columns={"index": "date", "Date": "date", "Datetime": "date"})
        df = df.dropna(subset=["close"])
        df = df.tail(days)
        return df
    except Exception:
        return _fallback_ohlcv(symbol, days)


def get_symbol_info(symbol: str) -> dict | None:
    """Get current price + 1d change for a symbol."""
    symbol = symbol.upper()
    meta = SYMBOL_META.get(symbol)
    if not meta and symbol not in KNOWN_SYMBOLS:
        # Dynamic lookup for unknown symbols
        meta = {"name": symbol, "market": "UNKNOWN", "currency": "USD", "sector": "Diğer"}

    # Check cache
    with _cache_lock:
        cached = _price_cache.get(symbol)
        if cached and datetime.now() - cached[1] < CACHE_TTL:
            return cached[0]

    try:
        ticker = _yf_ticker(symbol)
        t = yf.Ticker(ticker)
        hist = t.history(period="2d")
        if hist.empty:
            return None

        # Flatten multi-index if needed
        if isinstance(hist.columns, pd.MultiIndex):
            hist.columns = hist.columns.get_level_values(0)

        current = float(hist["Close"].iloc[-1])
        prev    = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else current
        change_abs = current - prev
        change_pct = (change_abs / prev * 100) if prev else 0.0

        # Try to get pre-market / after-hours price
        premarket_price = None
        premarket_change_pct = None
        afterhours_price = None
        afterhours_change_pct = None
        market_state = "closed"
        try:
            fast = t.fast_info
            pm = getattr(fast, "pre_market_price", None)
            ah = getattr(fast, "post_market_price", None)
            if pm and pm > 0:
                premarket_price = round(float(pm), 4)
                premarket_change_pct = round((pm - current) / current * 100, 2)
                market_state = "pre_market"
            elif ah and ah > 0:
                afterhours_price = round(float(ah), 4)
                afterhours_change_pct = round((ah - current) / current * 100, 2)
                market_state = "after_hours"
            else:
                # Estimate market state by time (NY timezone approximation)
                import datetime as dt_mod
                now_utc = dt_mod.datetime.utcnow()
                ny_hour = (now_utc.hour - 5) % 24  # rough EST offset
                if 9 <= ny_hour < 16:
                    market_state = "open"
                elif 4 <= ny_hour < 9:
                    market_state = "pre_market"
                elif 16 <= ny_hour < 20:
                    market_state = "after_hours"
        except Exception:
            pass

        result = {
            "symbol":     symbol,
            "name":       (meta or {}).get("name", symbol),
            "market":     (meta or {}).get("market", "—"),
            "currency":   (meta or {}).get("currency", "USD"),
            "price":      round(current, 4),
            "change_pct": round(change_pct, 4),
            "change_abs": round(change_abs, 4),
            "market_state": market_state,
            "premarket_price": premarket_price,
            "premarket_change_pct": premarket_change_pct,
            "afterhours_price": afterhours_price,
            "afterhours_change_pct": afterhours_change_pct,
        }

        with _cache_lock:
            _price_cache[symbol] = (result, datetime.now())

        return result
    except Exception:
        return None


def search_symbols(query: str, limit: int = 10) -> list[dict]:
    """Search symbols by name or ticker."""
    q = query.upper()
    results = []
    for sym, meta in SYMBOL_META.items():
        if q in sym or q in meta["name"].upper():
            results.append({
                "symbol": sym,
                "name": meta["name"],
                "market": meta["market"],
                "currency": meta["currency"],
            })
    # Also try live search for unknown tickers
    if not results and len(query) >= 2:
        try:
            tickers = yf.Search(query, max_results=5)
            for t in (tickers.quotes or [])[:limit]:
                sym = t.get("symbol", "")
                results.append({
                    "symbol":   sym,
                    "name":     t.get("longname") or t.get("shortname") or sym,
                    "market":   t.get("exchange", "—"),
                    "currency": t.get("currency", "USD"),
                })
        except Exception:
            pass
    return results[:limit]


def list_symbols() -> list[dict]:
    return [
        {"symbol": sym, **{k: v for k, v in meta.items()}}
        for sym, meta in SYMBOL_META.items()
    ]


# ── Fallback mock data ─────────────────────────────────────────────────────────
def _fallback_ohlcv(symbol: str, days: int) -> pd.DataFrame:
    """Deterministic mock OHLCV when yfinance is unavailable."""
    from services.mock_data import generate_ohlcv
    return generate_ohlcv(symbol, days=days)
