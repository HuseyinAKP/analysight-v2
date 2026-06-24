"""
Market Updates & Commentary: Günlük piyasa özeti, ne oluyor briefing, market commentary.
"""
from __future__ import annotations
from datetime import datetime

DAILY_BRIEFING = {
    "date": "2026-06-17",
    "headline": "Küresel Piyasalar Temkinli Yükselişte — Fed Kararı Bekleniyor",
    "summary": "ABD vadeli işlemleri ılımlı yükselişle açılırken BIST endeksler savunma hisselerinin öncülüğünde güne pozitif başladı. Bu hafta Fed toplantısı, Türkiye enflasyon verisi ve NVDA kazanç açıklaması gündemin merkezinde.",
    "sentiment": "temkinli-pozitif",
    "sentiment_score": 62,
    "sections": [
        {
            "title": "🇹🇷 BIST Açılış Görünümü",
            "content": "BIST 100 dün %0.84 yükselişle 9.842 puana ulaştı. Savunma sektörü ASELS ve HAVAİST öncülüğünde öne çıkarken bankacılık sektörü TCMB beklentileriyle görece geride kaldı. Bugün 9.800 destek, 9.900 direnç olarak izleniyor.",
            "tag": "BIST",
            "tag_color": "red",
        },
        {
            "title": "🇺🇸 Wall Street Vadeli",
            "content": "S&P 500 vadeli +0.3% ile 5.620 seviyesinde işlem görüyor. Büyük teknoloji şirketleri küçük de olsa yükselişte. Bu hafta Fed toplantısı (Çarşamba) ve Cuma günü açıklanacak PCE enflasyon verisi kritik.",
            "tag": "US",
            "tag_color": "blue",
        },
        {
            "title": "₿ Kripto Piyasası",
            "content": "Bitcoin 104.800$ seviyesinde %2.1 yükselişle günü açıyor. ETF girişleri 3 hafta üst üste artışta — kurumsal talep güçlü seyrediyor. 100.000$ psikolojik seviye güçlü destek işlevi görüyor.",
            "tag": "CRYPTO",
            "tag_color": "purple",
        },
        {
            "title": " Makro Gündem",
            "content": "Fed Başkanı Powell'ın konuşması bu hafta en kritik olay. Piyasalar yıl içinde 1-2 faiz indirimi fiyatlıyor. EUR/USD 1.082, USD/TRY 38.42 seviyesinde. Brent petrol $78.4 ile görece baskıda.",
            "tag": "MAKRO",
            "tag_color": "yellow",
        },
    ],
    "key_levels": {
        "BIST100":  {"support": 9_750, "resistance": 9_950},
        "SP500":    {"support": 5_550, "resistance": 5_680},
        "BTC":      {"support": 100_000, "resistance": 108_000},
        "USDTRY":   {"support": 37.8, "resistance": 39.2},
        "GOLD":     {"support": 3_220, "resistance": 3_340},
    },
    "watch_list": [
        {"symbol": "NVDA", "reason": "Kazanç açıklaması bu hafta — AI chip talebi odak noktası", "direction": "bullish"},
        {"symbol": "ASELS", "reason": "Savunma sektörü momentum güçlü, kırılım denenebilir", "direction": "bullish"},
        {"symbol": "GARAN", "reason": "TCMB faiz kararı öncesi bankacılık baskı altında kalabilir", "direction": "neutral"},
        {"symbol": "EREGL", "reason": "Çelik sektörü çıkış trendinde — kısa taraf izleniyor", "direction": "bearish"},
    ],
}

COMMENTARY_FEED = [
    {
        "id": "c1",
        "time": "09:32",
        "author": "Analysight AI",
        "avatar": "",
        "tag": "BIST",
        "tag_color": "red",
        "content": "BIST 100 ilk 30 dakikada 9.860'ı test etti. Hacim ortalamanın %18 üzerinde — alıcılar aktif. Savunma hisseleri endeksin pozitif ayrışmasına öncülük ediyor.",
        "liked": False,
    },
    {
        "id": "c2",
        "time": "09:15",
        "author": "Analysight AI",
        "avatar": "",
        "tag": "CRYPTO",
        "tag_color": "purple",
        "content": "BTC 105K direncine yaklaşıyor. Alım baskısı saatlerce yoğun seyretti. Bir kapanış bu seviyenin üzerinde gerçekleşirse 108K bir sonraki hedef olabilir.",
        "liked": False,
    },
    {
        "id": "c3",
        "time": "08:58",
        "author": "Analysight AI",
        "avatar": "",
        "tag": "MAKRO",
        "tag_color": "yellow",
        "content": "Fed Başkanı Powell bu akşam konuşacak. Faiz indirimi için 'daha fazla veri gerekli' tonu bekleniyor. Dolar endeksi 104.2 seviyesini koruyacak mı izleniyor.",
        "liked": False,
    },
    {
        "id": "c4",
        "time": "08:42",
        "author": "Analysight AI",
        "avatar": "",
        "tag": "THYAO",
        "tag_color": "blue",
        "content": "THYAO açılışta 285 desteğini test etti, toparladı. EMA20 (281.4) hâlâ yukarıda — trend sağlam. Yaz sezonu kapasitesi %94'e yakın, kataliz güçlü.",
        "liked": False,
    },
    {
        "id": "c5",
        "time": "08:20",
        "author": "Analysight AI",
        "avatar": "",
        "tag": "MAKRO",
        "tag_color": "yellow",
        "content": "Asya piyasaları Nikkei +0.4%, Hang Seng -0.2% ile kapandı. Çin'den gelen sanayi üretimi verisi beklentilerin altında — küresel büyüme kaygıları sınırlı da olsa devam ediyor.",
        "liked": False,
    },
]


def get_briefing() -> dict:
    return {**DAILY_BRIEFING, "generated_at": datetime.now().isoformat()}


def get_commentary() -> list[dict]:
    return COMMENTARY_FEED


def get_market_snapshot() -> dict:
    """Terminal için anlık piyasa özeti."""
    return {
        "generated_at": datetime.now().isoformat(),
        "overall_sentiment": "temkinli-pozitif",
        "active_themes": [
            "Fed faiz kararı beklentisi",
            "AI chip / veri merkezi talebi",
            "Türkiye savunma sektörü momentumu",
            "BTC ETF kurumsal girişleri",
        ],
        "risk_factors": [
            "ABD enflasyon yapışkanlığı",
            "TCMB politika belirsizliği",
            "Küresel büyüme yavaşlaması",
            "Jeopolitik gerilim (Orta Doğu)",
        ],
        "opportunity_flags": [
            {"symbol": "ASELS", "type": "momentum", "detail": "52 hafta zirvesi kırıldı"},
            {"symbol": "NVDA",  "type": "earnings",  "detail": "Bu hafta kazanç — beklenti yüksek"},
            {"symbol": "BTC",   "type": "breakout",  "detail": "105K direnç test ediliyor"},
        ],
    }
