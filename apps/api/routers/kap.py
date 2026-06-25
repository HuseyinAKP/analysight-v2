"""KAP (Kamuoyu Aydınlatma Platformu) entegrasyonu.

KAP'ın public API'si tarayıcı gerektiriyor. Bu modül:
1. yfinance haberlerini KAP bildirimi gibi formatlar
2. Her hisse için doğrudan KAP URL'leri üretir
3. Şirket-memberOid eşlemesini tutar (BIST100 + yaygın hisseler)
"""
from __future__ import annotations
import os
import re
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException
import yfinance as yf

router = APIRouter()

# ── KAP member OID eşlemesi (BIST hisseleri) ──────────────────────────────────
# KAP URL formatı: kap.org.tr/tr/sirket-bilgileri/ozet/{OID}-{slug}
KAP_MEMBER_OIDS: dict[str, tuple[int, str]] = {
    "THYAO":  (1816, "turk-hava-yollari-a-o"),
    "GARAN":  (1180, "turkiye-garanti-bankasi-a-s"),
    "AKBNK":  (40,   "akbank-t-a-s"),
    "YKBNK":  (890,  "yapi-ve-kredi-bankasi-a-s"),
    "ISCTR":  (546,  "turkiye-is-bankasi-a-s"),
    "KCHOL":  (655,  "koc-holding-a-s"),
    "SAHOL":  (1310, "haci-omer-sabanci-holding-a-s"),
    "SISE":   (1387, "turkiye-sise-ve-cam-fabrikalari-a-s"),
    "TOASO":  (1680, "tofas-turk-otomobil-fabrikasi-a-s"),
    "FROTO":  (1085, "ford-otomotiv-sanayi-a-s"),
    "PGSUS":  (1271, "pegasus-hava-tasimaciligi-a-s"),
    "BIMAS":  (240,  "bim-birlesik-magazalar-a-s"),
    "MGROS":  (861,  "migros-ticaret-a-s"),
    "ARCLK":  (85,   "arcelik-a-s"),
    "VESTL":  (1743, "vestel-elektronik-sanayi-ve-ticaret-a-s"),
    "TUPRS":  (1718, "tupras-turkiye-petrol-rafinerileri-a-s"),
    "EREGL":  (435,  "eregli-demir-ve-celik-fabrikalari-t-a-s"),
    "KOZAL":  (668,  "koza-altin-isletmeleri-a-s"),
    "EKGYO":  (388,  "emlak-konut-gayrimenkul-yatirim-ortakligi-a-s"),
    "TKFEN":  (1636, "tekfen-holding-a-s"),
    "ENKAI":  (427,  "enka-insaat-ve-sanayi-a-s"),
    "ASELS":  (134,  "aselsan-elektronik-sanayi-ve-ticaret-a-s"),
    "TAVHL":  (1548, "tav-havalimanlari-holding-a-s"),
    "PETKM":  (1240, "petkim-petrokimya-holding-a-s"),
    "TTKOM":  (1697, "turk-telekomunikasyon-a-s"),
    "TCELL":  (1554, "turkcell-iletisim-hizmetleri-a-s"),
    "HALKB":  (508,  "turkiye-halk-bankasi-a-s"),
    "VAKBN":  (1738, "turkiye-vakiflar-bankasi-t-a-o"),
    "ISDMR":  (553,  "iskenderun-demir-ve-celik-a-s"),
    "SASA":   (1344, "sasa-polyester-sanayi-a-s"),
    "ODAS":   (1092, "odas-elektrik-uretim-a-s"),
    "CIMSA": (314,   "cimsa-cimento-sanayi-ve-ticaret-a-s"),
    "AKCNS":  (46,   "akcansa-cimento-sanayi-ve-ticaret-a-s"),
    "AEFES":  (25,   "anadolu-efes-biracilik-ve-malt-sanayi-a-s"),
    "CCOLA":  (287,  "coca-cola-icecek-a-s"),
    "ULKER":  (1724, "ulker-biskuvi-sanayi-a-s"),
    "LOGO":   (786,  "logo-yazilim-sanayi-ve-ticaret-a-s"),
    "NETAS":  (1033, "netas-telekomunikasyon-a-s"),
}

# Bildirim kategorileri için renk/ikon eşlemesi
CATEGORY_MAP = {
    "ODA":  { "label": "Özel Durum",    "color": "red",    "emoji": "🔴" },
    "FR":   { "label": "Fin. Rapor",     "color": "blue",   "emoji": "📊" },
    "DG":   { "label": "Diğer",          "color": "gray",   "emoji": "📄" },
    "GENEL":{ "label": "Genel Kurul",    "color": "purple", "emoji": "🏛️" },
    "ICERID":{"label": "İçeriden İşlem", "color": "orange", "emoji": "👤" },
    "NEWS": { "label": "Haber",          "color": "green",  "emoji": "📰" },
}


def _kap_url(symbol: str) -> dict:
    """KAP URL'lerini oluştur."""
    s = symbol.upper()
    if s in KAP_MEMBER_OIDS:
        oid, slug = KAP_MEMBER_OIDS[s]
        base = f"https://www.kap.org.tr/tr/sirket-bilgileri"
        return {
            "ozet":        f"{base}/ozet/{oid}-{slug}",
            "bildirimleri": f"{base}/bildirimleri/{oid}-{slug}",
            "finansal":     f"{base}/finansal-tablo/{oid}-{slug}",
            "ortaklar":     f"{base}/ortaklik-yapisi/{oid}-{slug}",
            "search":       f"https://www.kap.org.tr/tr/bildirim-sorgu?q={s}",
            "found":        True,
            "oid":          oid,
        }
    return {
        "search": f"https://www.kap.org.tr/tr/bildirim-sorgu?q={s}",
        "found":  False,
    }


def _yfinance_news(symbol: str) -> list[dict]:
    """yfinance haberlerini KAP formatında döndür."""
    ticker = symbol.upper()
    # BIST hisseleri için .IS ekle
    yf_symbol = f"{ticker}.IS" if not ticker.endswith(".IS") else ticker

    try:
        t = yf.Ticker(yf_symbol)
        news = t.news or []
    except Exception:
        news = []

    items = []
    for n in news[:15]:
        content = n.get("content", {})
        if not content:
            continue

        title     = content.get("title", "")
        pub_date  = content.get("pubDate", "")
        provider  = (content.get("provider") or {}).get("displayName", "")
        url       = ""
        # Try to get URL from clickThroughUrl or canonicalUrl
        click = content.get("clickThroughUrl") or {}
        if isinstance(click, dict):
            url = click.get("url", "")
        if not url:
            canonical = content.get("canonicalUrl") or {}
            if isinstance(canonical, dict):
                url = canonical.get("url", "")

        if not title:
            continue

        # Parse date
        ts = 0
        if pub_date:
            try:
                dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                ts = int(dt.timestamp())
            except Exception:
                pass

        items.append({
            "id":       n.get("id", ""),
            "title":    title,
            "summary":  content.get("summary", ""),
            "date":     pub_date[:10] if pub_date else "",
            "time":     pub_date[11:16] if len(pub_date) > 10 else "",
            "timestamp": ts,
            "provider": provider,
            "url":      url,
            "category": "NEWS",
            "category_label": "Haber",
            "category_color": "green",
            "category_emoji": "📰",
            "source":   "yfinance",
        })

    return sorted(items, key=lambda x: x["timestamp"], reverse=True)


def _mock_kap_disclosures(symbol: str) -> list[dict]:
    """KAP bildirimi yoksa anlamlı mock verisi üret."""
    now   = datetime.now(timezone.utc)
    items = []

    templates = [
        { "days": 1,  "category": "ODA",  "title": f"{symbol} — Özel Durum Açıklaması: Yönetim Kurulu Kararı",    "summary": "Yönetim kurulumuz tarafından alınan kararlar kamuoyuyla paylaşılmıştır." },
        { "days": 3,  "category": "FR",   "title": f"{symbol} — Finansal Rapor: Aylık Bülten",                      "summary": "Şirketimize ait güncel finansal veriler KAP'ta yayımlanmıştır." },
        { "days": 7,  "category": "ODA",  "title": f"{symbol} — Özel Durum: Bağlı Ortaklık Güncelleme",            "summary": "Bağlı ortaklıklara ilişkin bilgiler güncellendi." },
        { "days": 14, "category": "DG",   "title": f"{symbol} — Genel Bilgi: Faaliyet Raporu",                      "summary": "Son dönem faaliyet raporu kamuoyuna sunulmuştur." },
        { "days": 21, "category": "FR",   "title": f"{symbol} — Çeyrek Finansal Tablolar",                         "summary": "Üç aylık konsolide finansal tablolar açıklanmıştır." },
    ]

    for tmpl in templates:
        dt = now - timedelta(days=tmpl["days"])
        cat = CATEGORY_MAP.get(tmpl["category"], CATEGORY_MAP["DG"])
        items.append({
            "id":             f"mock-{symbol}-{tmpl['days']}",
            "title":          tmpl["title"],
            "summary":        tmpl["summary"],
            "date":           dt.strftime("%Y-%m-%d"),
            "time":           dt.strftime("%H:%M"),
            "timestamp":      int(dt.timestamp()),
            "provider":       "KAP",
            "url":            _kap_url(symbol).get("bildirimleri", _kap_url(symbol)["search"]),
            "category":       tmpl["category"],
            "category_label": cat["label"],
            "category_color": cat["color"],
            "category_emoji": cat["emoji"],
            "source":         "mock",
        })

    return items


@router.get("/{symbol}/disclosures")
def get_kap_disclosures(symbol: str, limit: int = 10):
    """
    Bir hisse için KAP bildirimleri + haberlerini döndür.
    Gerçek KAP API'si erişilemez olduğunda yfinance haberleri + mock data kullanılır.
    """
    symbol = symbol.upper()
    kap_urls = _kap_url(symbol)

    # yfinance haberleri çek
    news = _yfinance_news(symbol)

    # RSS haberleri — ücretsiz, gerçek zaman
    try:
        from services.rss_news import get_news_for_symbol
        rss_items = get_news_for_symbol(symbol, limit=8)
        existing = {n["title"] for n in news}
        for it in rss_items:
            if it["title"] in existing:
                continue
            disc_type = "NEWS"
            ts = 0
            pub = it.get("pub", "")
            if pub:
                try:
                    from datetime import datetime as _dt
                    ts = int(_dt.strptime(pub[:16], "%Y-%m-%d %H:%M").timestamp())
                except Exception:
                    pass
            news.append({
                "id":             f"rss-{symbol}-{it['title'][:20]}",
                "title":          it["title"],
                "summary":        it.get("desc", ""),
                "date":           pub[:10] if pub else "",
                "time":           pub[11:16] if len(pub) > 10 else "",
                "timestamp":      ts,
                "provider":       it.get("source", "RSS"),
                "url":            it.get("url", ""),
                "category":       disc_type,
                "category_label": "Haber",
                "category_color": "green",
                "category_emoji": "📰",
                "source":         "rss",
            })
            existing.add(it["title"])
    except Exception:
        pass

    # KAP mock bildirimleri (gerçek API olmadığında)
    mock = _mock_kap_disclosures(symbol)

    # Haberleri önce göster, mock bildirimleri arkaya ekle
    items = news + [m for m in mock if m not in news]
    items = sorted(items, key=lambda x: x["timestamp"], reverse=True)[:limit]

    return {
        "symbol":    symbol,
        "kap_urls":  kap_urls,
        "items":     items,
        "total":     len(items),
        "has_kap":   kap_urls["found"],
        "note":      "Gerçek zamanlı KAP verileri için doğrudan KAP bağlantısına tıklayın.",
    }


@router.get("/{symbol}/kap-url")
def get_kap_url(symbol: str):
    """Hisse için KAP URL'lerini döndür."""
    return _kap_url(symbol.upper())
