"""
ML Tahminleri: XGBoost tabanlı 5/10/20 günlük yükseliş olasılığı.

Model yoksa heuristik sigmoid'e otomatik fallback yapar.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .technical_analysis import calc_rsi, calc_ema, calc_atr


def _sigmoid(x: float) -> float:
    return 1 / (1 + np.exp(-x))


def _heuristic_forecast(df: pd.DataFrame) -> dict:
    """Orijinal heuristik model — XGBoost yokken fallback."""
    close = df["close"] if "close" in df.columns else df["Close"]
    n = len(close)

    rsi   = calc_rsi(close).iloc[-1]
    ema20 = calc_ema(close, 20).iloc[-1]
    ema50 = calc_ema(close, 50).iloc[-1]
    atr   = calc_atr(df).iloc[-1]
    curr  = close.iloc[-1]

    ret5  = close.pct_change(5).dropna()
    ret10 = close.pct_change(10).dropna()
    ret20 = close.pct_change(20).dropna()

    hist_vol_5  = ret5.std() * np.sqrt(252)
    hist_vol_10 = ret10.std() * np.sqrt(252)
    hist_vol_20 = ret20.std() * np.sqrt(252)

    trend_score = (curr - ema50) / ema50
    rsi_score   = (50 - rsi) / 50
    vol_penalty = min(hist_vol_5 / 0.6, 1.0)
    base_score  = trend_score * 0.5 + rsi_score * 0.3 - vol_penalty * 0.1

    decay  = [1.0, 0.85, 0.70]
    prob5  = round(_sigmoid(base_score * 2.5 * decay[0]) * 100, 1)
    prob10 = round(_sigmoid(base_score * 2.5 * decay[1]) * 100, 1)
    prob20 = round(_sigmoid(base_score * 2.5 * decay[2]) * 100, 1)

    exp5  = round(ret5.mean()  * 100 + trend_score * 0.5, 2)
    exp10 = round(ret10.mean() * 100 + trend_score * 0.8, 2)
    exp20 = round(ret20.mean() * 100 + trend_score * 1.0, 2)

    def confidence(prob: float) -> str:
        if prob >= 65: return "Yüksek"
        if prob >= 55: return "Orta"
        return "Düşük"

    return {
        "model": "Heuristik Model (fallback)",
        "disclaimer": "Bu tahminler yatırım tavsiyesi değildir.",
        "ml_version": False,
        "forecasts": [
            {"horizon_days": 5,  "up_probability": prob5,  "expected_return_pct": exp5,
             "volatility_pct": round(hist_vol_5  * 100 / np.sqrt(252/5),  2), "confidence": confidence(prob5)},
            {"horizon_days": 10, "up_probability": prob10, "expected_return_pct": exp10,
             "volatility_pct": round(hist_vol_10 * 100 / np.sqrt(252/10), 2), "confidence": confidence(prob10)},
            {"horizon_days": 20, "up_probability": prob20, "expected_return_pct": exp20,
             "volatility_pct": round(hist_vol_20 * 100 / np.sqrt(252/20), 2), "confidence": confidence(prob20)},
        ],
    }


def forecast(df: pd.DataFrame) -> dict:
    """
    Ana tahmin fonksiyonu.
    - XGBoost modeli varsa → gerçek ML tahmini döner
    - Model yoksa → heuristik sigmoid'e fallback
    """
    # df sütun adlarını normalize et (close/Close karışıklığı)
    df_norm = df.copy()
    df_norm.columns = [c.capitalize() for c in df_norm.columns]
    if "Close" not in df_norm.columns:
        return _heuristic_forecast(df)

    try:
        from services.ml_engine import predict, models_exist, model_info
        if not models_exist():
            return _heuristic_forecast(df)

        ml_result = predict(df_norm)
        if not ml_result:
            return _heuristic_forecast(df)

        # Beklenen getiri için geçmiş ortalamaları kullan
        close = df_norm["Close"].astype(float)
        ret5  = close.pct_change(5).dropna()
        ret10 = close.pct_change(10).dropna()
        ret20 = close.pct_change(20).dropna()

        def conf(prob: float) -> str:
            if prob >= 65: return "Yüksek"
            if prob >= 55: return "Orta"
            return "Düşük"

        info = model_info()

        forecasts = []
        for h, ret in [(5, ret5), (10, ret10), (20, ret20)]:
            prob_key = f"prob{h}"
            prob = ml_result.get(prob_key, 50.0)
            exp  = round(float(ret.mean()) * 100, 2) if len(ret) else 0.0
            # Getiriyi olasılıkla ağırlıklandır
            exp_adj = round(exp * (prob / 50), 2)
            vol = round(float(ret.std()) * 100 * np.sqrt(252 / h), 2) if len(ret) else 0.0
            forecasts.append({
                "horizon_days":        h,
                "up_probability":      prob,
                "expected_return_pct": exp_adj,
                "volatility_pct":      vol,
                "confidence":          conf(prob),
            })

        result = {
            "model": "XGBoost (25 sembol, 5 yıl geçmiş)",
            "trained_at": info.get("trained_at", "—"),
            "disclaimer": "Bu tahminler yatırım tavsiyesi değildir.",
            "ml_version": True,
            "forecasts": forecasts,
        }

        if "top_features" in ml_result:
            result["top_features"] = ml_result["top_features"]

        return result

    except Exception as e:
        return _heuristic_forecast(df)
