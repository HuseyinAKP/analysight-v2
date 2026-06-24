"""
Sosyal Sinyal Motoru — Simüle veri (MVP).
Gerçek X/Twitter API entegrasyonu sonraki fazda.
"""
from __future__ import annotations
import numpy as np
import random
from datetime import datetime


def get_social_signals(symbol: str) -> dict:
    rng = np.random.default_rng(hash(symbol + str(datetime.now().date())) % 2**31)

    base_mentions = {
        "THYAO": 420, "GARAN": 310, "EREGL": 180, "SISE": 140, "ASELS": 260,
        "AAPL": 8500, "MSFT": 6200, "NVDA": 11000,
        "BTC-USD": 45000, "ETH-USD": 18000,
    }.get(symbol.upper(), 500)

    spike = rng.uniform(0.7, 2.5)
    mentions_15m = int(base_mentions * spike / 100)
    mentions_1h  = int(base_mentions * spike / 24)

    daily_avg = base_mentions // 24
    deviation_score = round((mentions_1h - daily_avg) / max(daily_avg, 1) * 100, 1)

    sentiment_score = round(float(rng.uniform(-0.4, 0.8)), 2)
    influencer_sentiment = round(float(rng.uniform(-0.2, 0.9)), 2)

    coordination_score = round(float(rng.uniform(0.0, 0.35)), 2)

    if sentiment_score > 0.4:
        sentiment_label = "Güçlü Pozitif"
        sentiment_color = "green"
    elif sentiment_score > 0.1:
        sentiment_label = "Hafif Pozitif"
        sentiment_color = "light-green"
    elif sentiment_score < -0.2:
        sentiment_label = "Negatif"
        sentiment_color = "red"
    else:
        sentiment_label = "Nötr"
        sentiment_color = "gray"

    coord_label = "Yüksek — Dikkatli Olun" if coordination_score > 0.25 else \
                  "Orta" if coordination_score > 0.15 else "Normal"

    dev_label = "Anormal Artış" if deviation_score > 80 else \
                "Hafif Artış" if deviation_score > 30 else \
                "Normal" if deviation_score > -20 else "Düşük Aktivite"

    # Top keywords (mock)
    keywords_pool = {
        "THYAO": ["THY", "havacılık", "temettü", "kâr", "sefer"],
        "GARAN": ["banka", "faiz", "kredi", "kâr", "BDDK"],
        "AAPL": ["iPhone", "Apple", "AI", "earnings", "Tim Cook"],
        "NVDA": ["GPU", "AI", "Blackwell", "datacenter", "Jensen"],
        "BTC-USD": ["bitcoin", "BTC", "halving", "ETF", "kripto"],
    }
    kw = keywords_pool.get(symbol.upper(), ["analiz", "teknik", "hacim", "fiyat", "trend"])
    random.seed(hash(symbol))
    selected_kw = random.sample(kw, min(3, len(kw)))

    return {
        "symbol": symbol.upper(),
        "data_source": "Simüle Veri (MVP) — X/Twitter API yakında",
        "mentions": {
            "last_15min": mentions_15m,
            "last_1h": mentions_1h,
            "daily_avg": daily_avg,
        },
        "deviation_score": deviation_score,
        "deviation_label": dev_label,
        "sentiment": {
            "score": sentiment_score,
            "label": sentiment_label,
            "color": sentiment_color,
        },
        "influencer_sentiment": {
            "score": influencer_sentiment,
            "label": "Pozitif" if influencer_sentiment > 0 else "Negatif",
        },
        "coordination_score": coordination_score,
        "coordination_label": coord_label,
        "top_keywords": selected_kw,
    }


def get_why_chain(symbol: str, indicators: dict, news: list, social: dict) -> dict:
    """
    'Neden yükseldi/düştü?' ve 'Neden yükselebilir/düşebilir?' açıklamaları üretir.
    Teknik sinyaller + haber + sosyal veriyi birleştirir.
    """
    rsi = indicators.get("rsi", 50)
    macd = indicators.get("macd", 0)
    macd_signal = indicators.get("macd_signal", 0)
    bb_upper = indicators.get("bb_upper", 0)
    bb_lower = indicators.get("bb_lower", 0)
    current = indicators.get("series", {}).get("close", [0])[-1] if indicators.get("series") else 0

    # Technical signals
    tech_signals = []
    if rsi <= 30:
        tech_signals.append({"signal": "RSI aşırı satım bölgesinde", "direction": "bullish", "strength": "strong"})
    elif rsi >= 70:
        tech_signals.append({"signal": "RSI aşırı alım bölgesinde", "direction": "bearish", "strength": "strong"})

    if macd > macd_signal:
        tech_signals.append({"signal": "MACD pozitif kesişim yaptı", "direction": "bullish", "strength": "medium"})
    else:
        tech_signals.append({"signal": "MACD negatif kesişim yaptı", "direction": "bearish", "strength": "medium"})

    if bb_upper and current > bb_upper * 0.98:
        tech_signals.append({"signal": "Fiyat üst Bollinger bandına yaklaştı", "direction": "bearish", "strength": "medium"})
    elif bb_lower and current < bb_lower * 1.02:
        tech_signals.append({"signal": "Fiyat alt Bollinger bandına yaklaştı", "direction": "bullish", "strength": "medium"})

    # Conflict detection
    bull_count = sum(1 for s in tech_signals if s["direction"] == "bullish")
    bear_count = sum(1 for s in tech_signals if s["direction"] == "bearish")

    conflict = bull_count > 0 and bear_count > 0
    dominant = "bullish" if bull_count > bear_count else "bearish" if bear_count > bull_count else "neutral"

    # News signals
    news_signals = []
    for n in news[:3]:
        news_signals.append({
            "headline": n["headline"],
            "category": n["category_label"],
            "sentiment": n["sentiment"],
        })

    # Social
    social_signal = {
        "label": social["deviation_label"],
        "sentiment": social["sentiment"]["label"],
        "coordination": social["coordination_label"],
    }

    # Conflict warning
    tech_dom = dominant
    news_dom = "bullish" if sum(1 for n in news if n["sentiment"] == "positive") > len(news) / 2 else "bearish"
    conflict_warning = tech_dom != "neutral" and news_dom != "neutral" and tech_dom != news_dom

    # "Neden oldu" — recent moves
    why_happened = []
    pos_news = [n for n in news if n["sentiment"] == "positive"][:1]
    neg_news = [n for n in news if n["sentiment"] == "negative"][:1]

    if pos_news:
        why_happened.append(f"Son 48 saatte olumlu haber: '{pos_news[0]['headline']}'")
    if neg_news:
        why_happened.append(f"Baskı yaratan haber: '{neg_news[0]['headline']}'")

    if rsi <= 30:
        why_happened.append("RSI aşırı satım bölgesine geriledi — teknik tepki beklentisi var")
    elif rsi >= 70:
        why_happened.append("RSI aşırı alım — kâr realizasyonu baskısı artabilir")

    if social["deviation_score"] > 60:
        why_happened.append(f"Sosyal medyada anormal aktivite tespit edildi ({social['deviation_label']})")

    # "Neden olabilir"
    why_might = []
    if dominant == "bullish":
        why_might.append("Teknik tablo yükseliş sinyali veriyor — momentum devam edebilir")
    elif dominant == "bearish":
        why_might.append("Teknik göstergeler düşüş yönünde — destek kırılımı riski var")

    if conflict_warning:
        why_might.append("⚠️ DİKKAT: Teknik tablo ile haber akışı çelişiyor — belirsizlik yüksek")

    if social["coordination_score"] > 0.25:
        why_might.append("Sosyal medyada koordineli hareket tespiti — fiyata yapay baskı olabilir")

    return {
        "why_happened": why_happened,
        "why_might": why_might,
        "technical_signals": tech_signals,
        "news_signals": news_signals,
        "social_signal": social_signal,
        "conflict_detected": conflict_warning,
        "dominant_direction": dominant,
    }
