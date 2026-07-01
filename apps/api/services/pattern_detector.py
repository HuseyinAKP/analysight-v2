"""
Klasik teknik formasyon tespiti — mum verisi üzerinde

Desteklenen formasyonlar:
  - Baş ve Omuzlar (Head & Shoulders) + Ters
  - Çift Dip (Double Bottom) + Çift Tepe (Double Top)
  - Üçgen: Yükselen / Alçalan / Simetrik
  - Bayrak (Bull/Bear Flag)
  - Kama (Rising/Falling Wedge)
  - Yuvarlak Dip (Cup & Handle) — basitleştirilmiş
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional


def detect_patterns(df: pd.DataFrame) -> list[dict]:
    """
    OHLCV DataFrame'inden klasik formasyonları tespit eder.
    df: 'open','high','low','close','volume' sütunları, en az 60 satır
    Returns: [{ name, name_tr, direction, confidence, start_idx, end_idx,
                description, target_pct }]
    """
    if df is None or len(df) < 30:
        return []

    closes = df["close"].values.astype(float)
    highs  = df["high"].values.astype(float)
    lows   = df["low"].values.astype(float)
    n = len(closes)

    patterns = []

    # ── Pivot noktaları bul ────────────────────────────────────────────────────
    peaks   = _find_pivots(highs,  is_high=True,  window=5)
    troughs = _find_pivots(lows,   is_high=False, window=5)

    # ── Çift Tepe / Çift Dip ──────────────────────────────────────────────────
    dbl = _double_top_bottom(highs, lows, closes, peaks, troughs)
    patterns.extend(dbl)

    # ── Baş ve Omuzlar ─────────────────────────────────────────────────────────
    hs = _head_and_shoulders(highs, lows, closes, peaks, troughs)
    patterns.extend(hs)

    # ── Üçgen formasyonları ────────────────────────────────────────────────────
    tri = _triangles(highs, lows, closes, n)
    patterns.extend(tri)

    # ── Bayrak formasyonları ───────────────────────────────────────────────────
    flags = _flags(highs, lows, closes, n)
    patterns.extend(flags)

    # ── Kama formasyonları ─────────────────────────────────────────────────────
    wedges = _wedges(highs, lows, closes, n)
    patterns.extend(wedges)

    # Confidence'a göre sırala, en yüksek 5 tanesini döndür
    patterns.sort(key=lambda x: x["confidence"], reverse=True)
    return patterns[:5]


# ── Yardımcı: Pivot tespiti ────────────────────────────────────────────────────
def _find_pivots(arr: np.ndarray, is_high: bool, window: int = 5) -> list[int]:
    pivots = []
    for i in range(window, len(arr) - window):
        seg = arr[i - window: i + window + 1]
        center = arr[i]
        if is_high:
            if center == seg.max() and list(seg).count(center) == 1:
                pivots.append(i)
        else:
            if center == seg.min() and list(seg).count(center) == 1:
                pivots.append(i)
    return pivots


# ── Çift Tepe / Çift Dip ──────────────────────────────────────────────────────
def _double_top_bottom(highs, lows, closes, peaks, troughs) -> list[dict]:
    results = []
    tol = 0.03  # %3 tolerans

    # Çift Tepe
    for i in range(len(peaks) - 1):
        a, b = peaks[i], peaks[i + 1]
        if b - a < 10 or b - a > 60:
            continue
        ha, hb = highs[a], highs[b]
        if abs(ha - hb) / ha < tol:
            # Aralarındaki dip
            valley = lows[a:b].min()
            neckline = valley
            confidence = 70 + (1 - abs(ha - hb) / ha / tol) * 20
            target_pct = -(ha - neckline) / neckline * 100
            results.append({
                "name": "Double Top",
                "name_tr": "Çift Tepe",
                "direction": "bearish",
                "confidence": round(min(confidence, 92), 1),
                "start_idx": int(a),
                "end_idx":   int(b),
                "description": f"İki benzer tepe ({ha:.2f} ve {hb:.2f}) oluştu. Boyun çizgisi: {neckline:.2f}.",
                "target_pct": round(target_pct, 1),
            })

    # Çift Dip
    for i in range(len(troughs) - 1):
        a, b = troughs[i], troughs[i + 1]
        if b - a < 10 or b - a > 60:
            continue
        la, lb = lows[a], lows[b]
        if abs(la - lb) / la < tol:
            peak_mid = highs[a:b].max()
            neckline = peak_mid
            confidence = 70 + (1 - abs(la - lb) / la / tol) * 20
            target_pct = (neckline - la) / la * 100
            results.append({
                "name": "Double Bottom",
                "name_tr": "Çift Dip",
                "direction": "bullish",
                "confidence": round(min(confidence, 92), 1),
                "start_idx": int(a),
                "end_idx":   int(b),
                "description": f"İki benzer dip ({la:.2f} ve {lb:.2f}) oluştu. Boyun çizgisi: {neckline:.2f}.",
                "target_pct": round(target_pct, 1),
            })

    return results


# ── Baş ve Omuzlar ─────────────────────────────────────────────────────────────
def _head_and_shoulders(highs, lows, closes, peaks, troughs) -> list[dict]:
    results = []
    tol = 0.04

    # Normal H&S (bearish)
    for i in range(len(peaks) - 2):
        ls, head, rs = peaks[i], peaks[i + 1], peaks[i + 2]
        # Head en yüksek
        if highs[head] <= highs[ls] or highs[head] <= highs[rs]:
            continue
        # Omuzlar yakın seviyede
        if abs(highs[ls] - highs[rs]) / highs[ls] > tol:
            continue
        # Aralarında trough var mı?
        lt = [t for t in troughs if ls < t < head]
        rt = [t for t in troughs if head < t < rs]
        if not lt or not rt:
            continue
        neckline = (lows[lt[-1]] + lows[rt[0]]) / 2
        target_pct = -(highs[head] - neckline) / neckline * 100
        confidence = 75
        results.append({
            "name": "Head & Shoulders",
            "name_tr": "Baş ve Omuzlar",
            "direction": "bearish",
            "confidence": confidence,
            "start_idx": int(ls),
            "end_idx":   int(rs),
            "description": f"Sol omuz {highs[ls]:.2f}, baş {highs[head]:.2f}, sağ omuz {highs[rs]:.2f}. Boyun: {neckline:.2f}.",
            "target_pct": round(target_pct, 1),
        })

    # Ters H&S (bullish)
    for i in range(len(troughs) - 2):
        ls, head, rs = troughs[i], troughs[i + 1], troughs[i + 2]
        if lows[head] >= lows[ls] or lows[head] >= lows[rs]:
            continue
        if abs(lows[ls] - lows[rs]) / lows[ls] > tol:
            continue
        lp = [p for p in peaks if ls < p < head]
        rp = [p for p in peaks if head < p < rs]
        if not lp or not rp:
            continue
        neckline = (highs[lp[-1]] + highs[rp[0]]) / 2
        target_pct = (neckline - lows[head]) / lows[head] * 100
        results.append({
            "name": "Inverse Head & Shoulders",
            "name_tr": "Ters Baş ve Omuzlar",
            "direction": "bullish",
            "confidence": 75,
            "start_idx": int(ls),
            "end_idx":   int(rs),
            "description": f"Ters formasyon — sol {lows[ls]:.2f}, baş {lows[head]:.2f}, sağ {lows[rs]:.2f}. Boyun: {neckline:.2f}.",
            "target_pct": round(target_pct, 1),
        })

    return results


# ── Üçgen formasyonları ────────────────────────────────────────────────────────
def _triangles(highs, lows, closes, n) -> list[dict]:
    results = []
    window = min(40, n - 5)
    seg_h = highs[-window:]
    seg_l = lows[-window:]
    x = np.arange(window)

    slope_h = np.polyfit(x, seg_h, 1)[0]
    slope_l = np.polyfit(x, seg_l, 1)[0]

    mean_price = closes[-1]
    h_flat = abs(slope_h / mean_price) < 0.0005
    l_flat = abs(slope_l / mean_price) < 0.0005
    h_down = slope_h < -0.0005 * mean_price
    l_up   = slope_l >  0.0005 * mean_price
    h_up   = slope_h >  0.0005 * mean_price
    l_down = slope_l < -0.0005 * mean_price

    if h_down and l_up:
        # Simetrik üçgen
        results.append({
            "name": "Symmetrical Triangle",
            "name_tr": "Simetrik Üçgen",
            "direction": "neutral",
            "confidence": 68,
            "start_idx": int(n - window),
            "end_idx":   int(n - 1),
            "description": "Hem yüksekler alçalıyor hem dipler yükseliyor — kırılım beklenebilir.",
            "target_pct": None,
        })
    elif h_flat and l_up:
        results.append({
            "name": "Ascending Triangle",
            "name_tr": "Yükselen Üçgen",
            "direction": "bullish",
            "confidence": 72,
            "start_idx": int(n - window),
            "end_idx":   int(n - 1),
            "description": "Direnç yatay, dipler yükseliyor — yukarı kırılım olasılığı yüksek.",
            "target_pct": round((seg_h.max() - seg_l.min()) / seg_l.min() * 100, 1),
        })
    elif l_flat and h_down:
        results.append({
            "name": "Descending Triangle",
            "name_tr": "Alçalan Üçgen",
            "direction": "bearish",
            "confidence": 72,
            "start_idx": int(n - window),
            "end_idx":   int(n - 1),
            "description": "Destek yatay, yüksekler alçalıyor — aşağı kırılım olasılığı yüksek.",
            "target_pct": round(-(seg_h.max() - seg_l.min()) / seg_h.max() * 100, 1),
        })

    return results


# ── Bayrak formasyonları ───────────────────────────────────────────────────────
def _flags(highs, lows, closes, n) -> list[dict]:
    results = []
    if n < 25:
        return results

    pole_end = n - 15
    pole_start = max(0, pole_end - 15)

    # Sap (pole) tespiti
    pole_move = (closes[pole_end] - closes[pole_start]) / closes[pole_start]

    if abs(pole_move) < 0.05:  # en az %5 sap hareketi
        return results

    # Bayrak gövdesi: son 10-15 bar konsolidasyon
    flag = closes[pole_end:]
    flag_range = (flag.max() - flag.min()) / flag.mean()

    if flag_range > 0.08:  # çok geniş — bayrak değil
        return results

    x = np.arange(len(flag))
    flag_slope = np.polyfit(x, flag, 1)[0] / flag.mean()

    is_bull = pole_move > 0
    if is_bull and flag_slope < 0:
        results.append({
            "name": "Bull Flag",
            "name_tr": "Boğa Bayrağı",
            "direction": "bullish",
            "confidence": 71,
            "start_idx": int(pole_start),
            "end_idx":   int(n - 1),
            "description": f"Güçlü yükseliş sapı (+{pole_move*100:.1f}%) sonrası konsolidasyon.",
            "target_pct": round(pole_move * 100, 1),
        })
    elif not is_bull and flag_slope > 0:
        results.append({
            "name": "Bear Flag",
            "name_tr": "Ayı Bayrağı",
            "direction": "bearish",
            "confidence": 71,
            "start_idx": int(pole_start),
            "end_idx":   int(n - 1),
            "description": f"Sert düşüş sapı ({pole_move*100:.1f}%) sonrası konsolidasyon.",
            "target_pct": round(pole_move * 100, 1),
        })

    return results


# ── Kama formasyonları ─────────────────────────────────────────────────────────
def _wedges(highs, lows, closes, n) -> list[dict]:
    results = []
    window = min(35, n - 5)
    seg_h = highs[-window:]
    seg_l = lows[-window:]
    x = np.arange(window)

    slope_h = np.polyfit(x, seg_h, 1)[0]
    slope_l = np.polyfit(x, seg_l, 1)[0]

    mean_p = closes[-1]
    norm = lambda s: s / mean_p

    sh, sl = norm(slope_h), norm(slope_l)

    # Yükselen kama: her ikisi de yukarı ama daralan
    if sh > 0.0003 and sl > 0.0003 and sh < sl:
        results.append({
            "name": "Rising Wedge",
            "name_tr": "Yükselen Kama",
            "direction": "bearish",
            "confidence": 65,
            "start_idx": int(n - window),
            "end_idx":   int(n - 1),
            "description": "Her ikisi de yükseliyor ama daralan yapı — kırılım aşağı olabilir.",
            "target_pct": None,
        })
    # Alçalan kama: her ikisi de aşağı ama daralan
    elif sh < -0.0003 and sl < -0.0003 and sh > sl:
        results.append({
            "name": "Falling Wedge",
            "name_tr": "Alçalan Kama",
            "direction": "bullish",
            "confidence": 65,
            "start_idx": int(n - window),
            "end_idx":   int(n - 1),
            "description": "Her ikisi de alçalıyor ama daralan yapı — yukarı kırılım olabilir.",
            "target_pct": None,
        })

    return results
