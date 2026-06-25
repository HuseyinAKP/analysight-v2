"""
GDELT DOC 2.0 haber entegrasyonu.

API key gerektirmez. Ücretsiz. 15 dk TTL cache.
Docs: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/

Kullanım önceliği (news_real.py tarafından çağrılır):
  1. NewsAPI (NEWS_API_KEY varsa)
  2. GDELT (bu servis — her zaman dener)
  3. Mock fallback
"""
from __future__ import annotations
import os, time, json
from datetime import datetime
from typing import Optional
import urllib.request, urllib.parse

_cache: dict[str, tuple[float, list]] = {}
_CACHE_TTL = 900  # 15 dakika

# BIST ticker → İngilizce şirket adı (GDELT İngilizce kaynaklarda daha iyi)
_BIST_NAMES: dict[str, str] = {
    "THYAO": "Turkish Airlines",
    "GARAN": "Garanti Bank Turkey",
    "EREGL": "Eregli Demir Celik",
    "AKBNK": "Akbank Turkey",
    "SISE":  "Sisecam",
    "KCHOL": "Koc Holding",
    "BIMAS": "BIM supermarket Turkey",
    "ARCLK": "Arcelik",
    "FROTO": "Ford Otosan",
    "TUPRS": "Tupras oil refinery Turkey",
    "ASELS": "Aselsan defense Turkey",
    "YKBNK": "Yapi Kredi Bank",
    "TCELL": "Turkcell",
    "PETKM": "Petkim Turkey",
    "SAHOL": "Sabanci Holding",
}


def _query_for(symbol: str) -> str:
    """Sembol için GDELT arama sorgusunu üret."""
    sym = symbol.upper().replace(".IS", "").replace("-USD", "")
    # BIST hisseleri için şirket adı kullan
    if sym in _BIST_NAMES:
        return _BIST_NAMES[sym]
    # Kripto
    if symbol.endswith("-USD"):
        mapping = {"BTC": "Bitcoin", "ETH": "Ethereum", "SOL": "Solana",
                   "BNB": "Binance BNB", "XRP": "XRP Ripple", "ADA": "Cardano"}
        return mapping.get(sym, sym)
    # ABD hisseleri — ticker yeterli
    return sym


def _classify(headline: str) -> tuple[str, str]:
    """Başlığa göre kategori + duygu tahmini (news_mock ile aynı mantık)."""
    hl = headline.lower()
    if any(w in hl for w in ["kâr", "kar", "earnings", "profit", "revenue", "gelir", "bilanço", "eps", "results"]):
        cat = "Bilanço"
    elif any(w in hl for w in ["faiz", "enflasyon", "inflation", "fed", "merkez", "tcmb", "gdp", "büyüme", "rate"]):
        cat = "Makro"
    elif any(w in hl for w in ["savaş", "gerilim", "war", "conflict", "jeopolitik", "kriz", "sanction", "yaptırım"]):
        cat = "Jeopolitik"
    elif any(w in hl for w in ["düzenleme", "regülasyon", "regulation", "sec", "spk", "bddk", "ban", "yasakla"]):
        cat = "Regülasyon"
    elif any(w in hl for w in ["satın alma", "acquisition", "merger", "birleşme", "m&a", "devralma", "takeover"]):
        cat = "Birleşme"
    elif any(w in hl for w in ["ürün", "product", "launch", "teknoloji", "technology", "yapay zeka", "ai", "model"]):
        cat = "Ürün"
    else:
        cat = "Sektör"

    pos_words = ["arttı", "yükseldi", "büyüdü", "beat", "record", "high", "gain", "rally", "surge", "jump", "rise", "soar"]
    neg_words = ["düştü", "geriledi", "kayıp", "miss", "loss", "decline", "drop", "fell", "sink", "crash", "cut", "warn"]
    if any(w in hl for w in pos_words):
        sentiment = "positive"
    elif any(w in hl for w in neg_words):
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return cat, sentiment


def _fetch_gdelt(symbol: str) -> Optional[list]:
    """GDELT DOC 2.0 API'sinden haber çeker."""
    query = _query_for(symbol)
    params = urllib.parse.urlencode({
        "query": query,
        "mode": "artlist",
        "maxrecords": "10",
        "timespan": "3d",         # son 3 gün
        "format": "json",
    })
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?{params}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Analysight/1.0 (financial-analysis-platform)"
    })
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            data = json.loads(raw)
    except Exception:
        return None

    articles = data.get("articles") or []
    if not articles:
        return None

    from services.news_mock import CATEGORIES
    result = []
    for art in articles[:8]:
        headline = (art.get("title") or "").strip()
        if not headline:
            continue
        # Skip non-English/Turkish noise (keep only major languages)
        lang = (art.get("language") or "").lower()
        if lang not in ("english", "turkish", ""):
            continue

        cat, sentiment = _classify(headline)
        cat_info = CATEGORIES.get(cat, CATEGORIES["Sektör"])

        # Parse GDELT date: "20260625T120000Z"
        raw_date = art.get("seendate", "")
        try:
            dt = datetime.strptime(raw_date, "%Y%m%dT%H%M%SZ")
            hours_ago = max(0, int((datetime.utcnow() - dt).total_seconds() / 3600))
            iso_ts = dt.isoformat() + "Z"
        except Exception:
            hours_ago = 0
            iso_ts = ""

        result.append({
            "headline": headline[:200],
            "category": cat,
            "category_label": cat_info["label"],
            "category_color": cat_info["color"],
            "impact": cat_info["impact"],
            "typical_effect": cat_info["typical_effect"],
            "effect_direction": cat_info["effect_direction"],
            "sentiment": sentiment,
            "timestamp": iso_ts,
            "hours_ago": hours_ago,
            "source": art.get("domain", "GDELT"),
            "url": art.get("url", ""),
        })

    return result if result else None


def get_news_gdelt(symbol: str) -> Optional[list]:
    """Cache'li GDELT haber çekimi. None döndürürse fallback kullan."""
    key = symbol.upper()
    now = time.time()
    if key in _cache:
        ts, items = _cache[key]
        if now - ts < _CACHE_TTL:
            return items

    items = _fetch_gdelt(symbol)
    if items:
        _cache[key] = (now, items)
    return items
