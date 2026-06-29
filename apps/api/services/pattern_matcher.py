"""
HEI Katman 3 — Örüntü Eşleştirme

Bugünkü piyasa durumunu 14 boyutlu bir vektörle temsil eder:
  8 teknik boyut + 6 olay kategorisi boyutu

Teknik boyutlar (0-7):
  0  RSI-14 normalize (0-1)
  1  MACD histogram yönü (-1/0/+1)
  2  Fiyat / EMA200 oranı
  3  30 günlük volatilite
  4  Hacim trendi (20g z-score)
  5  30g momentum
  6  20g momentum
  7  RSI merkez sapması

Olay kategorisi boyutları (8-13) — anomali varsa 1.0, yoksa 0.0:
  8   Kur Krizi
  9   Merkez Bankası / Faiz
  10  Jeopolitik / Çatışma
  11  Enerji Şoku
  12  Salgın / Sağlık
  13  Seçim / Siyaset

Sayısal eşleşmenin yanında olay kategorisi de uyuşursa benzerlik ağırlığı artar.
Böylece "2018 kur krizi" sadece "kur krizi dönemleri" ile eşleşir.
"""
from __future__ import annotations
import time
from typing import Optional
import numpy as np
import pandas as pd

from services.real_data import get_ohlcv
from services.anomaly_detector import detect_anomalies
from services.context_enricher import enrich_anomaly

# Olay kategorisi → vektör indeksi (8-13)
_CAT_INDEX = {
    "Kur Krizi":             8,
    "Merkez Bankası":        9,
    "Jeopolitik / Çatışma": 10,
    "Enerji Şoku":          11,
    "Salgın / Sağlık":      12,
    "Seçim / Siyaset":      13,
}
_CAT_WEIGHT = 0.6   # olay boyutlarının ağırlığı (teknik=1.0 ile karşılaştırmalı)

_CACHE_TTL = 1800   # 30 dakika
_cache: dict[str, tuple[float, dict]] = {}

# ── Teknik indikatörler ────────────────────────────────────────────────────────
def _ema(series: pd.Series, n: int) -> pd.Series:
    return series.ewm(span=n, adjust=False).mean()

def _rsi(series: pd.Series, n: int = 14) -> pd.Series:
    delta = series.diff()
    gain  = delta.clip(lower=0).rolling(n).mean()
    loss  = (-delta.clip(upper=0)).rolling(n).mean()
    rs    = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _macd_hist(series: pd.Series) -> pd.Series:
    fast = _ema(series, 12)
    slow = _ema(series, 26)
    macd = fast - slow
    signal = _ema(macd, 9)
    return macd - signal

def _build_vectors(df: pd.DataFrame) -> np.ndarray:
    """
    Her gün için 14 boyutlu vektör matrisini döner.
    Şekil: (N, 14) — 8 teknik + 6 olay kategorisi (sıfır, sonradan doldurulur)
    """
    c = df["close"].astype(float)
    v = df["volume"].astype(float) if "volume" in df.columns else pd.Series(1.0, index=c.index)

    rsi      = _rsi(c)
    macd_h   = _macd_hist(c)
    ema200   = _ema(c, 200)
    vol30    = c.pct_change().rolling(30).std()
    mom20    = c.pct_change(20)

    v_mean = v.rolling(20).mean()
    v_std  = v.rolling(20).std().replace(0, 1)
    v_z    = (v - v_mean) / v_std

    price_ema200 = c / ema200.replace(0, np.nan)
    idx30 = c.pct_change(30)

    n = len(df)
    mat = np.zeros((n, 14), dtype=np.float32)

    # Teknik boyutlar 0-7
    mat[:, 0] = rsi.fillna(50).values / 100
    mat[:, 1] = np.sign(macd_h.fillna(0).values)
    mat[:, 2] = price_ema200.fillna(1).clip(0.5, 2).values - 1
    mat[:, 3] = vol30.fillna(0).values * 10
    mat[:, 4] = v_z.fillna(0).clip(-3, 3).values / 3
    mat[:, 5] = idx30.fillna(0).clip(-0.5, 0.5).values
    mat[:, 6] = mom20.fillna(0).clip(-0.3, 0.3).values
    mat[:, 7] = (rsi.fillna(50).values - 50) / 50

    # Olay kategorisi boyutları 8-13 başlangıçta sıfır
    # _enrich_with_events() tarafından anomali günlerinde doldurulur
    return mat


def _enrich_with_events(mat: np.ndarray, df: pd.DataFrame, symbol: str) -> np.ndarray:
    """
    Anomali günleri için olay kategorisi boyutlarını (8-13) doldurur.
    Her anomali için context_enricher çağrılır, kategoriler vektöre yazılır.
    Çevre maliyetini azaltmak için anomali sayısı ≤ 30 tutulur.
    """
    try:
        anomalies = detect_anomalies(symbol, years=5)
    except Exception:
        return mat

    # Tarih → satır indeksi haritası
    date_col = "date" if "date" in df.columns else None
    date_to_idx: dict[str, int] = {}
    for i, row in df.iterrows():
        d = str(row[date_col] if date_col else i)[:10]
        date_to_idx[d] = i

    # Sadece büyük anomaliler (üstten 30)
    top_anomalies = sorted(anomalies, key=lambda x: abs(x["magnitude"]), reverse=True)[:30]

    for anom in top_anomalies:
        date_str = anom["date"]
        idx = date_to_idx.get(date_str)
        if idx is None:
            continue
        try:
            ctx = enrich_anomaly(symbol, date_str, anom["magnitude"])
            cats = ctx.get("categories", [])
            for cat in cats:
                col = _CAT_INDEX.get(cat)
                if col is not None:
                    mat[idx, col] = _CAT_WEIGHT
        except Exception:
            pass

    return mat

def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))

# ── Ana fonksiyon ──────────────────────────────────────────────────────────────
def find_similar_periods(symbol: str, top_n: int = 5) -> dict:
    """
    Bugünkü duruma en benzer tarihsel dönemleri döner.

    Döndürülen yapı:
      current_state: bugünkü 8 indikatör değeri
      matches: [{ date, similarity, magnitude_at_match, post_5d, post_30d, post_90d, context_hint }]
      aggregate: { median_30d, bull_30d, bear_30d, avg_similarity, sample_size }
    """
    cache_key = f"pm:{symbol}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    # Yeterli geçmiş veri — en az 3 yıl
    df = get_ohlcv(symbol, days=1825)
    if df is None or len(df) < 250:
        return {"error": "Yeterli geçmiş veri yok"}

    df = df.reset_index(drop=True)
    mat = _build_vectors(df)
    mat = _enrich_with_events(mat, df, symbol)  # olay kategorileri ekle

    # Bugünkü vektör = son satır
    today_vec = mat[-1]

    # Geçerli gün sayısı (NaN'siz ilk 210 gün sonrası)
    start_idx = 210
    closes = df["close"].astype(float).values

    def post_return(i: int, n: int) -> Optional[float]:
        j = i + n
        if j >= len(df):
            return None
        base = closes[i]
        return round((closes[j] - base) / base * 100, 2) if base else None

    matches = []
    # Son 30 günü karşılaştırmadan hariç tut (bugüne çok yakın)
    end_idx = len(df) - 31

    for i in range(start_idx, end_idx):
        row_vec = mat[i]
        if np.isnan(row_vec).any():
            continue
        sim = _cosine_sim(today_vec, row_vec)
        if sim < 0.85:   # Düşük benzerlik eşiği filtrele
            continue

        date_col = df["date"].iloc[i] if "date" in df.columns else df.index[i]
        date_str = str(date_col)[:10]

        # O günkü hareket
        prev = closes[i - 1] if i > 0 else closes[i]
        day_ret = round((closes[i] - prev) / prev * 100, 2) if prev else 0

        matches.append({
            "date":             date_str,
            "similarity":       round(sim, 3),
            "day_return":       day_ret,
            "post_5d":          post_return(i, 5),
            "post_30d":         post_return(i, 30),
            "post_90d":         post_return(i, 90),
        })

    if not matches:
        result = {
            "symbol": symbol,
            "matches": [],
            "aggregate": None,
            "note": "Yeterli benzer dönem bulunamadı (benzerlik < %85).",
        }
        _cache[cache_key] = (now, result)
        return result

    # En benzer top_n'i seç — tarih çakışmasını önlemek için 10 gün cooldown
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    selected: list[dict] = []
    used_dates: list[str] = []

    for m in matches:
        too_close = any(
            abs((pd.Timestamp(m["date"]) - pd.Timestamp(d)).days) < 10
            for d in used_dates
        )
        if not too_close:
            selected.append(m)
            used_dates.append(m["date"])
        if len(selected) >= top_n:
            break

    # Aggregate istatistik
    returns_30 = [m["post_30d"] for m in selected if m["post_30d"] is not None]
    returns_90 = [m["post_90d"] for m in selected if m["post_90d"] is not None]

    aggregate = None
    if returns_30:
        aggregate = {
            "median_30d":   round(float(np.median(returns_30)), 2),
            "mean_30d":     round(float(np.mean(returns_30)), 2),
            "bull_30d":     round(float(np.percentile(returns_30, 75)), 2),
            "bear_30d":     round(float(np.percentile(returns_30, 25)), 2),
            "positive_pct": round(sum(1 for r in returns_30 if r > 0) / len(returns_30) * 100),
            "avg_similarity": round(float(np.mean([m["similarity"] for m in selected])), 3),
            "sample_size":  len(returns_30),
            "median_90d":   round(float(np.median(returns_90)), 2) if returns_90 else None,
        }

    # Bugünkü durum özeti
    rsi_now  = float(mat[-1][0]) * 100
    macd_dir = int(mat[-1][1])
    ema_gap  = round(float(mat[-1][2]) * 100, 2)

    # Aktif olay kategorileri (bugünkü vektörde 0'dan büyük olanlar)
    idx_to_cat = {v: k for k, v in _CAT_INDEX.items()}
    active_cats = [idx_to_cat[i] for i in range(8, 14) if mat[-1][i] > 0]

    current_state = {
        "rsi":                   round(rsi_now, 1),
        "macd_direction":        "pozitif" if macd_dir > 0 else ("negatif" if macd_dir < 0 else "nötr"),
        "price_vs_ema200_pct":   ema_gap,
        "momentum_20d":          round(float(mat[-1][6]) * 100, 2),
        "active_event_categories": active_cats,
    }

    result = {
        "symbol":        symbol,
        "current_state": current_state,
        "matches":       selected,
        "aggregate":     aggregate,
        "note": None,
    }
    _cache[cache_key] = (now, result)
    return result
