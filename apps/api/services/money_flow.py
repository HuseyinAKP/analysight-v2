"""
Para giriş-çıkış analizi — OBV, Money Flow Index (MFI), Chaikin MF, hacim spike tespiti
Tüm hesaplamalar OHLCV verisi üzerinden yapılır, ek API gerektirmez.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def analyze_money_flow(df: pd.DataFrame) -> dict:
    """
    OHLCV DataFrame'inden para akışı analizini hesaplar.
    Returns:
        obv: OBV serisi özeti
        mfi: Money Flow Index (14 dönem)
        cmf: Chaikin Money Flow (20 dönem)
        volume_spikes: Hacim spike listesi
        flow_summary: Genel özet
    """
    if df is None or len(df) < 20:
        return {}

    closes = df["close"].values.astype(float)
    highs  = df["high"].values.astype(float)
    lows   = df["low"].values.astype(float)
    vols   = df["volume"].values.astype(float)
    n = len(closes)

    # ── OBV (On-Balance Volume) ──────────────────────────────────────────────
    obv = np.zeros(n)
    obv[0] = vols[0]
    for i in range(1, n):
        if closes[i] > closes[i - 1]:
            obv[i] = obv[i - 1] + vols[i]
        elif closes[i] < closes[i - 1]:
            obv[i] = obv[i - 1] - vols[i]
        else:
            obv[i] = obv[i - 1]

    obv_trend = _calc_trend(obv[-20:])
    price_trend = _calc_trend(closes[-20:])
    obv_divergence = _detect_divergence(obv_trend, price_trend)

    # ── Money Flow Index (MFI — 14 dönem) ───────────────────────────────────
    period = 14
    typical = (highs + lows + closes) / 3
    raw_mf = typical * vols

    mfi_values = []
    for i in range(period, n):
        seg_tp  = typical[i - period: i]
        seg_mf  = raw_mf[i - period: i]
        pos_mf = sum(seg_mf[j] for j in range(period) if seg_tp[j] > (typical[i - period - 1] if i - period - 1 >= 0 else seg_tp[j]))
        neg_mf = sum(seg_mf[j] for j in range(period) if seg_tp[j] < (typical[i - period - 1] if i - period - 1 >= 0 else seg_tp[j]))
        if neg_mf == 0:
            mfi_values.append(100.0)
        else:
            mfr = pos_mf / neg_mf
            mfi_values.append(100 - 100 / (1 + mfr))

    mfi_now = round(mfi_values[-1], 1) if mfi_values else None
    mfi_signal = _mfi_signal(mfi_now)

    # ── Chaikin Money Flow (CMF — 20 dönem) ─────────────────────────────────
    cmf_period = 20
    mfm = np.where(
        (highs - lows) != 0,
        ((closes - lows) - (highs - closes)) / (highs - lows),
        0.0,
    )
    cmf_now = None
    if n >= cmf_period:
        cmf_num = np.sum(mfm[-cmf_period:] * vols[-cmf_period:])
        cmf_den = np.sum(vols[-cmf_period:])
        cmf_now = round(float(cmf_num / cmf_den) if cmf_den != 0 else 0.0, 3)
    cmf_signal = _cmf_signal(cmf_now)

    # ── Hacim Spike Tespiti ───────────────────────────────────────────────────
    vol_mean = np.mean(vols[-60:]) if n >= 60 else np.mean(vols)
    vol_std  = np.std(vols[-60:])  if n >= 60 else np.std(vols)
    threshold = vol_mean + 2.0 * vol_std

    spikes = []
    dates = df.index.tolist() if hasattr(df.index, "tolist") else list(range(n))
    lookback = min(30, n)
    for i in range(n - lookback, n):
        if vols[i] > threshold:
            pct_above = (vols[i] - vol_mean) / vol_mean * 100
            direction = "up" if closes[i] >= closes[i - 1] else "down"
            spikes.append({
                "date": str(dates[i])[:10],
                "volume": int(vols[i]),
                "pct_above_avg": round(pct_above, 1),
                "direction": direction,
                "close": round(float(closes[i]), 2),
            })

    # ── Özet ─────────────────────────────────────────────────────────────────
    # OBV 20 günlük değişim yüzdesi
    obv_pct = round((obv[-1] - obv[-20]) / abs(obv[-20]) * 100, 1) if abs(obv[-20]) > 0 else 0.0

    # Hacim trendi: son 10 gün ortalama vs önceki 10 gün
    vol_recent = np.mean(vols[-10:])
    vol_prev   = np.mean(vols[-20:-10]) if n >= 20 else vol_recent
    vol_trend_pct = round((vol_recent - vol_prev) / vol_prev * 100, 1) if vol_prev > 0 else 0.0

    overall = _overall_signal(obv_trend, price_trend, mfi_now, cmf_now, vol_trend_pct)

    return {
        "obv": {
            "current": round(float(obv[-1])),
            "pct_change_20d": obv_pct,
            "trend": obv_trend,
            "divergence": obv_divergence,
        },
        "mfi": {
            "value": mfi_now,
            "signal": mfi_signal,
            "period": period,
        },
        "cmf": {
            "value": cmf_now,
            "signal": cmf_signal,
            "period": cmf_period,
        },
        "volume": {
            "trend_pct_10d": vol_trend_pct,
            "avg_30d": round(float(vol_mean)),
            "spikes": spikes,
        },
        "summary": {
            "signal": overall["signal"],
            "signal_tr": overall["signal_tr"],
            "color": overall["color"],
            "bullets": overall["bullets"],
        },
    }


# ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

def _calc_trend(arr: np.ndarray) -> str:
    if len(arr) < 2:
        return "neutral"
    slope = np.polyfit(range(len(arr)), arr, 1)[0]
    norm = abs(arr.mean()) if arr.mean() != 0 else 1
    if slope / norm > 0.002:
        return "up"
    if slope / norm < -0.002:
        return "down"
    return "neutral"


def _detect_divergence(obv_trend: str, price_trend: str) -> str | None:
    if obv_trend == "up" and price_trend == "down":
        return "bullish_divergence"
    if obv_trend == "down" and price_trend == "up":
        return "bearish_divergence"
    return None


def _mfi_signal(mfi: float | None) -> str:
    if mfi is None:
        return "neutral"
    if mfi >= 80:
        return "overbought"
    if mfi <= 20:
        return "oversold"
    if mfi >= 60:
        return "bullish"
    if mfi <= 40:
        return "bearish"
    return "neutral"


def _cmf_signal(cmf: float | None) -> str:
    if cmf is None:
        return "neutral"
    if cmf > 0.1:
        return "accumulation"
    if cmf < -0.1:
        return "distribution"
    return "neutral"


def _overall_signal(obv_trend, price_trend, mfi, cmf, vol_trend_pct):
    bull = 0
    bear = 0

    if obv_trend == "up":
        bull += 1
    elif obv_trend == "down":
        bear += 1

    if mfi is not None:
        if mfi > 55:
            bull += 1
        elif mfi < 45:
            bear += 1

    if cmf is not None:
        if cmf > 0.05:
            bull += 1
        elif cmf < -0.05:
            bear += 1

    if vol_trend_pct > 10 and obv_trend == "up":
        bull += 1
    elif vol_trend_pct > 10 and obv_trend == "down":
        bear += 1

    bullets = []
    if obv_trend == "up":
        bullets.append("OBV yükseliyor — alıcı baskısı güçlü")
    elif obv_trend == "down":
        bullets.append("OBV düşüyor — satıcı baskısı var")

    div = _detect_divergence(obv_trend, price_trend)
    if div == "bullish_divergence":
        bullets.append("Boğa uyuşmazlığı: fiyat düşerken OBV yükseliyor")
    elif div == "bearish_divergence":
        bullets.append("Ayı uyuşmazlığı: fiyat yükselirken OBV düşüyor")

    if mfi is not None:
        if mfi >= 80:
            bullets.append(f"MFI aşırı alım bölgesinde ({mfi})")
        elif mfi <= 20:
            bullets.append(f"MFI aşırı satım bölgesinde ({mfi})")

    if cmf is not None:
        if cmf > 0.1:
            bullets.append(f"CMF güçlü birikim sinyali ({cmf:+.3f})")
        elif cmf < -0.1:
            bullets.append(f"CMF dağıtım baskısı ({cmf:+.3f})")

    if vol_trend_pct > 20:
        bullets.append(f"Hacim son 10 günde %{vol_trend_pct:.0f} arttı")
    elif vol_trend_pct < -20:
        bullets.append(f"Hacim son 10 günde %{abs(vol_trend_pct):.0f} azaldı")

    if bull > bear:
        return {"signal": "BULLISH", "signal_tr": "Para Girişi", "color": "emerald", "bullets": bullets[:4]}
    if bear > bull:
        return {"signal": "BEARISH", "signal_tr": "Para Çıkışı", "color": "red", "bullets": bullets[:4]}
    return {"signal": "NEUTRAL", "signal_tr": "Nötr", "color": "yellow", "bullets": bullets[:4]}
