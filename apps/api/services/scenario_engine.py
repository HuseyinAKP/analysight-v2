"""Scenario band engine: Bull / Base / Bear price targets + uncertainty index."""
import numpy as np
import pandas as pd
from .technical_analysis import calc_rsi, calc_atr, calc_ema


def build_scenarios(df: pd.DataFrame) -> dict:
    close = df["close"]
    current = close.iloc[-1]
    atr = calc_atr(df).iloc[-1]
    rsi = calc_rsi(close).iloc[-1]
    ema20 = calc_ema(close, 20).iloc[-1]
    ema50 = calc_ema(close, 50).iloc[-1]

    volatility = close.pct_change().std() * np.sqrt(252)

    trend_strength = (current - ema50) / ema50

    # Horizon: 4-week price targets
    atr_mult_bull = 3.5
    atr_mult_base = 1.8
    atr_mult_bear = -2.5

    bull_target = round(current + atr * atr_mult_bull, 2)
    base_target = round(current + atr * atr_mult_base, 2)
    bear_target = round(current + atr * atr_mult_bear, 2)

    # Probability weights adjusted by RSI and trend
    bull_w = 0.30
    base_w = 0.45
    bear_w = 0.25

    if rsi > 65:
        bull_w += 0.05
        bear_w -= 0.05
    elif rsi < 35:
        bear_w += 0.08
        bull_w -= 0.08

    if trend_strength > 0.03:
        bull_w += 0.05
        bear_w -= 0.05
    elif trend_strength < -0.03:
        bear_w += 0.05
        bull_w -= 0.05

    total = bull_w + base_w + bear_w
    bull_w, base_w, bear_w = bull_w / total, base_w / total, bear_w / total

    # Uncertainty index 0-100: higher when indicators conflict or volatility spikes
    vol_score = min(volatility / 0.8 * 50, 50)
    divergence = abs(rsi - 50) / 50
    conflict_score = (1 - divergence) * 30
    uncertainty = round(min(vol_score + conflict_score + 10, 100), 1)

    return {
        "current_price": round(current, 2),
        "horizon_days": 28,
        "scenarios": {
            "bull": {
                "target": bull_target,
                "probability": round(bull_w * 100, 1),
                "upside_pct": round((bull_target - current) / current * 100, 2),
            },
            "base": {
                "target": base_target,
                "probability": round(base_w * 100, 1),
                "upside_pct": round((base_target - current) / current * 100, 2),
            },
            "bear": {
                "target": bear_target,
                "probability": round(bear_w * 100, 1),
                "downside_pct": round((bear_target - current) / current * 100, 2),
            },
        },
        "uncertainty_index": uncertainty,
        "volatility_annual_pct": round(volatility * 100, 2),
    }
