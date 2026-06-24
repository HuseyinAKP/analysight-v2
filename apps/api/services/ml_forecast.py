"""
ML Tahminleri: 5/10/20 günlük yükselme olasılığı, beklenen getiri, volatilite.
Şeffaf ve yorumlanabilir istatistiksel modeller (logistic regression tarzı).
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .technical_analysis import calc_rsi, calc_ema, calc_atr


def _sigmoid(x: float) -> float:
    return 1 / (1 + np.exp(-x))


def forecast(df: pd.DataFrame) -> dict:
    close = df["close"]
    n = len(close)

    rsi   = calc_rsi(close).iloc[-1]
    ema20 = calc_ema(close, 20).iloc[-1]
    ema50 = calc_ema(close, 50).iloc[-1]
    atr   = calc_atr(df).iloc[-1]
    curr  = close.iloc[-1]

    # Rolling returns for historical base rates
    ret5  = close.pct_change(5).dropna()
    ret10 = close.pct_change(10).dropna()
    ret20 = close.pct_change(20).dropna()

    hist_vol_5  = ret5.std() * np.sqrt(252)
    hist_vol_10 = ret10.std() * np.sqrt(252)
    hist_vol_20 = ret20.std() * np.sqrt(252)

    # Simple factor score
    trend_score = (curr - ema50) / ema50          # positive = above 50 ema
    rsi_score   = (50 - rsi) / 50                 # positive when oversold
    vol_penalty = min(hist_vol_5 / 0.6, 1.0)      # high vol → uncertainty

    base_score = trend_score * 0.5 + rsi_score * 0.3 - vol_penalty * 0.1

    # Horizon-adjusted probabilities
    decay = [1.0, 0.85, 0.70]  # confidence decays at longer horizons
    prob5  = round(_sigmoid(base_score * 2.5 * decay[0]) * 100, 1)
    prob10 = round(_sigmoid(base_score * 2.5 * decay[1]) * 100, 1)
    prob20 = round(_sigmoid(base_score * 2.5 * decay[2]) * 100, 1)

    # Expected returns (historical mean + trend tilt)
    exp5  = round(ret5.mean()  * 100 + trend_score * 0.5, 2)
    exp10 = round(ret10.mean() * 100 + trend_score * 0.8, 2)
    exp20 = round(ret20.mean() * 100 + trend_score * 1.0, 2)

    def confidence(prob: float) -> str:
        if prob >= 65: return "Yüksek"
        if prob >= 55: return "Orta"
        return "Düşük"

    return {
        "model": "Temel İstatistiksel Model (MVP)",
        "disclaimer": "Bu tahminler yatırım tavsiyesi değildir.",
        "forecasts": [
            {
                "horizon_days": 5,
                "up_probability": prob5,
                "expected_return_pct": exp5,
                "volatility_pct": round(hist_vol_5 * 100 / np.sqrt(252 / 5), 2),
                "confidence": confidence(prob5),
            },
            {
                "horizon_days": 10,
                "up_probability": prob10,
                "expected_return_pct": exp10,
                "volatility_pct": round(hist_vol_10 * 100 / np.sqrt(252 / 10), 2),
                "confidence": confidence(prob10),
            },
            {
                "horizon_days": 20,
                "up_probability": prob20,
                "expected_return_pct": exp20,
                "volatility_pct": round(hist_vol_20 * 100 / np.sqrt(252 / 20), 2),
                "confidence": confidence(prob20),
            },
        ],
    }
