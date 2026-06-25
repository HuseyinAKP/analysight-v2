"""
HEI Katman 1 — Anomali Tespiti

Bir hisse/emtianın geçmiş fiyat verisinde istatistiksel olarak
olağandışı hareketleri tespit eder. Üç yöntem paralel çalışır:
  1. Z-Score: günlük getirinin standart sapma sayısı
  2. ATR Kırılımı: 14 günlük ATR'nin 2x üzerinde hareket
  3. Kümülatif Hareket: 5/10/20 günlük pencerede eşik aşımı
"""
from __future__ import annotations
import time
from dataclasses import dataclass, asdict
from typing import Optional
import pandas as pd
import numpy as np

from services.real_data import get_ohlcv, SYMBOL_MAP

# ── Yapılandırma ───────────────────────────────────────────────────────────────
Z_THRESHOLD       = 2.8   # |Z| > 2.8 → anomali (daha seçici)
ATR_MULT          = 2.5   # günlük hareket > ATR*2.5 → anomali
CUM_5D_THRESH     = 0.10  # 5 günde %10
CUM_10D_THRESH    = 0.15  # 10 günde %15
CUM_20D_THRESH    = 0.22  # 20 günde %22
MIN_MAGNITUDE     = 0.04  # %4 altı hareketler gösterilmez
COOLDOWN_DAYS     = 7     # iki anomali arası minimum gün
_CACHE_TTL        = 3600  # 1 saat
_cache: dict[str, tuple[float, list]] = {}

# ── Veri sınıfları ─────────────────────────────────────────────────────────────
@dataclass
class Anomaly:
    date: str            # "2018-08-10"
    magnitude: float     # % değişim (−22.3 gibi)
    anomaly_type: str    # flash_crash | surge | slow_trend | volatility_spike
    label: str           # Türkçe etiket
    z_score: float
    volume_confirmed: bool   # hacim de normalin üzerinde mi?
    recovery_days: Optional[int]   # kaç günde önceki seviyeye döndü
    post_5d:  Optional[float]      # 5 gün sonraki getiri
    post_30d: Optional[float]      # 30 gün sonraki getiri
    post_90d: Optional[float]      # 90 gün sonraki getiri

def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    hi, lo, cl = df["high"], df["low"], df["close"]
    prev_cl = cl.shift(1)
    tr = pd.concat([
        hi - lo,
        (hi - prev_cl).abs(),
        (lo - prev_cl).abs(),
    ], axis=1).max(axis=1)
    return tr.rolling(period).mean()

def _anomaly_label(anomaly_type: str, magnitude: float) -> str:
    if anomaly_type == "flash_crash":
        return "Ani Düşüş"
    if anomaly_type == "surge":
        return "Ani Yükseliş"
    if anomaly_type == "slow_trend":
        return "Kümülatif Trend" + (" ↑" if magnitude > 0 else " ↓")
    return "Volatilite Patlaması"

def _recovery_days(df: pd.DataFrame, idx: int) -> Optional[int]:
    """Kırılım noktasından sonra kaç günde önceki fiyata geri döndü."""
    if idx <= 0 or idx >= len(df) - 1:
        return None
    base_price = float(df["close"].iloc[idx - 1])
    direction  = 1 if df["close"].iloc[idx] < base_price else -1
    for j in range(idx + 1, min(idx + 120, len(df))):
        p = float(df["close"].iloc[j])
        if direction == 1 and p >= base_price:
            return j - idx
        if direction == -1 and p <= base_price:
            return j - idx
    return None  # 120 günde toparlanmadı

def _post_return(df: pd.DataFrame, idx: int, n: int) -> Optional[float]:
    end = idx + n
    if end >= len(df):
        return None
    base = float(df["close"].iloc[idx])
    if base == 0:
        return None
    return round((float(df["close"].iloc[end]) - base) / base * 100, 2)

# ── Ana fonksiyon ──────────────────────────────────────────────────────────────
def detect_anomalies(symbol: str, years: int = 5) -> list[dict]:
    """
    Verilen sembol için son `years` yılın anomalilerini döner.
    Sonuçlar önbelleğe alınır (1 saat TTL).
    """
    cache_key = f"{symbol}:{years}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    days = min(years * 365, 1825)  # max 5 yıl
    df = get_ohlcv(symbol, days=days)
    if df is None or len(df) < 30:
        return []

    df = df.reset_index(drop=True)
    closes = df["close"].astype(float)

    # Günlük getiri
    returns = closes.pct_change().fillna(0)

    # Z-Score
    mu, sigma = returns.mean(), returns.std()
    z_scores = (returns - mu) / sigma if sigma > 0 else pd.Series(0.0, index=returns.index)

    # ATR
    atr = _atr(df)
    atr_mean = atr.rolling(30).mean()

    # Hacim normalize
    vol_mean = df["volume"].rolling(20).mean() if "volume" in df.columns else None

    anomalies: list[Anomaly] = []
    flagged_idx: set[int] = set()

    # ── Yöntem 1+2: Z-Score veya ATR kırılımı ─────────────────────────────────
    for i in range(14, len(df)):
        ret   = float(returns.iloc[i])
        z     = float(z_scores.iloc[i])
        price = float(closes.iloc[i])
        prev  = float(closes.iloc[i - 1]) if i > 0 else price

        daily_move = abs(price - prev)
        atr_val    = float(atr.iloc[i]) if not pd.isna(atr.iloc[i]) else 0
        atr_m_val  = float(atr_mean.iloc[i]) if not pd.isna(atr_mean.iloc[i]) else atr_val

        is_z   = abs(z) > Z_THRESHOLD
        is_atr = atr_m_val > 0 and daily_move > atr_val * ATR_MULT

        if not (is_z or is_atr):
            continue
        if abs(ret) < MIN_MAGNITUDE:
            continue

        # Hacim onayı
        vol_confirmed = False
        if vol_mean is not None:
            v_cur = df["volume"].iloc[i]
            v_avg = float(vol_mean.iloc[i]) if not pd.isna(vol_mean.iloc[i]) else 0
            vol_confirmed = v_avg > 0 and v_cur > v_avg * 1.5

        atype = "flash_crash" if ret < 0 else "surge"

        # Tarihi al
        date_col = df["date"].iloc[i] if "date" in df.columns else df.index[i]
        date_str  = str(date_col)[:10]

        anomalies.append(Anomaly(
            date=date_str,
            magnitude=round(ret * 100, 2),
            anomaly_type=atype,
            label=_anomaly_label(atype, ret),
            z_score=round(z, 2),
            volume_confirmed=vol_confirmed,
            recovery_days=_recovery_days(df, i),
            post_5d=_post_return(df, i, 5),
            post_30d=_post_return(df, i, 30),
            post_90d=_post_return(df, i, 90),
        ))
        flagged_idx.add(i)

    # ── Yöntem 3: Kümülatif hareket ───────────────────────────────────────────
    for window, thresh in [(5, CUM_5D_THRESH), (10, CUM_10D_THRESH), (20, CUM_20D_THRESH)]:
        cum = closes.pct_change(window).fillna(0)
        for i in range(window, len(df)):
            if i in flagged_idx:
                continue
            c = float(cum.iloc[i])
            if abs(c) < thresh:
                continue

            date_col = df["date"].iloc[i] if "date" in df.columns else df.index[i]
            date_str  = str(date_col)[:10]

            anomalies.append(Anomaly(
                date=date_str,
                magnitude=round(c * 100, 2),
                anomaly_type="slow_trend",
                label=_anomaly_label("slow_trend", c),
                z_score=round(float(z_scores.iloc[i]), 2),
                volume_confirmed=False,
                recovery_days=_recovery_days(df, i),
                post_5d=_post_return(df, i, 5),
                post_30d=_post_return(df, i, 30),
                post_90d=_post_return(df, i, 90),
            ))
            flagged_idx.add(i)

    # Tarihe göre sırala, tekrarlananları ve cooldown içindeki zayıfları kaldır
    from datetime import datetime as _dt
    sorted_anomalies = sorted(anomalies, key=lambda x: x.date)

    unique: list[Anomaly] = []
    last_date: Optional[str] = None
    for a in sorted_anomalies:
        if last_date:
            try:
                gap = (_dt.strptime(a.date, "%Y-%m-%d") - _dt.strptime(last_date, "%Y-%m-%d")).days
                if gap < COOLDOWN_DAYS:
                    # Cooldown içindeyse yalnızca daha büyük olanı tut
                    if abs(a.magnitude) > abs(unique[-1].magnitude):
                        unique[-1] = a
                    continue
            except Exception:
                pass
        unique.append(a)
        last_date = a.date

    # numpy scalar → Python native (JSON serileştirme için)
    def _clean(d: dict) -> dict:
        out = {}
        for k, v in d.items():
            if isinstance(v, (np.bool_,)):
                out[k] = bool(v)
            elif isinstance(v, (np.integer,)):
                out[k] = int(v)
            elif isinstance(v, (np.floating,)):
                out[k] = float(v)
            else:
                out[k] = v
        return out

    result = [_clean(asdict(a)) for a in unique]
    _cache[cache_key] = (now, result)
    return result
