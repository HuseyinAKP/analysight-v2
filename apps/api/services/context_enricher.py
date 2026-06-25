"""
HEI Katman 2 — Bağlam Zenginleştirme

Her anomali noktası için o tarihteki dünya gündemini çeker.
Kaynaklar (öncelik sırasıyla):
  1. GDELT DOC 2.0 — 2013'ten bugüne, API key yok
  2. NewsAPI.org   — NEWS_API_KEY varsa
  Kapsam dışı tarihler için Wikipedia özet API
"""
from __future__ import annotations
import os
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

_CACHE_TTL  = 86400   # 24 saat — geçmiş veri değişmez
_cache: dict[str, tuple[float, dict]] = {}

# Olay kategorisi eşlemeleri (GDELT theme → Türkçe kategori)
THEME_MAP = {
    "CRISISLEX":        "Kriz",
    "ECON":             "Ekonomi",
    "ENV":              "Çevre / Afet",
    "ELECTION":         "Seçim / Siyaset",
    "SANCTIONS":        "Yaptırım / Jeopolitik",
    "ENERGY":           "Enerji Şoku",
    "MILITARY":         "Askeri / Çatışma",
    "PROTEST":          "Sosyal Hareketlilik",
    "DISEASE":          "Salgın / Sağlık",
    "INFLATION":        "Enflasyon / Makro",
    "INTEREST_RATES":   "Merkez Bankası",
    "CURRENCY":         "Kur Krizi",
    "SUPPLY_CHAIN":     "Tedarik Zinciri",
    "TRADE":            "Ticaret",
}

# Sembol → GDELT arama terimleri
SYMBOL_QUERIES: dict[str, list[str]] = {
    "THYAO":  ["Turkish Airlines", "THYAO", "Türk Hava Yolları"],
    "GARAN":  ["Garanti Bank", "Garanti BBVA", "GARAN"],
    "EREGL":  ["Eregli Demir", "Erdemir", "EREGL"],
    "TUPRS":  ["Tupras", "Tüpraş", "Turkey refinery"],
    "BIMAS":  ["BIM market", "BIM Birlesik", "Turkey retail"],
    "KCHOL":  ["Koc Holding", "KOC Holding"],
    "SAHOL":  ["Sabanci Holding", "Sabancı"],
    "ISCTR":  ["Is Bankasi", "Isbank", "İş Bankası"],
    "AKBNK":  ["Akbank", "AKBNK"],
    "TCELL":  ["Turkcell", "TCELL"],
    "AAPL":   ["Apple", "AAPL", "Apple Inc"],
    "NVDA":   ["NVIDIA", "NVDA"],
    "MSFT":   ["Microsoft", "MSFT"],
    "TSLA":   ["Tesla", "TSLA"],
    "AMZN":   ["Amazon", "AMZN"],
    "GOOGL":  ["Google", "Alphabet", "GOOGL"],
    "META":   ["Meta", "Facebook", "META"],
    "BTC":    ["Bitcoin", "BTC", "cryptocurrency"],
    "ETH":    ["Ethereum", "ETH", "crypto"],
    "GC=F":   ["gold price", "gold market", "altın fiyat"],
    "CL=F":   ["crude oil", "WTI oil", "OPEC"],
    "CT=F":   ["cotton price", "cotton futures", "pamuk"],
    "NG=F":   ["natural gas", "LNG", "doğal gaz"],
}

# ── GDELT ─────────────────────────────────────────────────────────────────────
def _gdelt_context(symbol: str, date_str: str) -> list[dict]:
    """
    Tarih etrafındaki 5 günlük pencerede GDELT haberlerini çeker.
    """
    queries = SYMBOL_QUERIES.get(symbol.upper(), [symbol])
    query_term = " OR ".join(f'"{q}"' for q in queries[:2])

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return []

    # GDELT tarih penceresi: olay - 2 gün ile olay + 3 gün
    start = (dt - timedelta(days=2)).strftime("%Y%m%d%H%M%S")
    end   = (dt + timedelta(days=3)).strftime("%Y%m%d%H%M%S")

    params = {
        "query":         query_term,
        "mode":          "artlist",
        "maxrecords":    "10",
        "startdatetime": start,
        "enddatetime":   end,
        "sort":          "hybridrel",
        "format":        "json",
    }
    url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(params)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return []

    articles = data.get("articles", [])
    results = []
    for art in articles:
        title = art.get("title", "").strip()
        if not title or len(title) < 10:
            continue
        results.append({
            "title":  title,
            "url":    art.get("url", ""),
            "source": art.get("domain", ""),
            "date":   art.get("seendate", "")[:8],
            "lang":   art.get("language", "en"),
        })

    # Sonuç yoksa Türkiye/küresel piyasa genel sorgusu dene
    if not results:
        fallback_terms = ["Turkey stock market", "BIST", "emerging markets"] \
            if symbol.upper() in ("THYAO","GARAN","EREGL","TUPRS","BIMAS","ISCTR","AKBNK","TCELL","SAHOL","KCHOL") \
            else ["stock market", "financial markets"]
        fb_query = " OR ".join(f'"{t}"' for t in fallback_terms)
        fb_params = {**params, "query": fb_query, "maxrecords": "6"}
        fb_url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(fb_params)
        try:
            fb_req = urllib.request.Request(fb_url, headers={"User-Agent": "Analysight/1.0"})
            with urllib.request.urlopen(fb_req, timeout=8) as fb_resp:
                fb_data = json.loads(fb_resp.read().decode())
            for art in fb_data.get("articles", []):
                title = art.get("title", "").strip()
                if title and len(title) > 10:
                    results.append({
                        "title":  title,
                        "url":    art.get("url", ""),
                        "source": art.get("domain", ""),
                        "date":   art.get("seendate", "")[:8],
                        "lang":   "en",
                    })
        except Exception:
            pass

    return results

# ── NewsAPI ────────────────────────────────────────────────────────────────────
def _newsapi_context(symbol: str, date_str: str) -> list[dict]:
    key = os.getenv("NEWS_API_KEY", "")
    if not key:
        return []

    queries = SYMBOL_QUERIES.get(symbol.upper(), [symbol])
    q = " OR ".join(f'"{t}"' for t in queries[:2])

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return []

    from_dt = (dt - timedelta(days=2)).strftime("%Y-%m-%d")
    to_dt   = (dt + timedelta(days=3)).strftime("%Y-%m-%d")

    params = {
        "q":       q,
        "from":    from_dt,
        "to":      to_dt,
        "sortBy":  "relevancy",
        "pageSize": "5",
        "apiKey":  key,
        "language": "en",
    }
    url = "https://newsapi.org/v2/everything?" + urllib.parse.urlencode(params)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return []

    articles = data.get("articles", [])
    results = []
    for art in articles:
        title = (art.get("title") or "").strip()
        if not title or title == "[Removed]":
            continue
        results.append({
            "title":  title,
            "url":    art.get("url", ""),
            "source": art.get("source", {}).get("name", ""),
            "date":   (art.get("publishedAt") or "")[:10],
            "lang":   "en",
        })
    return results

# ── Wikipedia dönem özeti ──────────────────────────────────────────────────────
def _wiki_period(date_str: str) -> Optional[str]:
    """2013 öncesi tarihler için o yılın genel olaylarını çeker."""
    try:
        year = int(date_str[:4])
    except ValueError:
        return None
    if year >= 2013:
        return None  # GDELT bu yılı karşılar

    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{year}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
        extract = data.get("extract", "")
        return extract[:400] if extract else None
    except Exception:
        return None

# ── Kategori çıkarımı ──────────────────────────────────────────────────────────
def _categorize(headlines: list[dict]) -> list[str]:
    """Haberlerin başlıklarından kategori etiketleri çıkarır."""
    text = " ".join(h.get("title", "").upper() for h in headlines)
    cats = []
    keyword_map = {
        "Jeopolitik / Çatışma":    ["WAR", "SANCTION", "MILITARY", "ATTACK", "CRISIS", "CONFLICT", "GEOPOLİTİK", "SAVAŞ"],
        "Merkez Bankası":          ["FEDERAL RESERVE", "FED RATE", "INTEREST RATE", "CENTRAL BANK", "TCMB", "RATE HIKE", "RATE CUT"],
        "Kur Krizi":               ["LIRA", "CURRENCY", "DOLLAR", "EXCHANGE RATE", "DEVALUATION", "KUR", "DOLAR"],
        "Enerji Şoku":             ["OIL", "GAS", "ENERGY", "OPEC", "CRUDE", "PETROL", "DOĞALGAZ"],
        "Salgın / Sağlık":         ["COVID", "PANDEMIC", "VIRUS", "EPIDEMIC", "DISEASE", "SALGIN"],
        "Seçim / Siyaset":         ["ELECTION", "VOTE", "POLITICAL", "GOVERNMENT", "PARLIAMENT", "SEÇİM", "ERDOĞAN"],
        "Tedarik Zinciri":         ["SUPPLY CHAIN", "SHORTAGE", "CHIP", "SEMICONDUCTOR", "PORT", "TEDARİK"],
        "Ekonomi / Makro":         ["GDP", "INFLATION", "RECESSION", "GROWTH", "ENFLASYON", "BÜYÜME"],
        "Doğal Afet":              ["EARTHQUAKE", "FLOOD", "STORM", "DISASTER", "DEPREM", "AFET"],
        "Bilanço / Kazanç":        ["EARNINGS", "REVENUE", "PROFIT", "LOSS", "QUARTERLY", "BILANÇO"],
    }
    for cat, keywords in keyword_map.items():
        if any(kw in text for kw in keywords):
            cats.append(cat)
    return cats[:4] if cats else ["Genel Piyasa"]

# ── Ana fonksiyon ──────────────────────────────────────────────────────────────
def enrich_anomaly(symbol: str, date_str: str, magnitude: float) -> dict:
    """
    Tek bir anomali için bağlam paketi oluşturur.
    Döndürdüğü yapı:
      headlines: list[{title, url, source, date}]
      categories: list[str]
      period_summary: str | None  (2013 öncesi için)
      data_source: str
    """
    cache_key = f"{symbol}:{date_str}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    headlines: list[dict] = []
    data_source = "none"

    # Önce NewsAPI (varsa)
    news_items = _newsapi_context(symbol, date_str)
    if news_items:
        headlines.extend(news_items)
        data_source = "newsapi"

    # GDELT ile tamamla / ikincil kaynak
    gdelt_items = _gdelt_context(symbol, date_str)
    if gdelt_items:
        # Tekrarlananları filtrele
        existing_titles = {h["title"] for h in headlines}
        for g in gdelt_items:
            if g["title"] not in existing_titles:
                headlines.append(g)
                existing_titles.add(g["title"])
        if data_source == "none":
            data_source = "gdelt"
        else:
            data_source = "newsapi+gdelt"

    # 2013 öncesi dönem özeti
    period_summary = _wiki_period(date_str)
    if period_summary and not headlines:
        data_source = "wikipedia"

    categories = _categorize(headlines)

    result = {
        "date":           date_str,
        "symbol":         symbol,
        "magnitude":      magnitude,
        "headlines":      headlines[:8],
        "categories":     categories,
        "period_summary": period_summary,
        "data_source":    data_source,
        "context_note":   (
            "2013 öncesi tarihler için haber verisi sınırlıdır. "
            "Gösterilen özet dönemin genel bağlamını yansıtmaktadır."
        ) if period_summary else None,
    }

    _cache[cache_key] = (now, result)
    return result
