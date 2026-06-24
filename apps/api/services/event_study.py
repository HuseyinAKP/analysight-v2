"""
Event Study: Geçmişte benzer fiyat hareketleri bulunur,
5/10/20 gün sonraki getiri istatistikleri hesaplanır.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def find_similar_events(df: pd.DataFrame, lookback_window: int = 5) -> dict:
    close = df["close"].values
    dates = df["date"].dt.strftime("%Y-%m-%d").values
    n = len(close)

    if n < 30:
        return {"events": [], "stats": {}}

    # Current move: last `lookback_window` days return
    current_return = (close[-1] - close[-1 - lookback_window]) / close[-1 - lookback_window] * 100
    direction = "yükseliş" if current_return > 0 else "düşüş"
    threshold = abs(current_return) * 0.6  # at least 60% similar magnitude

    events = []
    for i in range(lookback_window, n - 21):
        past_return = (close[i] - close[i - lookback_window]) / close[i - lookback_window] * 100
        if abs(past_return) >= threshold and (past_return * current_return > 0):
            ret5  = (close[min(i + 5,  n - 1)] - close[i]) / close[i] * 100
            ret10 = (close[min(i + 10, n - 1)] - close[i]) / close[i] * 100
            ret20 = (close[min(i + 20, n - 1)] - close[i]) / close[i] * 100
            events.append({
                "date": dates[i],
                "trigger_return": round(past_return, 2),
                "ret5":  round(ret5, 2),
                "ret10": round(ret10, 2),
                "ret20": round(ret20, 2),
            })

    if not events:
        return {
            "current_move_pct": round(current_return, 2),
            "direction": direction,
            "events": [],
            "stats": None,
        }

    ret5s  = [e["ret5"]  for e in events]
    ret10s = [e["ret10"] for e in events]
    ret20s = [e["ret20"] for e in events]

    stats = {
        "count": len(events),
        "avg_ret5":  round(np.mean(ret5s), 2),
        "avg_ret10": round(np.mean(ret10s), 2),
        "avg_ret20": round(np.mean(ret20s), 2),
        "positive_5d":  round(sum(1 for r in ret5s  if r > 0) / len(ret5s)  * 100, 1),
        "positive_10d": round(sum(1 for r in ret10s if r > 0) / len(ret10s) * 100, 1),
        "positive_20d": round(sum(1 for r in ret20s if r > 0) / len(ret20s) * 100, 1),
    }

    return {
        "current_move_pct": round(current_return, 2),
        "direction": direction,
        "events": events[-5:],
        "stats": stats,
    }
