"""
Trade Setup Analyzer: Grafik pattern tespiti, alım/satım kurulumu, destek/direnç.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .technical_analysis import calc_rsi, calc_ema, calc_atr, calc_macd
from .market_structure import calc_adx, calc_stochastic, find_swing_points


def detect_setup(df: pd.DataFrame) -> dict:
    """Ana trade setup analizi."""
    close = df["close"].values
    high  = df["high"].values
    low   = df["low"].values

    close_s = pd.Series(close)
    rsi     = calc_rsi(close_s)
    ema20   = float(calc_ema(close_s, 20).iloc[-1])
    ema50   = float(calc_ema(close_s, 50).iloc[-1])
    ema200  = float(calc_ema(close_s, 200).iloc[-1])
    atr     = float(calc_atr(df).iloc[-1])
    macd_data = calc_macd(close_s)
    macd_line = macd_data["macd"]
    macd_sig  = macd_data["signal"]
    adx_data  = calc_adx(df)
    stoch     = calc_stochastic(df)
    swings    = find_swing_points(df)

    curr  = float(close[-1])
    rsi_v = float(rsi.iloc[-1]) if hasattr(rsi, "iloc") else float(rsi)
    adx_v = float(adx_data["adx"])
    macd_v = float(macd_line.iloc[-1]) if hasattr(macd_line, "iloc") else float(macd_line)
    msig_v = float(macd_sig.iloc[-1]) if hasattr(macd_sig, "iloc") else float(macd_sig)
    macd_bull = macd_v > msig_v

    # ── Support / Resistance ─────────────────────────────────────────────────
    recent_highs = sorted([s["price"] for s in swings["swing_highs"]], reverse=True)
    recent_lows  = sorted([s["price"] for s in swings["swing_lows"]])

    resistances = [r for r in recent_highs if r > curr][:3]
    supports    = [s for s in recent_lows if s < curr][:3]

    nearest_resistance = resistances[0] if resistances else curr * 1.05
    nearest_support    = supports[0]    if supports    else curr * 0.95

    # ── Pattern Detection ────────────────────────────────────────────────────
    patterns = []

    # Breakout: price > recent resistance with ADX
    if len(recent_highs) >= 2 and curr > recent_highs[1] and adx_v > 20:
        patterns.append({
            "name": "Kırılım (Breakout)",
            "type": "bullish",
            "description": f"Fiyat {recent_highs[1]:.2f} direncini kırdı. ADX {adx_v:.1f} ile trend güçleniyor.",
            "strength": "güçlü" if adx_v > 25 else "orta",
            "emoji": "🚀",
        })

    # Pullback to EMA: price near EMA20 in uptrend
    if curr > ema50 and abs(curr - ema20) / curr < 0.025 and rsi_v < 55:
        patterns.append({
            "name": "EMA20 Geri Çekilmesi",
            "type": "bullish",
            "description": f"Yükselen trendde EMA20 ({ema20:.2f}) üzerine geri çekilme — olası alım noktası.",
            "strength": "orta",
            "emoji": "📐",
        })

    # Oversold bounce
    if rsi_v < 32 and curr > ema200 and macd_bull:
        patterns.append({
            "name": "Aşırı Satım Toparlanması",
            "type": "bullish",
            "description": f"RSI {rsi_v:.1f} aşırı satım bölgesinde, uzun vadeli trend yukarı.",
            "strength": "orta",
            "emoji": "💚",
        })

    # Golden cross (EMA20 > EMA50)
    if ema20 > ema50 and ema50 > ema200:
        patterns.append({
            "name": "Altın Çaprazlama",
            "type": "bullish",
            "description": "EMA20 > EMA50 > EMA200 — boğa dizilimi aktif.",
            "strength": "güçlü",
            "emoji": "⭐",
        })

    # Overbought warning
    if rsi_v > 72 and stoch["k"] > 80:
        patterns.append({
            "name": "Aşırı Alım Bölgesi",
            "type": "bearish",
            "description": f"RSI {rsi_v:.1f} + Stochastic {stoch['k']:.1f} — dikkat, olası kar satışı.",
            "strength": "orta",
            "emoji": "🔴",
        })

    # Death cross
    if ema20 < ema50 and ema50 < ema200:
        patterns.append({
            "name": "Ölüm Çaprazlama",
            "type": "bearish",
            "description": "EMA20 < EMA50 < EMA200 — ayı dizilimi aktif.",
            "strength": "güçlü",
            "emoji": "💀",
        })

    # Neutral / consolidation
    if not patterns and adx_v < 20:
        patterns.append({
            "name": "Yatay Konsolidasyon",
            "type": "neutral",
            "description": f"ADX {adx_v:.1f} — belirgin trend yok, yatay bant içinde hareket.",
            "strength": "zayıf",
            "emoji": "↔️",
        })

    # ── Trade Plan (primary setup) ───────────────────────────────────────────
    primary = patterns[0] if patterns else None
    if primary and primary["type"] == "bullish":
        stop    = round(nearest_support * 0.985, 2)
        target1 = round(nearest_resistance, 2)
        target2 = round(curr + (curr - stop) * 2.5, 2)
        rr1     = round((target1 - curr) / (curr - stop), 2) if curr > stop else 0
    elif primary and primary["type"] == "bearish":
        stop    = round(nearest_resistance * 1.015, 2)
        target1 = round(nearest_support, 2)
        target2 = round(curr - (stop - curr) * 2.5, 2)
        rr1     = round((curr - target1) / (stop - curr), 2) if stop > curr else 0
    else:
        stop    = round(curr * 0.96, 2)
        target1 = round(nearest_resistance, 2)
        target2 = round(curr * 1.08, 2)
        rr1     = 1.0

    # ── Overall Bias ──────────────────────────────────────────────────────────
    bull_signals = sum(1 for p in patterns if p["type"] == "bullish")
    bear_signals = sum(1 for p in patterns if p["type"] == "bearish")
    if bull_signals > bear_signals:
        bias = "bullish"; bias_label = "Boğa"; bias_color = "emerald"
    elif bear_signals > bull_signals:
        bias = "bearish"; bias_label = "Ayı"; bias_color = "red"
    else:
        bias = "neutral"; bias_label = "Nötr"; bias_color = "yellow"

    # ── Market Commentary ─────────────────────────────────────────────────────
    commentary_lines = _build_commentary(curr, rsi_v, bool(macd_bull), adx_v, stoch, ema20, ema50, ema200, patterns)

    return {
        "current_price": round(curr, 2),
        "bias": bias,
        "bias_label": bias_label,
        "bias_color": bias_color,
        "patterns": patterns,
        "support_resistance": {
            "resistances": [round(r, 2) for r in resistances],
            "supports":    [round(s, 2) for s in supports],
            "nearest_resistance": round(nearest_resistance, 2),
            "nearest_support":    round(nearest_support, 2),
        },
        "trade_plan": {
            "direction": "long" if (primary and primary["type"] == "bullish") else "short" if (primary and primary["type"] == "bearish") else "wait",
            "entry":   round(curr, 2),
            "stop":    stop,
            "target1": target1,
            "target2": target2,
            "rr_ratio": rr1,
            "risk_pct": round(abs(curr - stop) / curr * 100, 2),
        },
        "indicators": {
            "rsi": round(rsi_v, 1),
            "adx": round(adx_v, 1),
            "adx_label": adx_data["label"],
            "macd_bullish": bool(macd_bull),
            "stoch_k": round(float(stoch["k"]), 1),
            "stoch_signal": stoch["signal"],
            "ema20": round(ema20, 2),
            "ema50": round(ema50, 2),
            "ema200": round(ema200, 2),
            "atr": round(float(atr), 2),
        },
        "commentary": commentary_lines,
    }


def _build_commentary(curr, rsi, macd_bull, adx, stoch, ema20, ema50, ema200, patterns) -> list[str]:
    lines = []
    # Price vs EMAs
    if curr > ema20 > ema50 > ema200:
        lines.append(f"Fiyat tüm hareketli ortalamaların üzerinde — güçlü boğa dizilimi devam ediyor.")
    elif curr < ema20 < ema50:
        lines.append(f"Fiyat EMA20 ve EMA50'nin altında — kısa-orta vadeli baskı sürüyor.")
    elif curr > ema50 and curr < ema20:
        lines.append(f"EMA50 üzerinde ancak EMA20 altında — konsolidasyon ya da dönüş noktası olabilir.")

    # RSI
    if rsi > 70:
        lines.append(f"RSI {rsi:.1f} aşırı alım bölgesinde; momentumun zayıflaması ya da düzeltme riski var.")
    elif rsi < 30:
        lines.append(f"RSI {rsi:.1f} aşırı satım bölgesinde; olası teknik toparlanma için zemin oluşabilir.")
    else:
        lines.append(f"RSI {rsi:.1f} nötr bölgede — belirgin bir aşırılık sinyali yok.")

    # MACD
    lines.append(f"MACD {'pozitif momentum (yükseliş sinyali)' if macd_bull else 'negatif momentum (düşüş baskısı)'} gösteriyor.")

    # ADX
    if adx > 25:
        lines.append(f"ADX {adx:.1f} ile güçlü bir trend ortamı var — trend takip stratejileri avantajlı.")
    else:
        lines.append(f"ADX {adx:.1f} — trendsiz ortam, aralık içi stratejiler daha uygun olabilir.")

    return lines
