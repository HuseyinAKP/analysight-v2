"""
B: RSS Haber Servisi

Ücretsiz Türkçe finans RSS beslemelerinden haber çeker.
GDELT / NewsAPI'ye fallback olarak kullanılır — API key gerektirmez.

Kaynaklar:
  Bloomberg HT  — https://www.bloomberght.com/rss
  Hürriyet Ekonomi — https://www.hurriyet.com.tr/rss/ekonomi
  AA Ekonomi    — https://www.aa.com.tr/tr/rss/default?cat=ekonomi
  Investing TR  — https://tr.investing.com/rss/news.rss
"""
from __future__ import annotations
import time
import xml.etree.ElementTree as ET
import urllib.request
import re
from datetime import datetime, timezone
from typing import Optional

_CACHE_TTL = 900    # 15 dk — haberler sık güncellenir
_cache: dict[str, tuple[float, list]] = {}

RSS_SOURCES = [
    {
        "name": "Bloomberg HT",
        "url":  "https://www.bloomberght.com/rss",
        "lang": "tr",
    },
    {
        "name": "Hürriyet Ekonomi",
        "url":  "https://www.hurriyet.com.tr/rss/ekonomi",
        "lang": "tr",
    },
    {
        "name": "AA Ekonomi",
        "url":  "https://www.aa.com.tr/tr/rss/default?cat=ekonomi",
        "lang": "tr",
    },
    {
        "name": "Investing.com TR",
        "url":  "https://tr.investing.com/rss/news.rss",
        "lang": "tr",
    },
]

# Sembol → arama terimleri (Türkçe + İngilizce)
SYMBOL_TERMS: dict[str, list[str]] = {
    "THYAO": ["Türk Hava Yolları", "THY", "Turkish Airlines", "THYAO"],
    "GARAN": ["Garanti Bankası", "Garanti BBVA", "GARAN"],
    "AKBNK": ["Akbank", "AKBNK"],
    "ISCTR": ["İş Bankası", "Isbank", "ISCTR"],
    "KCHOL": ["Koç Holding", "KOÇ", "KCHOL"],
    "SAHOL": ["Sabancı Holding", "SAHOL"],
    "EREGL": ["Ereğli Demir", "Erdemir", "EREGL"],
    "TUPRS": ["Tüpraş", "Tupras", "TUPRS"],
    "BIMAS": ["BİM", "BIM Mağazalar", "BIMAS"],
    "TOASO": ["Tofaş", "TOASO"],
    "FROTO": ["Ford Otomotiv", "FROTO"],
    "ASELS": ["Aselsan", "ASELS"],
    "SISE":  ["Şişecam", "Şişe ve Cam", "SISE"],
    "TCELL": ["Turkcell", "TCELL"],
    "TTKOM": ["Türk Telekom", "TTKOM"],
    "PETKM": ["Petkim", "PETKM"],
    "TAVHL": ["TAV Havalimanları", "TAVHL"],
    "EKGYO": ["Emlak Konut", "EKGYO"],
    "ARCLK": ["Arçelik", "Arcelik", "ARCLK"],
    "VESTL": ["Vestel", "VESTL"],
    "AAPL":  ["Apple", "AAPL"],
    "NVDA":  ["NVIDIA", "NVDA"],
    "MSFT":  ["Microsoft", "MSFT"],
    "TSLA":  ["Tesla", "TSLA"],
    "GC=F":  ["Altın", "gold", "ons"],
    "CL=F":  ["petrol", "ham petrol", "WTI", "Brent"],
    "BTC-USD": ["Bitcoin", "BTC", "kripto"],
}

def _fetch_rss(url: str) -> list[dict]:
    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; Analysight/1.0)",
                "Accept": "application/rss+xml, application/xml, text/xml",
            }
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    items = []
    try:
        # Basit XML parse — namespace sorunlarını önlemek için
        raw = re.sub(r' xmlns[^"]*"[^"]*"', '', raw)  # namespace'leri temizle
        root = ET.fromstring(raw)
        nodes = root.findall(".//item") or root.findall(".//entry")
        for node in nodes[:20]:
            title = (node.findtext("title") or "").strip()
            link  = (node.findtext("link")  or "").strip()
            pub   = (node.findtext("pubDate") or node.findtext("published") or "").strip()
            desc  = (node.findtext("description") or node.findtext("summary") or "").strip()
            # HTML temizle
            desc = re.sub(r"<[^>]+>", " ", desc)[:200]
            if title and len(title) > 10:
                items.append({
                    "title": title,
                    "url":   link,
                    "desc":  desc,
                    "pub":   pub[:16] if pub else "",
                })
    except Exception:
        pass
    return items

def _matches(text: str, terms: list[str]) -> bool:
    text_low = text.lower()
    return any(t.lower() in text_low for t in terms)

def get_latest_news(limit: int = 30) -> list[dict]:
    """Tüm kaynaklardan son haberleri döner (sembol filtresi yok)."""
    cache_key = "all"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data[:limit]

    all_items = []
    for src in RSS_SOURCES:
        items = _fetch_rss(src["url"])
        for it in items:
            all_items.append({**it, "source": src["name"], "lang": src["lang"]})

    _cache[cache_key] = (now, all_items)
    return all_items[:limit]

def get_news_for_symbol(symbol: str, limit: int = 8) -> list[dict]:
    """Belirli bir sembolle ilgili haberleri filtreler."""
    sym = symbol.upper()
    terms = SYMBOL_TERMS.get(sym, [sym])

    all_news = get_latest_news(limit=200)

    # Sembolle eşleşenleri filtrele
    matched = [
        n for n in all_news
        if _matches(n.get("title", "") + " " + n.get("desc", ""), terms)
    ]

    # Bulunamazsa genel Türkiye ekonomi haberleri döndür
    if not matched:
        general_terms = ["borsa", "BIST", "hisse", "faiz", "dolar", "piyasa"]
        matched = [
            n for n in all_news
            if _matches(n.get("title", ""), general_terms)
        ]

    return matched[:limit]

def get_news_for_date(symbol: str, date_str: str, limit: int = 6) -> list[dict]:
    """
    Belirli bir tarihe ait haberleri çeker (anomali bağlamı için).
    Tarih filtresi: pubDate'de yıl+ay eşleşmesi.
    """
    sym = symbol.upper()
    terms = SYMBOL_TERMS.get(sym, [sym])
    yymm = date_str[:7]  # "2024-03"

    all_news = get_latest_news(limit=200)

    matched = [
        n for n in all_news
        if yymm in n.get("pub", "")
        and _matches(n.get("title", "") + " " + n.get("desc", ""), terms)
    ]
    return matched[:limit]
