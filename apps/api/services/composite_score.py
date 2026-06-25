"""
Composite Score — 0-100 tek sayılı genel değerlendirme

Ağırlıklar:
  ML (XGBoost 5g)         %30
  Teknik Confluence        %25
  Trend (EMA + ADX)        %20
  Risk (Belirsizlik ters)  %15
  Momentum (RSI + MACD)    %10
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional


def compute(
    rsi: float,
    macd_bullish: bool,
    confluence_score: float,
    adx: float,
    price_vs_ema50_pct: float,   # (price/ema50 - 1) * 100
    price_vs_ema200_pct: float,
    uncertainty: float,          # 0-100 (yüksek = kötü)
    bull_prob: float,            # senaryo olasılığı 0-100
    ml_prob_5d: Optional[float] = None,  # XGBoost 0-100
) -> dict:
    """
    Tüm bileşenlerden 0-100 composite skor üretir.
    Her bileşen kendi alt-skorunu 0-100 döner, sonra ağırlıklı ortalama.
    """

    # ── 1. ML bileşeni ─────────────────────────────────────────────────────────
    if ml_prob_5d is not None:
        ml_score = float(ml_prob_5d)   # zaten 0-100
        ml_weight = 0.30
    else:
        ml_score  = 50.0
        ml_weight = 0.0   # model yoksa bu bileşeni sıfırla, diğerlerine dağıt

    # ── 2. Teknik Confluence ───────────────────────────────────────────────────
    tech_score = float(np.clip(confluence_score, 0, 100))

    # ── 3. Trend ──────────────────────────────────────────────────────────────
    trend_score = 50.0
    # EMA50 üstünde mi?
    if price_vs_ema50_pct > 5:    trend_score += 20
    elif price_vs_ema50_pct > 0:  trend_score += 10
    elif price_vs_ema50_pct < -5: trend_score -= 20
    elif price_vs_ema50_pct < 0:  trend_score -= 10
    # EMA200
    if price_vs_ema200_pct > 0:   trend_score += 10
    else:                          trend_score -= 10
    # ADX trend gücü
    if adx >= 30:    trend_score += 15
    elif adx >= 20:  trend_score += 7
    elif adx < 15:   trend_score -= 7
    trend_score = float(np.clip(trend_score, 0, 100))

    # ── 4. Risk ───────────────────────────────────────────────────────────────
    # Düşük belirsizlik → iyi; boğa senaryosu olasılığı → iyi
    risk_score = (100 - uncertainty) * 0.5 + bull_prob * 0.5
    risk_score = float(np.clip(risk_score, 0, 100))

    # ── 5. Momentum ───────────────────────────────────────────────────────────
    momentum_score = 50.0
    # RSI
    if rsi <= 30:    momentum_score += 25    # aşırı satım = potansiyel
    elif rsi <= 45:  momentum_score += 10
    elif rsi >= 70:  momentum_score -= 20    # aşırı alım = dikkat
    elif rsi >= 60:  momentum_score -= 5
    # MACD
    if macd_bullish: momentum_score += 15
    else:            momentum_score -= 10
    momentum_score = float(np.clip(momentum_score, 0, 100))

    # ── Ağırlıklı birleştirme ─────────────────────────────────────────────────
    if ml_weight == 0:
        # ML yok: kalan ağırlıkları orantısal artır
        weights = {"tech": 0.35, "trend": 0.28, "risk": 0.22, "momentum": 0.15}
    else:
        weights = {
            "ml":       ml_weight,
            "tech":     0.25,
            "trend":    0.20,
            "risk":     0.15,
            "momentum": 0.10,
        }

    if ml_weight > 0:
        composite = (
            ml_score       * weights["ml"] +
            tech_score     * weights["tech"] +
            trend_score    * weights["trend"] +
            risk_score     * weights["risk"] +
            momentum_score * weights["momentum"]
        )
    else:
        composite = (
            tech_score     * weights["tech"] +
            trend_score    * weights["trend"] +
            risk_score     * weights["risk"] +
            momentum_score * weights["momentum"]
        )

    composite = round(float(np.clip(composite, 0, 100)), 1)

    # ── Etiket ────────────────────────────────────────────────────────────────
    if composite >= 72:
        label, color = "Güçlü Fırsat", "emerald"
    elif composite >= 58:
        label, color = "Pozitif Sinyal", "blue"
    elif composite >= 42:
        label, color = "Nötr", "zinc"
    elif composite >= 28:
        label, color = "Zayıf Sinyal", "amber"
    else:
        label, color = "Riskli", "red"

    return {
        "score":   composite,
        "label":   label,
        "color":   color,
        "components": {
            "ml":       round(ml_score, 1),
            "technical": round(tech_score, 1),
            "trend":    round(trend_score, 1),
            "risk":     round(risk_score, 1),
            "momentum": round(momentum_score, 1),
        },
        "ml_available": ml_weight > 0,
    }
