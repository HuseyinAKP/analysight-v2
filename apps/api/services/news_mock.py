"""
Mock haber akışı — GDELT entegrasyonu yapılana kadar simüle veri.
Kategori etiketleri ve tipik fiyat etkileriyle birlikte.
"""
from __future__ import annotations
import random
from datetime import datetime, timedelta

CATEGORIES = {
    "Bilanço":     {"label": "Bilanço",        "color": "blue",   "impact": "high",
                    "typical_effect": "Yüksek fiyat hareketi — pozitif sürpriz +%3–8, negatif -%3–10",
                    "effect_direction": "both"},
    "Makro":       {"label": "Makro",           "color": "purple", "impact": "medium",
                    "typical_effect": "Faiz/enflasyon kararları tüm piyasayı etkiler — orta vadeli etki",
                    "effect_direction": "neutral"},
    "Jeopolitik":  {"label": "Jeopolitik",      "color": "red",    "impact": "medium",
                    "typical_effect": "Belirsizlik artırır, risk primini yükseltir — genellikle kısa vadeli satış",
                    "effect_direction": "bearish"},
    "Regülasyon":  {"label": "Regülasyon",      "color": "orange", "impact": "medium",
                    "typical_effect": "Sektöre özel etki — kısıtlayıcı regülasyonlar genellikle -%2–5",
                    "effect_direction": "bearish"},
    "Ürün":        {"label": "Ürün / Teknoloji","color": "green",  "impact": "low",
                    "typical_effect": "Yeni ürün lansmanları kısa vadeli +%1–3 pozitif etki yaratabilir",
                    "effect_direction": "bullish"},
    "Birleşme":    {"label": "M&A",             "color": "yellow", "impact": "high",
                    "typical_effect": "Hedef şirkette güçlü pozitif etki — genellikle +%10–30 premium",
                    "effect_direction": "bullish"},
    "Sektör":      {"label": "Sektör",          "color": "gray",   "impact": "low",
                    "typical_effect": "Sektör geneli haberleri bireysel hisselere sınırlı etki eder",
                    "effect_direction": "neutral"},
}

NEWS_POOL = {
    "THYAO": [
        ("THY 3. çeyrek net kârını beklentilerin üzerinde açıkladı", "Bilanço", "positive"),
        ("Türkiye-Avrupa hava trafiği yüzde 12 arttı", "Sektör", "positive"),
        ("Yakıt maliyetlerindeki artış THY marjlarını sıkıştırıyor", "Makro", "negative"),
        ("TCMB faiz kararı THY hisse senedine etkisi", "Makro", "neutral"),
        ("THY yeni transatlantik hat açıklıyor", "Ürün", "positive"),
        ("Rusya-Ukrayna gerilimi havacılık sektörüne yansıdı", "Jeopolitik", "negative"),
    ],
    "GARAN": [
        ("Garanti Bankası çeyrek kârı tahminlerin üzerinde", "Bilanço", "positive"),
        ("BDDK yeni kredi yönetmeliği açıkladı", "Regülasyon", "negative"),
        ("Türk bankacılık sektörü enflasyona karşı dirençli", "Makro", "neutral"),
        ("Garanti dijital bankacılık platformunu güncelledi", "Ürün", "positive"),
        ("Merkez bankası faiz kararı banka hisselerini vurdu", "Makro", "negative"),
    ],
    "AAPL": [
        ("Apple güçlü iPhone 16 satış rakamlarını açıkladı", "Bilanço", "positive"),
        ("Apple Vision Pro satışları beklentinin altında kaldı", "Ürün", "negative"),
        ("ABD-Çin teknoloji gerilimi Apple tedarik zincirine tehdit", "Jeopolitik", "negative"),
        ("Apple yapay zeka özelliklerini iOS 18'e entegre ediyor", "Ürün", "positive"),
        ("SEC Apple'ın gelir kayıt yöntemini inceliyor", "Regülasyon", "negative"),
        ("Berkshire Hathaway Apple hisselerini artırdı", "Sektör", "positive"),
    ],
    "NVDA": [
        ("NVIDIA veri merkezi geliri rekor kırdı", "Bilanço", "positive"),
        ("Çin'e çip satış kısıtlamaları NVDA gelirini etkiliyor", "Regülasyon", "negative"),
        ("NVIDIA yeni Blackwell mimarisini duyurdu", "Ürün", "positive"),
        ("Yapay zeka harcamalarındaki artış NVDA'ya yatırım fırsatı", "Sektör", "positive"),
        ("AMD rekabeti NVDA pazar payını tehdit ediyor", "Sektör", "negative"),
    ],
    "BTC-USD": [
        ("Bitcoin ETF'leri rekor haftalık giriş kaydetti", "Sektör", "positive"),
        ("SEC kripto borsalarına yönelik soruşturma başlattı", "Regülasyon", "negative"),
        ("El Salvador Bitcoin rezervini artırdı", "Makro", "positive"),
        ("Bitcoin halving yaklaşıyor: tarihsel analiz", "Sektör", "positive"),
        ("Çin kripto madenciliğini tekrar kısıtlamayı değerlendiriyor", "Jeopolitik", "negative"),
    ],
}

DEFAULT_NEWS = [
    ("Piyasalar Fed açıklamalarını bekliyor", "Makro", "neutral"),
    ("Küresel büyüme tahminleri aşağı güncellendi", "Makro", "negative"),
    ("Risk iştahı güçlü, gelişen piyasalara giriş arttı", "Makro", "positive"),
    ("Dolar endeksi kritik direncini test ediyor", "Makro", "neutral"),
]


def get_news(symbol: str, count: int = 6) -> list:
    pool = NEWS_POOL.get(symbol.upper(), DEFAULT_NEWS)
    random.seed(hash(symbol + str(datetime.now().date())))
    selected = random.sample(pool, min(len(pool), count))

    now = datetime.now()
    result = []
    for i, (headline, cat, sentiment) in enumerate(selected):
        hours_ago = random.randint(i * 3, i * 3 + 8)
        ts = now - timedelta(hours=hours_ago)
        cat_info = CATEGORIES[cat]
        result.append({
            "headline": headline,
            "category": cat,
            "category_label": cat_info["label"],
            "category_color": cat_info["color"],
            "impact": cat_info["impact"],
            "typical_effect": cat_info["typical_effect"],
            "effect_direction": cat_info["effect_direction"],
            "sentiment": sentiment,
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:00"),
            "hours_ago": hours_ago,
            "source": "Mock / GDELT (MVP)",
        })
    return result
