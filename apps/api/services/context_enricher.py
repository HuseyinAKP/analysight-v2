"""
HEI Katman 2 — Bağlam Zenginleştirme (v2)

Her anomali noktası için o tarihteki dünya gündemini çeker.
Kaynaklar (öncelik sırasıyla):
  1. GDELT DOC 2.0      — 2013'ten bugüne, API key yok, dil fark etmez
  2. KAP bildirimleri   — BIST hisseleri için resmi açıklamalar
  3. FRED API           — Makro göstergeler (faiz, enflasyon, döviz)
  4. NewsAPI.org        — NEWS_API_KEY varsa
  5. Wikipedia          — 2013 öncesi için dönem özeti

Kategoriler (12):
  Kur Krizi, Merkez Bankası, Jeopolitik/Çatışma, Enerji Şoku,
  Salgın/Sağlık, Seçim/Siyaset,
  Bilanço Sürprizi, Temettü/Bedelsiz, Yönetim Değişikliği,
  Endeks Girişi/Çıkışı, Kredi Notu, Manipülasyon/SPK
"""
from __future__ import annotations
import os
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

_CACHE_TTL = 86400  # 24 saat — geçmiş veri değişmez
_cache: dict[str, tuple[float, dict]] = {}

# ── Sembol → GDELT arama terimleri ───────────────────────────────────────────
SYMBOL_QUERIES: dict[str, list[str]] = {
    "THYAO":  ["Turkish Airlines", "THY", "Türk Hava Yolları"],
    "GARAN":  ["Garanti Bank", "Garanti BBVA"],
    "EREGL":  ["Eregli Demir", "Erdemir", "Ereğli Demir"],
    "TUPRS":  ["Tupras", "Tüpraş", "Turkey refinery"],
    "BIMAS":  ["BIM market", "BIM Birlesik", "BİM"],
    "KCHOL":  ["Koc Holding", "Koç Holding"],
    "SAHOL":  ["Sabanci Holding", "Sabancı"],
    "ISCTR":  ["Is Bankasi", "Isbank", "İş Bankası"],
    "AKBNK":  ["Akbank"],
    "TCELL":  ["Turkcell"],
    "TOASO":  ["Tofas", "Tofaş"],
    "FROTO":  ["Ford Otosan"],
    "ASELS":  ["Aselsan"],
    "SISE":   ["Sisecam", "Şişecam"],
    "PETKM":  ["Petkim"],
    "PGSUS":  ["Pegasus", "Pegasus Airlines"],
    "TAVHL":  ["TAV Havalimanlari", "TAV Airports"],
    "EKGYO":  ["Emlak Konut", "EKGYO"],
    "AAPL":   ["Apple", "Apple Inc"],
    "NVDA":   ["NVIDIA", "NVDA"],
    "MSFT":   ["Microsoft"],
    "TSLA":   ["Tesla"],
    "AMZN":   ["Amazon"],
    "GOOGL":  ["Google", "Alphabet"],
    "META":   ["Meta", "Facebook"],
    "JPM":    ["JPMorgan", "JP Morgan"],
    "BTC-USD":["Bitcoin", "BTC", "cryptocurrency"],
    "ETH-USD":["Ethereum", "ETH"],
    "GC=F":   ["gold price", "gold market"],
    "CL=F":   ["crude oil", "WTI oil", "OPEC"],
    "NG=F":   ["natural gas", "LNG"],
}

# BIST sembolü mü?
_BIST_SYMBOLS = {s for s in SYMBOL_QUERIES if len(s) <= 6 and s.isalpha() and s not in
                 {"AAPL","NVDA","MSFT","TSLA","AMZN","GOOGL","META","JPM"}}

# ── Kategori anahtar kelime haritası ─────────────────────────────────────────
_KEYWORD_CATS: dict[str, list[str]] = {
    "Kur Krizi": [
        "LIRA", "CURRENCY", "DOLLAR", "EXCHANGE RATE", "DEVALUATION",
        "KUR", "DOLAR", "TL ", "TRY ", "FOREX", "DEPRECIATION",
    ],
    "Merkez Bankası": [
        "FEDERAL RESERVE", "FED RATE", "INTEREST RATE", "CENTRAL BANK",
        "TCMB", "RATE HIKE", "RATE CUT", "MONETARY POLICY", "FAİZ",
        "MERKEZ BANKASI", "POLICY RATE",
    ],
    "Jeopolitik / Çatışma": [
        "WAR", "SANCTION", "MILITARY", "ATTACK", "CRISIS", "CONFLICT",
        "GEOPOLIT", "SAVAŞ", "YAPTIRI", "NATO", "MISSILE", "INVASION",
        "TENSION", "NUCLEAR",
    ],
    "Enerji Şoku": [
        "OIL", "GAS", "ENERGY", "OPEC", "CRUDE", "PETROL", "DOĞALGAZ",
        "LNG", "BRENT", "FUEL", "PIPELINE",
    ],
    "Salgın / Sağlık": [
        "COVID", "PANDEMIC", "VIRUS", "EPIDEMIC", "DISEASE", "SALGIN",
        "LOCKDOWN", "QUARANTINE", "VACCINE", "OMICRON", "DELTA",
    ],
    "Seçim / Siyaset": [
        "ELECTION", "VOTE", "POLITICAL", "GOVERNMENT", "PARLIAMENT",
        "SEÇİM", "ERDOĞAN", "PRESIDENT", "MINISTER", "COUP", "DARBE",
    ],
    "Bilanço Sürprizi": [
        "EARNINGS", "REVENUE", "PROFIT", "LOSS", "QUARTERLY", "BILANÇO",
        "EPS", "BEAT", "MISS", "FINANCIAL RESULTS", "NET INCOME",
        "KAR AÇIKLA", "MALİ SONUÇ",
    ],
    "Temettü / Bedelsiz": [
        "DIVIDEND", "TEMETTÜ", "BEDELSIZ", "RIGHTS ISSUE", "BONUS SHARE",
        "STOCK SPLIT", "PAY-OUT", "DISTRIBUTION",
    ],
    "Yönetim Değişikliği": [
        "CEO", "CFO", "CHAIRMAN", "RESIGN", "APPOINT", "MANAGEMENT CHANGE",
        "GENEL MÜDÜR", "YÖNETİM KURULU", "BOARD CHANGE", "NEW DIRECTOR",
    ],
    "Endeks Girişi / Çıkışı": [
        "INDEX INCLUSION", "INDEX REMOVAL", "MSCI", "BIST30", "BIST50",
        "BIST100", "S&P500", "REBALANCING", "ENDEKS",
    ],
    "Kredi Notu": [
        "CREDIT RATING", "DOWNGRADE", "UPGRADE", "MOODY", "FITCH", "S&P",
        "SOVEREIGN RATING", "KREDİ NOTU", "OUTLOOK",
    ],
    "Manipülasyon / SPK": [
        "SPK", "CMB INVESTIGATION", "MANIPULATION", "INSIDER TRADING",
        "MARKET ABUSE", "FRAUD", "INVESTIGATION", "SORUŞTURMA",
        "PİYASA BOZUCU",
    ],
}


def _categorize(headlines: list[dict]) -> list[str]:
    """Haber başlıklarından kategori etiketleri çıkarır."""
    text = " ".join(h.get("title", "").upper() for h in headlines)
    cats = []
    for cat, keywords in _KEYWORD_CATS.items():
        if any(kw in text for kw in keywords):
            cats.append(cat)
    return cats[:6] if cats else ["Genel Piyasa"]


# ── GDELT DOC 2.0 ─────────────────────────────────────────────────────────────
def _gdelt_context(symbol: str, date_str: str, window_days: int = 2) -> list[dict]:
    queries = SYMBOL_QUERIES.get(symbol.upper(), [symbol])
    query_term = " OR ".join(f'"{q}"' for q in queries[:2])

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return []

    start = (dt - timedelta(days=window_days)).strftime("%Y%m%d%H%M%S")
    end   = (dt + timedelta(days=window_days + 1)).strftime("%Y%m%d%H%M%S")

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

    results = []
    for art in data.get("articles", []):
        title = art.get("title", "").strip()
        if title and len(title) > 10:
            results.append({
                "title":  title,
                "url":    art.get("url", ""),
                "source": art.get("domain", ""),
                "date":   art.get("seendate", "")[:8],
                "lang":   art.get("language", "en"),
            })

    # Sonuç yoksa geniş piyasa sorgusu
    if not results:
        fb = "Turkey stock market BIST" if symbol.upper() in _BIST_SYMBOLS else "stock market financial"
        fb_params = {**params, "query": f'"{fb}"', "maxrecords": "6"}
        fb_url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(fb_params)
        try:
            with urllib.request.urlopen(
                urllib.request.Request(fb_url, headers={"User-Agent": "Analysight/1.0"}),
                timeout=8,
            ) as r:
                fb_data = json.loads(r.read().decode())
            for art in fb_data.get("articles", []):
                t = art.get("title", "").strip()
                if t and len(t) > 10:
                    results.append({"title": t, "url": art.get("url", ""),
                                    "source": art.get("domain", ""), "date": "", "lang": "en"})
        except Exception:
            pass

    return results


# ── KAP bildirimleri ──────────────────────────────────────────────────────────
# KAP üye OID haritası (routers/kap.py'den kopyalandı)
_KAP_MEMBER_OIDS: dict[str, str] = {
    "THYAO": "1080","GARAN": "368","EREGL": "350","TUPRS": "1125","BIMAS": "3119",
    "ISCTR": "524","AKBNK": "67","TCELL": "1016","SAHOL": "905","KCHOL": "576",
    "TOASO": "1092","FROTO": "363","ASELS": "165","SISE": "925","ARCLK": "117",
    "PETKM": "804","TTKOM": "1122","TAVHL": "1030","EKGYO": "16325","VESTL": "1174",
    "HALKB": "441","VAKBN": "1157","YKBNK": "1252","PGSUS": "9752","MGROS": "654",
}

def _kap_context(symbol: str, date_str: str) -> list[dict]:
    """KAP'tan sembolün o tarihe yakın bildirimlerini çeker."""
    oid = _KAP_MEMBER_OIDS.get(symbol.upper())
    if not oid:
        return []

    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return []

    url = f"https://www.kap.org.tr/tr/api/memberDisclosureQuery/{oid}"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            items = json.loads(resp.read().decode())
    except Exception:
        return []

    results = []
    window = timedelta(days=3)
    for item in items[:50]:  # son 50 bildirimi tara
        try:
            pub_date_str = (item.get("publishDate") or item.get("date") or "")[:10]
            if not pub_date_str:
                continue
            pub_dt = datetime.strptime(pub_date_str, "%Y-%m-%d")
            if abs((pub_dt - dt).days) <= 3:
                title = (item.get("title") or item.get("summary") or "").strip()
                if title:
                    results.append({
                        "title":  title,
                        "url":    f"https://www.kap.org.tr/tr/Bildirim/{item.get('id','')}",
                        "source": "KAP",
                        "date":   pub_date_str,
                        "lang":   "tr",
                    })
        except Exception:
            continue

    return results[:5]


# ── FRED API — makro bağlam ───────────────────────────────────────────────────
_FRED_SERIES = {
    "DFF":    "Fed Funds Rate",        # ABD faiz
    "DEXUSEU":"USD/EUR",
    "DEXUSNB": "USD/TRY" ,            # ABD-Türkiye kur
    "CPIAUCSL":"ABD Enflasyon (CPI)",
    "VIXCLS":  "VIX Korku Endeksi",
}

def _fred_context(date_str: str) -> list[dict]:
    """
    FRED'den o tarihe ±5 gün içindeki makro gösterge değerlerini çeker.
    API key gerektirmez (public endpoints).
    """
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return []

    obs_start = (dt - timedelta(days=5)).strftime("%Y-%m-%d")
    obs_end   = (dt + timedelta(days=5)).strftime("%Y-%m-%d")

    results = []
    for series_id, label in _FRED_SERIES.items():
        url = (
            f"https://fred.stlouisfed.org/graph/fredgraph.csv"
            f"?id={series_id}&vintage_date={obs_end}"
        )
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                lines = resp.read().decode().strip().split("\n")
            # Son satır = en yakın değer
            if len(lines) >= 2:
                parts = lines[-1].split(",")
                val = parts[1].strip() if len(parts) >= 2 else "?"
                results.append({
                    "title":  f"{label}: {val}",
                    "source": "FRED",
                    "date":   parts[0].strip() if parts else date_str,
                    "url":    f"https://fred.stlouisfed.org/series/{series_id}",
                    "lang":   "en",
                })
        except Exception:
            continue

    return results


# ── NewsAPI ───────────────────────────────────────────────────────────────────
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

    params = {
        "q":        q,
        "from":     (dt - timedelta(days=2)).strftime("%Y-%m-%d"),
        "to":       (dt + timedelta(days=2)).strftime("%Y-%m-%d"),
        "sortBy":   "relevancy",
        "pageSize": "5",
        "apiKey":   key,
    }
    url = "https://newsapi.org/v2/everything?" + urllib.parse.urlencode(params)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except Exception:
        return []

    results = []
    for art in data.get("articles", []):
        title = (art.get("title") or "").strip()
        if title and title != "[Removed]":
            results.append({
                "title":  title,
                "url":    art.get("url", ""),
                "source": art.get("source", {}).get("name", ""),
                "date":   (art.get("publishedAt") or "")[:10],
                "lang":   "en",
            })
    return results


# ── Wikipedia dönem özeti ─────────────────────────────────────────────────────
def _wiki_period(date_str: str) -> Optional[str]:
    """2013 öncesi tarihler için yıl özeti."""
    try:
        year = int(date_str[:4])
    except ValueError:
        return None
    if year >= 2013:
        return None

    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{year}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
        extract = data.get("extract", "")
        return extract[:500] if extract else None
    except Exception:
        return None


# ── Ana fonksiyon ─────────────────────────────────────────────────────────────
def enrich_anomaly(symbol: str, date_str: str, magnitude: float) -> dict:
    """
    Tek bir anomali için tam bağlam paketi.
    Döner:
      headlines:      list[{title, url, source, date, lang}]
      macro_data:     list[{title, source, date}]  — FRED göstergeleri
      categories:     list[str]  — 12 olası kategori
      period_summary: str | None
      data_sources:   list[str]
    """
    cache_key = f"{symbol}:{date_str}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    headlines: list[dict] = []
    sources_used: list[str] = []

    # 1. NewsAPI (öncelikli — en kaliteli)
    na = _newsapi_context(symbol, date_str)
    if na:
        headlines.extend(na)
        sources_used.append("newsapi")

    # 2. KAP bildirimleri (BIST)
    kap = _kap_context(symbol, date_str)
    if kap:
        existing = {h["title"] for h in headlines}
        for k in kap:
            if k["title"] not in existing:
                headlines.append(k)
                existing.add(k["title"])
        sources_used.append("kap")

    # 3. GDELT
    gdelt = _gdelt_context(symbol, date_str)
    if gdelt:
        existing = {h["title"] for h in headlines}
        for g in gdelt:
            if g["title"] not in existing:
                headlines.append(g)
                existing.add(g["title"])
        sources_used.append("gdelt")

    # 4. FRED makro verisi (haber değil, ek bağlam)
    macro_data = _fred_context(date_str)

    # 5. Wikipedia dönem özeti (2013 öncesi)
    period_summary = _wiki_period(date_str)
    if period_summary and not headlines:
        sources_used.append("wikipedia")

    categories = _categorize(headlines)

    result = {
        "date":           date_str,
        "symbol":         symbol,
        "magnitude":      magnitude,
        "headlines":      headlines[:10],
        "macro_data":     macro_data,
        "categories":     categories,
        "period_summary": period_summary,
        "data_sources":   sources_used,
    }

    _cache[cache_key] = (now, result)
    return result
