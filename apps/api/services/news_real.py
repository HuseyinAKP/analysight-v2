"""
Gerçek haber servisi.

Öncelik sırası:
1. NEWS_API_KEY env var varsa → NewsAPI.org (ücretsiz, 100 istek/gün)
2. Yoksa → news_mock fallback

NewsAPI ücretsiz plan: https://newsapi.org/register
Railway'e eklemek için: NEWS_API_KEY=<key>
"""
from __future__ import annotations
import os
import hashlib
import time
from typing import Optional
from datetime import datetime, timedelta

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

# Basit bellek içi cache (5 dakika TTL)
_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 300  # saniye


def _classify_headline(headline: str) -> tuple[str, str]:
    """Başlığa göre kategori ve duygu tahmini."""
    hl = headline.lower()
    if any(w in hl for w in ["kâr", "kar", "earnings", "profit", "revenue", "gelir", "bilanço", "eps"]):
        cat = "Bilanço"
    elif any(w in hl for w in ["faiz", "enflasyon", "inflation", "fed", "merkez", "tcmb", "gdp", "büyüme"]):
        cat = "Makro"
    elif any(w in hl for w in ["savaş", "gerilim", "war", "conflict", "jeopolitik", "geopolitik", "kriz"]):
        cat = "Jeopolitik"
    elif any(w in hl for w in ["düzenleme", "regülasyon", "regulation", "sec", "spk", "bddk", "yasakla"]):
        cat = "Regülasyon"
    elif any(w in hl for w in ["satın alma", "acquisition", "merger", "birleşme", "m&a", "devralma"]):
        cat = "Birleşme"
    elif any(w in hl for w in ["ürün", "product", "launch", "teknoloji", "technology", "yapay zeka", "ai"]):
        cat = "Ürün"
    else:
        cat = "Sektör"

    if any(w in hl for w in ["arttı", "yükseldi", "büyüdü", "beat", "record", "high", "gain", "rally", "surge"]):
        sentiment = "positive"
    elif any(w in hl for w in ["düştü", "geriledi", "kayıp", "miss", "loss", "decline", "drop", "fell", "fell"]):
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return cat, sentiment


def _fetch_newsapi(symbol: str) -> Optional[list]:
    """NewsAPI.org üzerinden gerçek haber çeker."""
    try:
        import urllib.request, json
        query = symbol.replace("-USD", "").replace(".IS", "")
        url = (
            f"https://newsapi.org/v2/everything"
            f"?q={query}"
            f"&language=tr,en"
            f"&pageSize=10"
            f"&sortBy=publishedAt"
            f"&apiKey={NEWS_API_KEY}"
        )
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
        if data.get("status") != "ok":
            return None
        articles = data.get("articles", [])
        result = []
        for art in articles[:8]:
            headline = art.get("title") or ""
            if not headline or headline == "[Removed]":
                continue
            cat, sentiment = _classify_headline(headline)
            pub = art.get("publishedAt", "")
            try:
                dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
                hours_ago = max(0, int((datetime.now().astimezone() - dt).total_seconds() / 3600))
            except Exception:
                hours_ago = 0

            from services.news_mock import CATEGORIES
            cat_info = CATEGORIES.get(cat, CATEGORIES["Sektör"])
            result.append({
                "headline": headline[:200],
                "category": cat,
                "category_label": cat_info["label"],
                "category_color": cat_info["color"],
                "impact": cat_info["impact"],
                "typical_effect": cat_info["typical_effect"],
                "effect_direction": cat_info["effect_direction"],
                "sentiment": sentiment,
                "timestamp": pub,
                "hours_ago": hours_ago,
                "source": art.get("source", {}).get("name", "NewsAPI"),
                "url": art.get("url", ""),
            })
        return result if result else None
    except Exception:
        return None


def get_news(symbol: str) -> list:
    """Ana haber fonksiyonu — öncelik: NewsAPI → GDELT → Mock."""
    cache_key = symbol.upper()
    now = time.time()

    # Cache kontrolü
    if cache_key in _cache:
        ts, items = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return items

    # 1. NewsAPI (key varsa)
    if NEWS_API_KEY:
        items = _fetch_newsapi(symbol)
        if items:
            _cache[cache_key] = (now, items)
            return items

    # 2. GDELT (ücretsiz, key gerektirmez)
    try:
        from services.news_gdelt import get_news_gdelt
        items = get_news_gdelt(symbol)
        if items:
            _cache[cache_key] = (now, items)
            return items
    except Exception:
        pass

    # 3. Mock fallback
    from services.news_mock import get_news as mock_news
    items = mock_news(symbol)
    _cache[cache_key] = (now, items)
    return items
