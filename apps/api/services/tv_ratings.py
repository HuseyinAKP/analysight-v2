"""
TradingView Teknik Analiz Özeti — tradingview_ta kütüphanesi

tradingview_ta; TradingView'ın kendi analiz sayfasındaki
oscillator + hareketli ortalama önerilerini ücretsiz ve
API key gerektirmeden çeker.

Döndürülen yapı:
  recommendation: STRONG_BUY | BUY | NEUTRAL | SELL | STRONG_SELL
  oscillators:    { recommendation, buy, sell, neutral }
  moving_averages:{ recommendation, buy, sell, neutral }
  indicators:     { RSI, MACD.macd, ... }
"""
from __future__ import annotations
import time
from typing import Optional

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # 5 dakika

_EXCHANGE_MAP = {
    # BIST
    "THYAO": "BIST", "GARAN": "BIST", "EREGL": "BIST", "SISE": "BIST",
    "AKBNK": "BIST", "ISCTR": "BIST", "TUPRS": "BIST", "BIMAS": "BIST",
    "TOASO": "BIST", "FROTO": "BIST", "ASELS": "BIST", "KCHOL": "BIST",
    "SAHOL": "BIST", "TCELL": "BIST", "ARCLK": "BIST", "PETKM": "BIST",
    "TTKOM": "BIST", "TAVHL": "BIST", "EKGYO": "BIST", "VESTL": "BIST",
    "HALKB": "BIST", "VAKBN": "BIST", "YKBNK": "BIST", "PGSUS": "BIST",
    "MGROS": "BIST", "SASA": "BIST", "KOZAL": "BIST", "TKFEN": "BIST",
    "ENKAI": "BIST", "CIMSA": "BIST", "AEFES": "BIST", "CCOLA": "BIST",
    "ULKER": "BIST", "LOGO": "BIST", "ODAS": "BIST", "AKCNS": "BIST",
    "ISDMR": "BIST", "BRISA": "BIST", "DOHOL": "BIST", "SOKM": "BIST",
}

_REC_TR = {
    "STRONG_BUY":  "Güçlü Al",
    "BUY":         "Al",
    "NEUTRAL":     "Nötr",
    "SELL":        "Sat",
    "STRONG_SELL": "Güçlü Sat",
}

def _exchange_for(symbol: str) -> str:
    s = symbol.upper().replace(".IS", "")
    return _EXCHANGE_MAP.get(s, "NASDAQ")

def get_tv_rating(symbol: str, interval: str = "1d") -> Optional[dict]:
    """
    TradingView'dan teknik analiz özeti çek.

    interval: "1m","5m","15m","1h","4h","1d","1W","1M"
    """
    key = f"{symbol}:{interval}"
    now = time.time()
    if key in _cache and now - _cache[key][0] < _CACHE_TTL:
        return _cache[key][1]

    try:
        from tradingview_ta import TA_Handler, Interval

        interval_map = {
            "1m": Interval.INTERVAL_1_MINUTE,
            "5m": Interval.INTERVAL_5_MINUTES,
            "15m": Interval.INTERVAL_15_MINUTES,
            "1h": Interval.INTERVAL_1_HOUR,
            "4h": Interval.INTERVAL_4_HOURS,
            "1d": Interval.INTERVAL_1_DAY,
            "1W": Interval.INTERVAL_1_WEEK,
            "1M": Interval.INTERVAL_1_MONTH,
        }

        clean = symbol.upper().replace(".IS", "")
        exchange = _exchange_for(clean)

        handler = TA_Handler(
            symbol=clean,
            screener="turkey" if exchange == "BIST" else "america",
            exchange=exchange,
            interval=interval_map.get(interval, Interval.INTERVAL_1_DAY),
        )

        analysis = handler.get_analysis()
        rec = analysis.summary.get("RECOMMENDATION", "NEUTRAL")
        osc = analysis.oscillators
        ma  = analysis.moving_averages

        result = {
            "recommendation":    rec,
            "recommendation_tr": _REC_TR.get(rec, rec),
            "oscillators": {
                "recommendation": osc.get("RECOMMENDATION", "NEUTRAL"),
                "buy":     osc.get("BUY", 0),
                "sell":    osc.get("SELL", 0),
                "neutral": osc.get("NEUTRAL", 0),
            },
            "moving_averages": {
                "recommendation": ma.get("RECOMMENDATION", "NEUTRAL"),
                "buy":     ma.get("BUY", 0),
                "sell":    ma.get("SELL", 0),
                "neutral": ma.get("NEUTRAL", 0),
            },
            "indicators": {
                k: v for k, v in analysis.indicators.items()
                if k in {
                    "RSI", "RSI[1]", "MACD.macd", "MACD.signal",
                    "Mom", "CCI20", "ADX", "W.R",
                    "Stoch.K", "Stoch.D", "Stoch.RSI.K",
                    "EMA10", "EMA20", "EMA50", "EMA100", "EMA200",
                    "SMA10", "SMA20", "SMA50", "SMA100", "SMA200",
                    "BB.upper", "BB.lower", "P.SAR",
                }
            },
        }

        _cache[key] = (now, result)
        return result

    except Exception as e:
        print(f"[tv_ratings] {symbol} hata: {e}")
        return None


def get_tv_multiframe(symbol: str) -> dict:
    """
    4 zaman dilimi için TradingView özeti: 1h, 4h, 1d, 1W
    """
    frames = {}
    for interval in ["1h", "4h", "1d", "1W"]:
        r = get_tv_rating(symbol, interval)
        if r:
            frames[interval] = {
                "recommendation": r["recommendation"],
                "recommendation_tr": r["recommendation_tr"],
                "oscillators":    r["oscillators"]["recommendation"],
                "moving_averages": r["moving_averages"]["recommendation"],
                "buy":   r["oscillators"]["buy"]  + r["moving_averages"]["buy"],
                "sell":  r["oscillators"]["sell"] + r["moving_averages"]["sell"],
                "neutral": r["oscillators"]["neutral"] + r["moving_averages"]["neutral"],
            }
    return frames
