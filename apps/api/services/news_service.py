"""
News aggregation service — mock data simulating real news sources.
Structured to be replaced with real RSS/API feeds later.
"""
from __future__ import annotations
import random
from datetime import datetime, timedelta

# News sources with metadata
NEWS_SOURCES = [
    {"id": "bloomberg",     "name": "Bloomberg",       "country": "US", "language": "en", "category": "finance",    "logo": "B",  "color": "#000000", "url": "https://bloomberg.com"},
    {"id": "reuters",       "name": "Reuters",         "country": "UK", "language": "en", "category": "finance",    "logo": "R",  "color": "#FF8000", "url": "https://reuters.com"},
    {"id": "ft",            "name": "Financial Times", "country": "UK", "language": "en", "category": "finance",    "logo": "FT", "color": "#FCD000", "url": "https://ft.com"},
    {"id": "wsj",           "name": "Wall Street Jrnl","country": "US", "language": "en", "category": "finance",    "logo": "W",  "color": "#0274B6", "url": "https://wsj.com"},
    {"id": "cnbc",          "name": "CNBC",            "country": "US", "language": "en", "category": "markets",    "logo": "C",  "color": "#003087", "url": "https://cnbc.com"},
    {"id": "seeking_alpha", "name": "Seeking Alpha",   "country": "US", "language": "en", "category": "analysis",   "logo": "SA", "color": "#1DB954", "url": "https://seekingalpha.com"},
    {"id": "hurriyet",      "name": "Hürriyet Ekon.",  "country": "TR", "language": "tr", "category": "markets",    "logo": "H",  "color": "#E30613", "url": "https://hurriyet.com.tr"},
    {"id": "dunya",         "name": "Dünya Gazetesi",  "country": "TR", "language": "tr", "category": "finance",    "logo": "D",  "color": "#1A237E", "url": "https://dunya.com"},
    {"id": "bloomberght",   "name": "Bloomberg HT",    "country": "TR", "language": "tr", "category": "markets",    "logo": "BH", "color": "#000000", "url": "https://bloomberght.com"},
    {"id": "haberturk",     "name": "Habertürk Ekon.", "country": "TR", "language": "tr", "category": "economy",    "logo": "HT", "color": "#E74C3C", "url": "https://haberturk.com"},
    {"id": "investing_com", "name": "Investing.com",   "country": "US", "language": "en", "category": "data",       "logo": "I",  "color": "#F08B1A", "url": "https://investing.com"},
    {"id": "tradingview",   "name": "TradingView",     "country": "US", "language": "en", "category": "analysis",   "logo": "TV", "color": "#2962FF", "url": "https://tradingview.com"},
]

# Symbol-specific news templates (TR)
_SYMBOL_NEWS = {
    "THYAO": [
        ("THY yeni uçuş noktası açıkladı: Güney Amerika'ya direkt sefer", "positive", "expansion"),
        ("Türk Hava Yolları 3. çeyrek yolcu sayısını açıkladı — beklentileri aştı", "positive", "earnings"),
        ("THY yakıt maliyeti baskısını fiyatlamaya yansıtıyor", "neutral", "costs"),
        ("THY için analist hedef fiyatı revize edildi", "neutral", "analyst"),
        ("THY grev uyarısı — çalışan sendikasıyla müzakereler devam ediyor", "negative", "labor"),
    ],
    "GARAN": [
        ("Garanti BBVA net faiz marjı baskı altında", "negative", "earnings"),
        ("TCMB faiz kararı bankaların kârlılığını nasıl etkiler?", "neutral", "macro"),
        ("Garanti dijital bankacılık kullanıcı sayısını artırdı", "positive", "growth"),
        ("Bankacılık sektörü için zorunlu karşılık değişikliği", "neutral", "regulation"),
        ("Yabancı yatırımcılar BIST bankacılık hisselerine ilgi gösteriyor", "positive", "flow"),
    ],
    "EREGL": [
        ("Ereğli çelik üretim maliyetleri artıyor — demir cevheri fiyatı yükseldi", "negative", "costs"),
        ("Demir-çelik sektöründe ihracat kotası tartışması", "negative", "regulation"),
        ("Küresel çelik talebi görünümü: Çin etkisi", "neutral", "macro"),
        ("EREGL temettü açıklaması — yatırımcılar için ne anlam ifade ediyor", "positive", "dividend"),
        ("Altyapı projeleri çelik talebini destekliyor", "positive", "demand"),
    ],
    "AAPL": [
        ("Apple Vision Pro satışları analistlerin beklentisini aştı", "positive", "product"),
        ("Çin'de iPhone satışları baskı altında", "negative", "sales"),
        ("Apple AI özellikleri iOS 18.2 ile geliyor", "positive", "product"),
        ("Apple hisse geri alım programını genişletti", "positive", "corporate"),
        ("Çip tedarik zinciri normalleşiyor", "positive", "supply_chain"),
    ],
    "MSFT": [
        ("Azure büyümesi yüzde 29'a ulaştı — bulut güçlü seyrediyor", "positive", "earnings"),
        ("Microsoft Copilot kurumsal müşterilerde hızla yayılıyor", "positive", "growth"),
        ("Activision entegrasyonu plana göre ilerliyor", "neutral", "corporate"),
        ("Microsoft veri merkezi yatırımlarını ikiye katladı", "positive", "investment"),
        ("EU yapay zeka düzenlemesi Microsoft'u nasıl etkiler", "neutral", "regulation"),
    ],
    "NVDA": [
        ("NVIDIA H200 siparişleri kapasiteyi aşıyor", "positive", "demand"),
        ("Çin'e ihracat kısıtlamaları NVDA gelirini nasıl etkiler", "negative", "regulation"),
        ("Veri merkezi GPU talebi 2025'e kadar güçlü seyrediyor", "positive", "outlook"),
        ("AMD rakabeti yoğunlaşıyor — pazar payı savaşı", "negative", "competition"),
        ("NVIDIA yeni Blackwell mimarisini tanıttı", "positive", "product"),
    ],
    "BTC-USD": [
        ("Bitcoin ETF net girişleri rekor kırdı", "positive", "flows"),
        ("Fed faiz kararı kripto piyasasını nasıl etkiledi", "neutral", "macro"),
        ("Bitcoin madencileri halving sonrası adaptasyon sürecinde", "neutral", "mining"),
        ("Kurumsal yatırımcılar BTC tahsisini artırıyor", "positive", "institutional"),
        ("Kripto düzenlemesi: AB MiCA uygulamaya girdi", "neutral", "regulation"),
    ],
    "ETH-USD": [
        ("Ethereum spot ETF onayı — ne anlam ifade ediyor", "positive", "regulation"),
        ("ETH staking getirisi düşüyor — artan rekabet", "neutral", "staking"),
        ("Layer-2 ağları Ethereum işlem hacmini artırıyor", "positive", "adoption"),
        ("Gas ücretleri tarihi düşüklere geriledi", "positive", "usability"),
        ("DeFi protokollerinde toplam kilitli değer artıyor", "positive", "defi"),
    ],
}

_GENERIC_NEWS = [
    ("Küresel piyasalar ABD enflasyon verisine odaklandı", "neutral", "macro"),
    ("Dolar/TL kurunda oynaklık artıyor", "neutral", "fx"),
    ("Fed tutanakları: faiz indirimi zamanlaması netleşiyor", "positive", "macro"),
    ("Petrol fiyatları jeopolitik gerginlikle yükseldi", "negative", "macro"),
    ("Altın fiyatı güvenli liman alımlarıyla destekleniyor", "neutral", "macro"),
    ("BIST-100 günlük rekor deneme", "positive", "market"),
    ("Yabancı yatırımcılar Türk piyasasına ilgi artırdı", "positive", "flow"),
    ("TCMB faiz kararı beklentisi piyasaları hareketlendirdi", "neutral", "monetary"),
]

_CATEGORY_LABELS = {
    "expansion": "Büyüme", "earnings": "Kazanç", "costs": "Maliyetler",
    "analyst": "Analist", "labor": "İş Gücü", "macro": "Makro",
    "growth": "Büyüme", "regulation": "Düzenleme", "flow": "Para Akışı",
    "dividend": "Temettü", "demand": "Talep", "product": "Ürün",
    "sales": "Satışlar", "corporate": "Kurumsal", "supply_chain": "Tedarik",
    "investment": "Yatırım", "competition": "Rekabet", "outlook": "Görünüm",
    "flows": "ETF Akışı", "mining": "Madencilik", "institutional": "Kurumsal",
    "staking": "Staking", "adoption": "Benimseme", "usability": "Kullanılabilirlik",
    "defi": "DeFi", "fx": "Döviz", "monetary": "Para Politikası", "market": "Piyasa",
}

_SENTIMENT_COLOR = {"positive": "emerald", "negative": "red", "neutral": "yellow"}
_SENTIMENT_LABEL = {"positive": "Olumlu", "negative": "Olumsuz", "neutral": "Nötr"}
_IMPACT_LABELS = ["Yüksek", "Orta", "Düşük"]


def _make_news_item(headline: str, sentiment: str, category: str, source: dict, hours_ago: float) -> dict:
    return {
        "id": f"{source['id']}_{abs(hash(headline)) % 100000}",
        "headline": headline,
        "summary": f"{headline}. Piyasa katılımcıları gelişmeyi yakından izliyor.",
        "sentiment": sentiment,
        "sentiment_label": _SENTIMENT_LABEL[sentiment],
        "sentiment_color": _SENTIMENT_COLOR[sentiment],
        "category": category,
        "category_label": _CATEGORY_LABELS.get(category, category),
        "impact": _IMPACT_LABELS[random.randint(0, 2)],
        "source": source,
        "published_at": (datetime.now() - timedelta(hours=hours_ago)).strftime("%Y-%m-%dT%H:%M:00"),
        "hours_ago": round(hours_ago, 1),
        "url": source["url"],
    }


def get_symbol_news(symbol: str, limit: int = 15) -> list[dict]:
    random.seed(hash(symbol) % 2**31)
    templates = _SYMBOL_NEWS.get(symbol.upper(), []) + _GENERIC_NEWS
    items = []
    for i, (headline, sentiment, category) in enumerate(templates[:limit]):
        source = random.choice(NEWS_SOURCES)
        hours = random.uniform(0.5, 48)
        items.append(_make_news_item(headline, sentiment, category, source, hours))
    # Sort newest first
    items.sort(key=lambda x: x["hours_ago"])
    return items


def get_all_news(limit: int = 40, source_filter: str | None = None, sentiment_filter: str | None = None) -> dict:
    """Aggregate news feed across all symbols."""
    random.seed(42)
    all_templates = []
    for sym, templates in _SYMBOL_NEWS.items():
        for headline, sentiment, category in templates:
            source = random.choice(NEWS_SOURCES)
            hours = random.uniform(0.2, 72)
            all_templates.append((headline, sentiment, category, source, hours, sym))

    for headline, sentiment, category in _GENERIC_NEWS:
        source = random.choice(NEWS_SOURCES)
        hours = random.uniform(0.2, 24)
        all_templates.append((headline, sentiment, category, source, hours, None))

    # Sort by freshness
    all_templates.sort(key=lambda x: x[4])

    # Apply filters
    if source_filter:
        all_templates = [t for t in all_templates if t[3]["id"] == source_filter]
    if sentiment_filter:
        all_templates = [t for t in all_templates if t[1] == sentiment_filter]

    items = []
    for headline, sentiment, category, source, hours, sym in all_templates[:limit]:
        item = _make_news_item(headline, sentiment, category, source, hours)
        if sym:
            item["symbol"] = sym
        items.append(item)

    # Stats
    sentiments = [t[1] for t in all_templates[:50]]
    pos = sentiments.count("positive")
    neg = sentiments.count("negative")
    neu = sentiments.count("neutral")
    total = max(len(sentiments), 1)

    return {
        "items": items,
        "sources": NEWS_SOURCES,
        "stats": {
            "total": len(items),
            "positive_pct": round(pos / total * 100),
            "negative_pct": round(neg / total * 100),
            "neutral_pct": round(neu / total * 100),
            "market_mood": "Olumlu" if pos > neg + neu * 0.5 else ("Olumsuz" if neg > pos + neu * 0.5 else "Karışık"),
            "mood_color": "emerald" if pos > neg + neu * 0.5 else ("red" if neg > pos + neu * 0.5 else "yellow"),
        },
    }
