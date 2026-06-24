"""Mock OHLCV data generator for development phase."""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

MOCK_SYMBOLS = {
    "THYAO": {"name": "Türk Hava Yolları", "market": "BIST", "currency": "TRY"},
    "GARAN": {"name": "Garanti Bankası", "market": "BIST", "currency": "TRY"},
    "EREGL": {"name": "Ereğli Demir Çelik", "market": "BIST", "currency": "TRY"},
    "SISE": {"name": "Şişe Cam", "market": "BIST", "currency": "TRY"},
    "ASELS": {"name": "Aselsan", "market": "BIST", "currency": "TRY"},
    "AAPL": {"name": "Apple Inc.", "market": "NASDAQ", "currency": "USD"},
    "MSFT": {"name": "Microsoft Corp.", "market": "NASDAQ", "currency": "USD"},
    "NVDA": {"name": "NVIDIA Corp.", "market": "NASDAQ", "currency": "USD"},
    "BTC-USD": {"name": "Bitcoin", "market": "CRYPTO", "currency": "USD"},
    "ETH-USD": {"name": "Ethereum", "market": "CRYPTO", "currency": "USD"},
}

BASE_PRICES = {
    "THYAO": 280.0, "GARAN": 95.0, "EREGL": 42.0, "SISE": 55.0, "ASELS": 78.0,
    "AAPL": 195.0, "MSFT": 420.0, "NVDA": 875.0,
    "BTC-USD": 67500.0, "ETH-USD": 3850.0,
}


def generate_ohlcv(symbol: str, days: int = 180) -> pd.DataFrame:
    np.random.seed(hash(symbol) % 2**31)
    base = BASE_PRICES.get(symbol, 100.0)
    volatility = 0.025 if symbol in ("BTC-USD", "ETH-USD") else 0.015

    dates = [datetime.now() - timedelta(days=days - i) for i in range(days)]
    close = [base]
    for _ in range(days - 1):
        change = np.random.normal(0.0003, volatility)
        close.append(close[-1] * (1 + change))

    close = np.array(close)
    high = close * (1 + np.abs(np.random.normal(0, volatility / 2, days)))
    low = close * (1 - np.abs(np.random.normal(0, volatility / 2, days)))
    open_ = np.roll(close, 1)
    open_[0] = close[0]
    volume_base = 1_000_000 if symbol not in ("BTC-USD", "ETH-USD") else 50_000
    volume = np.random.randint(volume_base, volume_base * 5, days).astype(float)

    return pd.DataFrame({
        "date": dates,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })


def get_symbol_info(symbol: str) -> dict:
    info = MOCK_SYMBOLS.get(symbol.upper())
    if not info:
        return None
    df = generate_ohlcv(symbol.upper(), days=2)
    current = df["close"].iloc[-1]
    prev = df["close"].iloc[-2]
    change_pct = (current - prev) / prev * 100
    return {
        "symbol": symbol.upper(),
        **info,
        "price": round(current, 2),
        "change_pct": round(change_pct, 2),
        "change_abs": round(current - prev, 2),
    }
