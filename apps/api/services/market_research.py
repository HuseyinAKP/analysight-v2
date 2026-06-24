"""
Market Researcher: Sektör performansı, makro göstergeler, piyasa özeti.
Bireysel yatırımcıya bağlam sağlar.
"""
from __future__ import annotations
from datetime import datetime

SECTOR_DATA = {
    "Havacılık": {
        "perf_1w": 2.4, "perf_1m": 8.1, "perf_3m": 14.2, "perf_ytd": 22.8,
        "pe_avg": 9.1, "outlook": "pozitif",
        "drivers": ["Yaz sezonu turizm patlıyor", "Yakıt hedge pozisyonları koruyor", "Kapasite büyümesi sürerken talep güçlü"],
        "risks": ["Jet yakıtı fiyat volatilitesi", "Döviz kuru baskısı", "Hava koşulları belirsizliği"],
    },
    "Bankacılık": {
        "perf_1w": -1.2, "perf_1m": 3.4, "perf_3m": -2.8, "perf_ytd": 11.4,
        "pe_avg": 5.4, "outlook": "nötr",
        "drivers": ["Kredi büyümesi yüksek seyrediyor", "Mevduat faiz oranları dengeleniyor"],
        "risks": ["TCMB faiz politikası belirsizliği", "Takipteki kredi artışı riski", "Kur volatilitesi sermaye yeterliliğini baskılıyor"],
    },
    "Çelik & Madencilik": {
        "perf_1w": -3.1, "perf_1m": -6.2, "perf_3m": -11.4, "perf_ytd": -8.2,
        "pe_avg": 7.2, "outlook": "negatif",
        "drivers": ["Türk inşaat sektörü talebi kısmi destek"],
        "risks": ["Çin çelik ihracatı baskısı", "İnşaat sektöründe yavaşlama", "Enerji maliyetleri yüksek"],
    },
    "Cam & Ambalaj": {
        "perf_1w": 1.8, "perf_1m": 5.2, "perf_3m": 9.8, "perf_ytd": 18.4,
        "pe_avg": 9.8, "outlook": "pozitif",
        "drivers": ["Avrupa ihracat talebinde toparlanma", "Enerji maliyeti düşüyor", "Ambalaj elektrifikasyonu talebi"],
        "risks": ["Avrupa sanayi yavaşlaması", "Ham madde maliyeti", "Döviz kuru"],
    },
    "Savunma & Teknoloji": {
        "perf_1w": 3.8, "perf_1m": 12.4, "perf_3m": 28.6, "perf_ytd": 44.2,
        "pe_avg": 16.4, "outlook": "güçlü pozitif",
        "drivers": ["Savunma bütçesi artışları", "İhracat siparişleri rekor", "Drone ve füze teknolojisi talebi", "NATO üyesi ülke siparişleri"],
        "risks": ["Tedarik zinciri kısıtları", "Nitelikli mühendis açığı"],
    },
    "Teknoloji": {
        "perf_1w": 1.2, "perf_1m": 6.8, "perf_3m": 18.4, "perf_ytd": 28.6,
        "pe_avg": 34.2, "outlook": "pozitif",
        "drivers": ["Yapay zeka yatırım dalgası", "Cloud harcamaları artıyor", "Kurumsal dijitalleşme"],
        "risks": ["Değerleme yüksekliği", "Resesyon riski harcamaları kısabilir", "Regülasyon baskısı"],
    },
    "Yarı İletken": {
        "perf_1w": 2.8, "perf_1m": 9.4, "perf_3m": 24.2, "perf_ytd": 38.8,
        "pe_avg": 42.8, "outlook": "güçlü pozitif",
        "drivers": ["AI chip talebi yapısal büyüme", "Veri merkezi capex patlaması", "Otomotiv elektrifikasyonu"],
        "risks": ["Çin kısıtlamaları", "Döngüsel düşüş riski", "Kapasite yatırımı gecikmesi"],
    },
}

MACRO_DATA = {
    "TR": {
        "country": "Türkiye",
        "inflation_pct": 38.2,
        "policy_rate_pct": 50.0,
        "gdp_growth_pct": 3.1,
        "unemployment_pct": 8.4,
        "current_account_deficit_bn": -4.2,
        "fx": {"USDTRY": 38.42, "EURTRY": 41.18},
        "key_events": [
            {"date": "2025-07-24", "event": "TCMB Para Politikası Kurulu Toplantısı", "impact": "yüksek"},
            {"date": "2025-07-31", "event": "Haziran Enflasyon Verisi (TÜİK)", "impact": "yüksek"},
            {"date": "2025-08-15", "event": "Q2 2025 GSYİH Büyüme Verisi", "impact": "orta"},
        ],
    },
    "US": {
        "country": "ABD",
        "inflation_pct": 3.1,
        "policy_rate_pct": 4.25,
        "gdp_growth_pct": 2.4,
        "unemployment_pct": 4.1,
        "current_account_deficit_bn": -220.0,
        "fx": {"DXY": 104.2},
        "key_events": [
            {"date": "2025-07-30", "event": "Fed FOMC Kararı", "impact": "yüksek"},
            {"date": "2025-08-01", "event": "Temmuz İstihdam Raporu (NFP)", "impact": "yüksek"},
            {"date": "2025-08-13", "event": "Temmuz Enflasyon (CPI)", "impact": "yüksek"},
        ],
    },
}

MARKET_INDICES = [
    {"name": "BIST 100", "value": 9_842.4, "change_pct": 0.84, "ytd_pct": 18.2, "market": "BIST"},
    {"name": "BIST 30",  "value": 10_214.8, "change_pct": 1.12, "ytd_pct": 21.4, "market": "BIST"},
    {"name": "S&P 500",  "value": 5_614.2, "change_pct": 0.42, "ytd_pct": 14.8, "market": "US"},
    {"name": "NASDAQ",   "value": 18_421.6, "change_pct": 0.68, "ytd_pct": 18.6, "market": "US"},
    {"name": "Dow Jones","value": 42_310.8, "change_pct": 0.24, "ytd_pct": 9.4, "market": "US"},
    {"name": "BTC/USD",  "value": 104_820.0, "change_pct": 2.14, "ytd_pct": 42.8, "market": "CRYPTO"},
    {"name": "ETH/USD",  "value": 3_842.6, "change_pct": 3.28, "ytd_pct": 28.4, "market": "CRYPTO"},
    {"name": "Altın (USD/oz)", "value": 3_284.2, "change_pct": -0.18, "ytd_pct": 22.8, "market": "EMtia"},
    {"name": "Brent Petrol", "value": 78.4, "change_pct": -0.84, "ytd_pct": -8.2, "market": "Emtia"},
]

FEAR_GREED = {
    "score": 62,
    "label": "Açgözlülük",
    "color": "#f59e0b",
    "components": {
        "momentum": 68,
        "strength": 71,
        "breadth": 58,
        "put_call": 54,
        "vix": 64,
        "safe_haven": 48,
        "junk_bond": 70,
    },
    "description": "Piyasalar açgözlülük bölgesinde seyrediyor. Yatırımcılar risk iştahıyla hareket ediyor ancak aşırı iyimserlik henüz görülmüyor.",
}

SMART_MONEY_FLOWS = [
    {"sector": "Savunma & Teknoloji", "flow": "güçlü giriş", "intensity": 88, "note": "Kurumsal alım yoğunluğu 3 haftadır artıyor"},
    {"sector": "Teknoloji (US)", "flow": "giriş", "intensity": 72, "note": "AI temalı ETF girişleri yüksek seyrediyor"},
    {"sector": "Çelik & Madencilik", "flow": "çıkış", "intensity": -64, "note": "Kurumsal satış baskısı devam ediyor"},
    {"sector": "Bankacılık", "flow": "nötr", "intensity": 12, "note": "Faiz kararı öncesi bekleme modunda"},
    {"sector": "Kripto", "flow": "güçlü giriş", "intensity": 84, "note": "BTC ETF girişleri rekor kırdı"},
    {"sector": "Enerji", "flow": "çıkış", "intensity": -38, "note": "Petrol fiyatı baskısı sektörü etkiliyor"},
]


def get_market_overview() -> dict:
    return {
        "indices": MARKET_INDICES,
        "fear_greed": FEAR_GREED,
        "smart_money": SMART_MONEY_FLOWS,
        "macro": MACRO_DATA,
        "generated_at": datetime.now().isoformat(),
    }


def get_sector_research(sector: str) -> dict | None:
    data = SECTOR_DATA.get(sector)
    if not data:
        return None
    return {"sector": sector, **data}


def get_all_sectors() -> list[dict]:
    return [{"sector": k, **v} for k, v in SECTOR_DATA.items()]
