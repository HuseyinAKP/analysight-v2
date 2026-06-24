"""Technical indicators calculated from OHLCV data using pandas/numpy only."""
import pandas as pd
import numpy as np


def calc_ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def calc_macd(series: pd.Series, fast=12, slow=26, signal=9) -> dict:
    ema_fast = calc_ema(series, fast)
    ema_slow = calc_ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = calc_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return {"macd": macd_line, "signal": signal_line, "histogram": histogram}


def calc_bollinger(series: pd.Series, period=20, std_dev=2) -> dict:
    sma = series.rolling(period).mean()
    std = series.rolling(period).std()
    return {
        "upper": sma + std_dev * std,
        "middle": sma,
        "lower": sma - std_dev * std,
    }


def calc_atr(df: pd.DataFrame, period=14) -> pd.Series:
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift()).abs()
    low_close = (df["low"] - df["close"].shift()).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.ewm(com=period - 1, adjust=False).mean()


def build_indicators(df: pd.DataFrame) -> dict:
    close = df["close"]
    rsi = calc_rsi(close)
    macd = calc_macd(close)
    bb = calc_bollinger(close)
    atr = calc_atr(df)
    ema20 = calc_ema(close, 20)
    ema50 = calc_ema(close, 50)
    ema200 = calc_ema(close, 200)

    # VWAP (rolling 20-day)
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    vwap = (typical_price * df["volume"]).rolling(20).sum() / df["volume"].rolling(20).sum()

    # Stochastic
    low14 = df["low"].rolling(14).min()
    high14 = df["high"].rolling(14).max()
    stoch_k = 100 * (close - low14) / (high14 - low14).replace(0, np.nan)
    stoch_d = stoch_k.rolling(3).mean()

    last = -1
    price = float(close.iloc[last])
    e20 = float(ema20.iloc[last])
    e50 = float(ema50.iloc[last])
    e200 = float(ema200.iloc[last])
    rsi_val = float(rsi.iloc[last])
    macd_val = float(macd["macd"].iloc[last])
    macd_sig_val = float(macd["signal"].iloc[last])
    stoch_val = float(stoch_k.iloc[last]) if not np.isnan(stoch_k.iloc[last]) else 50.0
    bb_upper_val = float(bb["upper"].iloc[last])
    bb_lower_val = float(bb["lower"].iloc[last])
    bb_mid_val = float(bb["middle"].iloc[last])

    # ── Signal confluence ──────────────────────────────────────────────────────
    def _sig(bull_cond: bool, bear_cond: bool) -> str:
        if bull_cond:   return "bull"
        if bear_cond:   return "bear"
        return "neutral"

    confluence_signals = [
        {"key": "rsi",        "label": "RSI",           "signal": _sig(rsi_val < 40, rsi_val > 60),  "value": f"{rsi_val:.1f}",      "note": "Aşırı satım = fırsat" if rsi_val < 30 else ("Aşırı alım = dikkat" if rsi_val > 70 else "Normal bölge")},
        {"key": "macd",       "label": "MACD",          "signal": _sig(macd_val > macd_sig_val, macd_val < macd_sig_val), "value": f"{macd_val:.4f}",  "note": "MACD sinyal üstünde" if macd_val > macd_sig_val else "MACD sinyal altında"},
        {"key": "ema_trend",  "label": "EMA Trend",     "signal": _sig(price > e20 > e50, price < e20 < e50),            "value": f"{e20:.2f}",       "note": "Fiyat EMA20 üstünde" if price > e20 else "Fiyat EMA20 altında"},
        {"key": "ema200",     "label": "Uzun Vade",     "signal": _sig(price > e200, price < e200),                      "value": f"{e200:.2f}",      "note": "Fiyat EMA200 üstünde (boğa)" if price > e200 else "Fiyat EMA200 altında (ayı)"},
        {"key": "stoch",      "label": "Stochastic",    "signal": _sig(stoch_val < 25, stoch_val > 75),                  "value": f"{stoch_val:.1f}", "note": "Aşırı satım bölgesi" if stoch_val < 25 else ("Aşırı alım bölgesi" if stoch_val > 75 else "Normal bölge")},
        {"key": "bb",         "label": "Bollinger",     "signal": _sig(price < bb_lower_val, price > bb_upper_val),      "value": f"{((price-bb_lower_val)/(bb_upper_val-bb_lower_val)*100):.0f}%", "note": "Alt banda yakın = dip arayışı" if price < bb_mid_val else "Üst banda yakın"},
        {"key": "ema_cross",  "label": "EMA Kesişim",   "signal": _sig(e20 > e50, e20 < e50),                            "value": f"{'↑' if e20>e50 else '↓'}",  "note": "Altın kesişim (EMA20 > EMA50)" if e20 > e50 else "Ölüm kesişimi (EMA20 < EMA50)"},
        {"key": "price_mom",  "label": "Fiyat Momentum","signal": _sig(float(close.pct_change(5).iloc[last]) > 0.02, float(close.pct_change(5).iloc[last]) < -0.02), "value": f"{float(close.pct_change(5).iloc[last])*100:.1f}%", "note": "5 günlük momentum"},
    ]

    bull_count = sum(1 for s in confluence_signals if s["signal"] == "bull")
    bear_count = sum(1 for s in confluence_signals if s["signal"] == "bear")
    total = len(confluence_signals)
    confluence_score = round((bull_count / total) * 100)

    return {
        "rsi": round(rsi_val, 2),
        "macd": round(macd_val, 4),
        "macd_signal": round(macd_sig_val, 4),
        "macd_histogram": round(float(macd["histogram"].iloc[last]), 4),
        "bb_upper": round(bb_upper_val, 2),
        "bb_middle": round(bb_mid_val, 2),
        "bb_lower": round(bb_lower_val, 2),
        "atr": round(float(atr.iloc[last]), 4),
        "ema20": round(e20, 2),
        "ema50": round(e50, 2),
        "ema200": round(e200, 2),
        "vwap": round(float(vwap.iloc[last]), 2) if not np.isnan(vwap.iloc[last]) else None,
        "stoch_k": round(stoch_val, 2),
        "stoch_d": round(float(stoch_d.iloc[last]), 2) if not np.isnan(stoch_d.iloc[last]) else None,
        "confluence": {
            "score": confluence_score,
            "bull_count": bull_count,
            "bear_count": bear_count,
            "neutral_count": total - bull_count - bear_count,
            "signals": confluence_signals,
        },
        "series": {
            "rsi": rsi.dropna().round(2).tolist()[-90:],
            "macd": macd["macd"].dropna().round(4).tolist()[-90:],
            "macd_signal": macd["signal"].dropna().round(4).tolist()[-90:],
            "macd_histogram": macd["histogram"].dropna().round(4).tolist()[-90:],
            "bb_upper": bb["upper"].dropna().round(2).tolist()[-90:],
            "bb_middle": bb["middle"].dropna().round(2).tolist()[-90:],
            "bb_lower": bb["lower"].dropna().round(2).tolist()[-90:],
            "ema20": ema20.dropna().round(2).tolist()[-90:],
            "ema50": ema50.dropna().round(2).tolist()[-90:],
            "ema200": ema200.dropna().round(2).tolist()[-90:],
            "vwap": vwap.dropna().round(2).tolist()[-90:],
            "volume": df["volume"].tolist()[-90:],
            "close": close.tolist()[-90:],
            "dates": df["date"].dt.strftime("%Y-%m-%d").tolist()[-90:],
        },
    }
