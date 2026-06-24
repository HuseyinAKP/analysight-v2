"""
Market Structure Analysis: BOS, CHoCH, swing points, ADX, Stochastic.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


# ── ADX ──────────────────────────────────────────────────────────────────────
def calc_adx(df: pd.DataFrame, period: int = 14) -> dict:
    high, low, close = df["high"], df["low"], df["close"]
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)

    dm_plus  = high.diff().clip(lower=0)
    dm_minus = (-low.diff()).clip(lower=0)
    # Zero where DM+ > DM-
    dm_plus  = dm_plus.where(dm_plus > dm_minus, 0)
    dm_minus = dm_minus.where(dm_minus > dm_plus, 0)

    atr14   = tr.ewm(com=period - 1, adjust=False).mean()
    di_plus = 100 * dm_plus.ewm(com=period - 1, adjust=False).mean() / atr14
    di_minus= 100 * dm_minus.ewm(com=period - 1, adjust=False).mean() / atr14

    dx = (100 * (di_plus - di_minus).abs() / (di_plus + di_minus).replace(0, np.nan)).fillna(0)
    adx = dx.ewm(com=period - 1, adjust=False).mean()

    val  = round(adx.iloc[-1], 2)
    dip  = round(di_plus.iloc[-1], 2)
    dim  = round(di_minus.iloc[-1], 2)

    if val >= 40:
        label = "Çok Güçlü Trend"
    elif val >= 25:
        label = "Güçlü Trend"
    elif val >= 20:
        label = "Orta Trend"
    else:
        label = "Trendsize / Gürültü"

    direction = "Yükseliş" if dip > dim else "Düşüş"

    return {
        "adx": val,
        "di_plus": dip,
        "di_minus": dim,
        "label": label,
        "direction": direction,
        "series": adx.dropna().round(2).tolist()[-60:],
    }


# ── Stochastic ────────────────────────────────────────────────────────────────
def calc_stochastic(df: pd.DataFrame, k_period=14, d_period=3) -> dict:
    high, low, close = df["high"], df["low"], df["close"]
    lowest  = low.rolling(k_period).min()
    highest = high.rolling(k_period).max()
    k = 100 * (close - lowest) / (highest - lowest).replace(0, np.nan)
    d = k.rolling(d_period).mean()

    kv, dv = round(k.iloc[-1], 2), round(d.iloc[-1], 2)

    if kv >= 80:
        label = "Aşırı Alım"
        color = "red"
    elif kv <= 20:
        label = "Aşırı Satım"
        color = "green"
    else:
        label = "Nötr"
        color = "gray"

    signal = "Al" if kv > dv and kv < 80 else "Sat" if kv < dv and kv > 20 else "Bekle"

    return {
        "k": kv,
        "d": dv,
        "label": label,
        "color": color,
        "signal": signal,
        "series_k": k.dropna().round(2).tolist()[-60:],
        "series_d": d.dropna().round(2).tolist()[-60:],
    }


# ── Swing Points ──────────────────────────────────────────────────────────────
def find_swing_points(df: pd.DataFrame, window: int = 5) -> dict:
    highs, lows, dates = df["high"].values, df["low"].values, df["date"].dt.strftime("%Y-%m-%d").values
    swing_highs, swing_lows = [], []
    n = len(highs)

    for i in range(window, n - window):
        if all(highs[i] >= highs[i - j] for j in range(1, window + 1)) and \
           all(highs[i] >= highs[i + j] for j in range(1, window + 1)):
            swing_highs.append({"date": dates[i], "price": round(float(highs[i]), 2), "index": i})
        if all(lows[i] <= lows[i - j] for j in range(1, window + 1)) and \
           all(lows[i] <= lows[i + j] for j in range(1, window + 1)):
            swing_lows.append({"date": dates[i], "price": round(float(lows[i]), 2), "index": i})

    return {"swing_highs": swing_highs[-5:], "swing_lows": swing_lows[-5:]}


# ── BOS / CHoCH ───────────────────────────────────────────────────────────────
def detect_structure(df: pd.DataFrame) -> dict:
    swings = find_swing_points(df)
    sh = swings["swing_highs"]
    sl = swings["swing_lows"]
    close = df["close"].values
    dates = df["date"].dt.strftime("%Y-%m-%d").values

    events = []

    # BOS Bullish: close above last swing high
    if len(sh) >= 2:
        last_sh = sh[-1]["price"]
        prev_sh = sh[-2]["price"]
        for i in range(sh[-1]["index"] + 1, len(close)):
            if close[i] > last_sh:
                label = "BOS Yükseliş" if last_sh > prev_sh else "CHoCH Yükseliş"
                events.append({
                    "type": label,
                    "date": dates[i],
                    "price": round(float(close[i]), 2),
                    "level": last_sh,
                    "sentiment": "bullish",
                })
                break

    # BOS Bearish: close below last swing low
    if len(sl) >= 2:
        last_sl = sl[-1]["price"]
        prev_sl = sl[-2]["price"]
        for i in range(sl[-1]["index"] + 1, len(close)):
            if close[i] < last_sl:
                label = "BOS Düşüş" if last_sl < prev_sl else "CHoCH Düşüş"
                events.append({
                    "type": label,
                    "date": dates[i],
                    "price": round(float(close[i]), 2),
                    "level": last_sl,
                    "sentiment": "bearish",
                })
                break

    # Overall structure bias
    if len(sh) >= 2 and len(sl) >= 2:
        higher_highs = sh[-1]["price"] > sh[-2]["price"]
        higher_lows  = sl[-1]["price"] > sl[-2]["price"]
        if higher_highs and higher_lows:
            structure = "Yükseliş Yapısı (HH-HL)"
            bias = "bullish"
        elif not higher_highs and not higher_lows:
            structure = "Düşüş Yapısı (LH-LL)"
            bias = "bearish"
        else:
            structure = "Kararsız Yapı"
            bias = "neutral"
    else:
        structure = "Yetersiz Veri"
        bias = "neutral"

    return {
        "structure": structure,
        "bias": bias,
        "events": events[-3:],
        "swing_highs": sh,
        "swing_lows":  sl,
    }
