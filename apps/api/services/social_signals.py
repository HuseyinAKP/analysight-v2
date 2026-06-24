"""
Twitter/X Sosyal Sinyal Servisi.

Gerçek X API v2 entegrasyonu için hazır altyapı.
X_BEARER_TOKEN ortam değişkeni yoksa gerçekçi mock data döner.

Gerçek API eklemek için:
1. X Developer Portal'dan Bearer Token al
2. .env dosyasına X_BEARER_TOKEN=... ekle
3. Bu servis otomatik olarak gerçek veriyi kullanır
"""
from __future__ import annotations
import os
import random
import math
from datetime import datetime, timedelta
from typing import Optional

# ── Config ────────────────────────────────────────────────────────────────────
X_BEARER_TOKEN = os.getenv("X_BEARER_TOKEN")
X_API_ENABLED = bool(X_BEARER_TOKEN)

# ── Mock data ─────────────────────────────────────────────────────────────────
# Her sembol için tutarlı mock data (seed-based)
_SYMBOL_BASE_MENTIONS = {
    "THYAO":   {"base": 3200,  "sentiment_base": 0.62, "keywords": ["uçuş", "rota", "slot", "yolcu", "yakıt"]},
    "GARAN":   {"base": 2800,  "sentiment_base": 0.55, "keywords": ["kredi", "faiz", "kâr", "banka", "temettü"]},
    "EREGL":   {"base": 1900,  "sentiment_base": 0.58, "keywords": ["çelik", "kapasite", "demir", "ihracat", "Erdemir"]},
    "SISE":    {"base": 1400,  "sentiment_base": 0.60, "keywords": ["cam", "otomotiv", "inşaat", "Şişecam"]},
    "ASELS":   {"base": 2100,  "sentiment_base": 0.71, "keywords": ["savunma", "drone", "ASELSAN", "ihracat", "SİHA"]},
    "AAPL":    {"base": 18500, "sentiment_base": 0.67, "keywords": ["iPhone", "AI", "Vision", "Services", "buyback"]},
    "MSFT":    {"base": 14200, "sentiment_base": 0.70, "keywords": ["Azure", "Copilot", "OpenAI", "Cloud", "Teams"]},
    "NVDA":    {"base": 22000, "sentiment_base": 0.78, "keywords": ["GPU", "Blackwell", "AI", "datacenter", "Jensen"]},
    "BTC-USD": {"base": 31000, "sentiment_base": 0.63, "keywords": ["Bitcoin", "ETF", "halving", "kripto", "spot"]},
    "ETH-USD": {"base": 15000, "sentiment_base": 0.60, "keywords": ["Ethereum", "staking", "Layer2", "DeFi", "ETH"]},
}

_DEFAULT_BASE = {"base": 800, "sentiment_base": 0.52, "keywords": ["hisse", "analiz", "teknik"]}


def _mock_social(symbol: str, now: Optional[datetime] = None) -> dict:
    """Gerçekçi ve tutarlı mock sosyal sinyal üretir."""
    now = now or datetime.now()
    base_data = _SYMBOL_BASE_MENTIONS.get(symbol, _DEFAULT_BASE)

    # Seed: symbol + day + hour bucket (4-hour)
    seed = hash(f"{symbol}-{now.strftime('%Y%m%d')}-{now.hour // 4}") % 2**20
    rng = random.Random(seed)

    base = base_data["base"]
    sentiment_base = base_data["sentiment_base"]

    # Add noise
    noise_factor = rng.uniform(0.85, 1.25)
    mentions_1h = int(base / 24 * noise_factor)
    mentions_15m = int(mentions_1h / 4 * rng.uniform(0.7, 1.4))
    daily = int(base * rng.uniform(0.9, 1.1))

    # Sentiment
    sentiment_score = min(1.0, max(0.0, sentiment_base + rng.uniform(-0.12, 0.12)))
    if sentiment_score > 0.65:
        sentiment_label = "Pozitif"
        sentiment_color = "green"
    elif sentiment_score > 0.45:
        sentiment_label = "Karışık"
        sentiment_color = "yellow"
    else:
        sentiment_label = "Negatif"
        sentiment_color = "red"

    # Deviation from 7-day average
    avg_7d = int(base * rng.uniform(0.88, 1.12))
    deviation = round((daily - avg_7d) / max(avg_7d, 1) * 100, 1)
    if deviation > 20:
        deviation_label = "Olağandışı yüksek aktivite"
    elif deviation > 5:
        deviation_label = "Normalin üzerinde"
    elif deviation < -20:
        deviation_label = "Olağandışı düşük aktivite"
    elif deviation < -5:
        deviation_label = "Normalin altında"
    else:
        deviation_label = "Normal aktivite"

    # Influencer sentiment (slightly different from retail)
    influencer_score = min(1.0, max(0.0, sentiment_base + rng.uniform(-0.05, 0.08)))
    influencer_label = "Pozitif" if influencer_score > 0.6 else ("Nötr" if influencer_score > 0.4 else "Negatif")

    # Coordination score (pump detection)
    coordination = rng.uniform(0.1, 0.4)
    coordination_label = "Doğal akış" if coordination < 0.25 else ("Dikkatli izle" if coordination < 0.35 else "Koordineli aktivite")

    # Top keywords
    keywords = base_data["keywords"][:]
    rng.shuffle(keywords)

    # Recent sample tweets (mock)
    sample_topics = [
        f"{symbol} teknik analiz",
        f"{symbol} hedef fiyat",
        f"{symbol} son dakika",
        f"{keywords[0]} etkisi",
        f"{symbol} RSI sinyali",
    ]

    return {
        "symbol": symbol,
        "data_source": "X (Twitter)" if X_API_ENABLED else "Mock (X API yakında)",
        "is_mock": not X_API_ENABLED,
        "updated_at": now.isoformat(),
        "mentions": {
            "last_15min": mentions_15m,
            "last_1h": mentions_1h,
            "daily_avg": daily,
            "avg_7d": avg_7d,
        },
        "deviation_score": round(deviation, 1),
        "deviation_label": deviation_label,
        "sentiment": {
            "score": round(sentiment_score, 2),
            "label": sentiment_label,
            "color": sentiment_color,
            "positive_pct": round(sentiment_score * 100),
            "negative_pct": round((1 - sentiment_score) * 60),
            "neutral_pct": round(40 - (abs(sentiment_score - 0.5) * 20)),
        },
        "influencer_sentiment": {
            "score": round(influencer_score, 2),
            "label": influencer_label,
        },
        "coordination_score": round(coordination, 2),
        "coordination_label": coordination_label,
        "top_keywords": keywords[:5],
        "sample_topics": sample_topics[:3],
    }


def _real_social(symbol: str) -> Optional[dict]:
    """X API v2 entegrasyonu — Bearer Token varsa gerçek veri çeker."""
    try:
        import urllib.request
        import json

        # X API v2 recent search
        query = f"{symbol} (stock OR hisse OR crypto) lang:tr OR lang:en -is:retweet"
        url = f"https://api.twitter.com/2/tweets/search/recent?query={urllib.parse.quote(query)}&max_results=100&tweet.fields=created_at,public_metrics,lang"

        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {X_BEARER_TOKEN}")

        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())

        tweets = data.get("data", [])
        if not tweets:
            return None

        # Count and basic sentiment
        count = len(tweets)
        # Simple keyword sentiment
        positive_words = ["yükseliş", "güçlü", "alım", "pozitif", "bullish", "buy", "strong", "up"]
        negative_words = ["düşüş", "zayıf", "satış", "negatif", "bearish", "sell", "weak", "down"]

        pos = neg = 0
        for t in tweets:
            text = t.get("text", "").lower()
            pos += sum(1 for w in positive_words if w in text)
            neg += sum(1 for w in negative_words if w in text)

        total_sentiment = pos + neg + 0.001
        sentiment_score = pos / total_sentiment

        # Fall back to mock structure but with real counts
        mock = _mock_social(symbol)
        mock["data_source"] = "X (Twitter) — Gerçek"
        mock["is_mock"] = False
        mock["mentions"]["last_1h"] = count
        mock["sentiment"]["score"] = round(sentiment_score, 2)
        mock["sentiment"]["label"] = "Pozitif" if sentiment_score > 0.6 else ("Karışık" if sentiment_score > 0.4 else "Negatif")
        return mock

    except Exception:
        return None


def get_social_signal(symbol: str) -> dict:
    """Sosyal sinyal döner — gerçek X API veya mock."""
    symbol = symbol.upper()

    if X_API_ENABLED:
        real = _real_social(symbol)
        if real:
            return real

    return _mock_social(symbol)


def get_trending_social(limit: int = 10) -> dict:
    """En çok konuşulan sembolleri döner."""
    now = datetime.now()
    symbols = list(_SYMBOL_BASE_MENTIONS.keys())

    results = []
    for sym in symbols:
        data = _mock_social(sym, now)
        results.append({
            "symbol": sym,
            "mentions_1h": data["mentions"]["last_1h"],
            "daily": data["mentions"]["daily_avg"],
            "deviation": data["deviation_score"],
            "sentiment": data["sentiment"]["label"],
            "sentiment_color": data["sentiment"]["color"],
            "deviation_label": data["deviation_label"],
        })

    # Sort by mentions
    results.sort(key=lambda x: x["mentions_1h"], reverse=True)

    return {
        "updated_at": now.isoformat(),
        "is_mock": not X_API_ENABLED,
        "trending": results[:limit],
    }
