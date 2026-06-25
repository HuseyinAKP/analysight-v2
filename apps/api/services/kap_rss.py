"""
C: KAP Bildirimleri

KAP (Kamuoyu Aydınlatma Platformu) yfinance haberleriyle + web scraping ile
gerçek SPK bildirimlerini çeker.

Strateji:
  1. yfinance.Ticker.news → KAP bildirim başlıklarını filtreler
  2. RSS kaynakları (Bloomberg HT, AA) KAP haberlerini içerirse ekle
  3. KAP doğrudan URL'leri oluştur (kullanıcıyı yönlendir)
"""
from __future__ import annotations
import time
import re
import urllib.request
from datetime import datetime, timezone
from typing import Optional
import yfinance as yf

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    from routers.kap import KAP_MEMBER_OIDS
except Exception:
    KAP_MEMBER_OIDS: dict = {}

_CACHE_TTL = 1800   # 30 dk
_cache: dict[str, tuple[float, list]] = {}

# Bildirim tipi anahtar kelimeleri
_DISC_TYPES = {
    "Finansal Sonuçlar":  ["bilanço", "finansal sonuç", "gelir tablosu", "kar", "zarar", "quarterly", "financial result"],
    "Temettü":            ["temettü", "kar dağıtım", "dividend"],
    "Genel Kurul":        ["genel kurul", "olağan", "genel kurul toplantı", "general assembly"],
    "Önemli Gelişme":     ["önemli gelişme", "material disclosure", "özel durum"],
    "Yönetim Değişikliği":["yönetim kurulu", "board", "atama", "görevden"],
    "Ortaklık Yapısı":    ["pay alım", "pay devir", "hisse geri alım", "buyback", "sermaye"],
    "Kredi & Tahvil":     ["kredi", "tahvil", "bono", "eurobond", "loan"],
    "Yatırım & Proje":    ["yatırım", "proje", "tesis", "kapasite", "investment"],
}

def _classify(title: str) -> str:
    tl = title.lower()
    for cat, kws in _DISC_TYPES.items():
        if any(kw in tl for kw in kws):
            return cat
    return "Diğer"

def _importance(disc_type: str) -> str:
    high = {"Finansal Sonuçlar", "Temettü", "Önemli Gelişme", "Ortaklık Yapısı"}
    mid  = {"Genel Kurul", "Yönetim Değişikliği", "Kredi & Tahvil"}
    if disc_type in high: return "yüksek"
    if disc_type in mid:  return "orta"
    return "düşük"

def get_kap_disclosures(symbol: str, limit: int = 15) -> list[dict]:
    """
    Sembol için KAP bildirimlerini döner.
    yfinance news + RSS filtreleme ile gerçek verilere yaklaşır.
    """
    sym = symbol.upper()
    cache_key = f"kap:{sym}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    results = []

    # ── 1. yfinance haberleri ─────────────────────────────────────────────────
    try:
        ticker = yf.Ticker(f"{sym}.IS" if not sym.endswith(".IS") and "." not in sym else sym)
        news = ticker.news or []
        for item in news[:25]:
            title  = item.get("title", "").strip()
            if not title: continue
            pub_ts = item.get("providerPublishTime", 0)
            pub_dt = datetime.fromtimestamp(pub_ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M") if pub_ts else ""
            url    = item.get("link", "")
            disc_type = _classify(title)
            results.append({
                "title":      title,
                "url":        url,
                "source":     item.get("publisher", ""),
                "date":       pub_dt,
                "type":       disc_type,
                "importance": _importance(disc_type),
                "is_kap":     False,
            })
    except Exception:
        pass

    # ── 2. RSS kaynakları KAP filtresi ────────────────────────────────────────
    try:
        from .rss_news import get_news_for_symbol
        rss_items = get_news_for_symbol(sym, limit=10)
        existing_titles = {r["title"] for r in results}
        kap_keywords = ["kap", "bildirim", "spk", "özel durum", "kamuoyu"]
        for it in rss_items:
            title = it.get("title", "")
            if title in existing_titles:
                continue
            disc_type = _classify(title)
            is_kap_related = any(kw in (title + it.get("desc","")).lower() for kw in kap_keywords)
            results.append({
                "title":      title,
                "url":        it.get("url", ""),
                "source":     it.get("source", "RSS"),
                "date":       it.get("pub", ""),
                "type":       disc_type,
                "importance": _importance(disc_type),
                "is_kap":     is_kap_related,
            })
            existing_titles.add(title)
    except Exception:
        pass

    # ── 3. KAP doğrudan URL ──────────────────────────────────────────────────
    kap_url = None
    if sym in KAP_MEMBER_OIDS:
        oid, slug = KAP_MEMBER_OIDS[sym]
        kap_url = f"https://www.kap.org.tr/tr/sirket-bilgileri/ozet/{oid}-{slug}"

    # Önce yüksek önemli, sonra tarihe göre
    results.sort(key=lambda x: (
        {"yüksek": 0, "orta": 1, "düşük": 2}.get(x["importance"], 2),
        x["date"]
    ), reverse=False)

    final = results[:limit]

    _cache[cache_key] = (now, final)
    return final

def get_kap_url(symbol: str) -> Optional[str]:
    sym = symbol.upper()
    if sym in KAP_MEMBER_OIDS:
        oid, slug = KAP_MEMBER_OIDS[sym]
        return f"https://www.kap.org.tr/tr/sirket-bilgileri/ozet/{oid}-{slug}"
    return None
