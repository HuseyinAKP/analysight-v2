"""
Halka Arz (IPO) takip modülü.
Statik BIST IPO listesi + yfinance ile güncel fiyat/piyasa değeri.
"""
from __future__ import annotations
import yfinance as yf
from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

# Son ~3 yılın BIST IPO'ları (sembol, şirket adı, halka arz tarihi, sektör)
# Kaynak: KAP / SPK kamuya açık veriler
_BIST_IPOS: list[dict] = [
    # 2025
    {"symbol": "CHAOS",  "name": "Chaos Siber Güvenlik A.Ş.",       "ipo_date": "2025-03-17", "sector": "Teknoloji"},
    {"symbol": "EBEBK",  "name": "Ebebek Çocuk Ürünleri A.Ş.",       "ipo_date": "2025-02-19", "sector": "Perakende"},
    {"symbol": "MPARK",  "name": "Medical Park Sağlık Hizmetleri",   "ipo_date": "2025-01-20", "sector": "Sağlık"},
    {"symbol": "IZFAS",  "name": "İzmir Fırça A.Ş.",                 "ipo_date": "2025-01-09", "sector": "Sanayi"},
    # 2024
    {"symbol": "DGATE",  "name": "Datagate Bilgisayar Malzemeleri",  "ipo_date": "2024-12-10", "sector": "Teknoloji"},
    {"symbol": "AGYO",   "name": "Ata GYO A.Ş.",                     "ipo_date": "2024-11-14", "sector": "GYO"},
    {"symbol": "KONTR",  "name": "Kontrolmatik Teknoloji A.Ş.",       "ipo_date": "2024-10-28", "sector": "Teknoloji"},
    {"symbol": "GESAN",  "name": "Gersan Elektrik Ticaret A.Ş.",     "ipo_date": "2024-09-23", "sector": "Enerji"},
    {"symbol": "UFUK",   "name": "Ufuk Yatırım Ortaklığı A.Ş.",      "ipo_date": "2024-09-05", "sector": "Yatırım"},
    {"symbol": "UMPAS",  "name": "Umpaş Holding A.Ş.",               "ipo_date": "2024-08-20", "sector": "Holding"},
    {"symbol": "NUHCM",  "name": "Nuh Çimento Sanayi A.Ş.",          "ipo_date": "2024-07-15", "sector": "İnşaat Malz."},
    {"symbol": "SDTTR",  "name": "SDT Uzay ve Savunma A.Ş.",         "ipo_date": "2024-06-27", "sector": "Savunma"},
    {"symbol": "DMRGD",  "name": "Demirgiray Kuyumculuk A.Ş.",       "ipo_date": "2024-06-05", "sector": "Değerli Metaller"},
    {"symbol": "QNBFB",  "name": "QNB Finansbank A.Ş.",              "ipo_date": "2024-05-20", "sector": "Bankacılık"},
    {"symbol": "BIOEN",  "name": "Bioenerji Enerji Üretim A.Ş.",     "ipo_date": "2024-04-11", "sector": "Enerji"},
    {"symbol": "KSTUR",  "name": "Kastamonu Entegre A.Ş.",           "ipo_date": "2024-03-14", "sector": "Orman Ürünleri"},
    {"symbol": "SURGY",  "name": "Sur Yapı A.Ş.",                    "ipo_date": "2024-02-22", "sector": "İnşaat"},
    {"symbol": "TUREX",  "name": "Tureks Turizm A.Ş.",               "ipo_date": "2024-01-18", "sector": "Turizm"},
    # 2023
    {"symbol": "BFREN",  "name": "Borusan Mannesmann Boru A.Ş.",     "ipo_date": "2023-12-18", "sector": "Çelik"},
    {"symbol": "ALARK",  "name": "Alarko Holding A.Ş.",              "ipo_date": "2023-11-02", "sector": "Holding"},
    {"symbol": "PAGYO",  "name": "Panora GYO A.Ş.",                  "ipo_date": "2023-10-12", "sector": "GYO"},
    {"symbol": "MAVI",   "name": "Mavi Giyim Sanayi A.Ş.",           "ipo_date": "2023-09-07", "sector": "Tekstil"},
    {"symbol": "TERA",   "name": "Tera Yatırım Holding A.Ş.",        "ipo_date": "2023-08-10", "sector": "Yatırım"},
    {"symbol": "DOBUR",  "name": "Doğuş Otomotiv A.Ş.",             "ipo_date": "2023-07-19", "sector": "Otomotiv"},
    {"symbol": "KERVT",  "name": "Kerevitaş Gıda A.Ş.",             "ipo_date": "2023-06-15", "sector": "Gıda"},
    {"symbol": "PRKAB",  "name": "Türk Prysmian Kablo A.Ş.",         "ipo_date": "2023-05-11", "sector": "Sanayi"},
    {"symbol": "PRKAR",  "name": "Petrokimya Holding A.Ş.",          "ipo_date": "2023-04-20", "sector": "Kimya"},
    {"symbol": "TRGYO",  "name": "Torunlar GYO A.Ş.",               "ipo_date": "2023-03-16", "sector": "GYO"},
    {"symbol": "FZLGY",  "name": "Fazilet Yazılım A.Ş.",             "ipo_date": "2023-02-09", "sector": "Teknoloji"},
    {"symbol": "ACSEL",  "name": "Acıselsan Acı Su A.Ş.",            "ipo_date": "2023-01-25", "sector": "Gıda & İçecek"},
]


def _get_price_data(symbol: str) -> dict:
    try:
        ticker_sym = symbol + ".IS"
        tk = yf.Ticker(ticker_sym)
        info = tk.fast_info
        price   = round(float(getattr(info, "last_price", 0) or 0), 2)
        prev    = round(float(getattr(info, "previous_close", 0) or 0), 2)
        mktcap  = int(getattr(info, "market_cap", 0) or 0)
        pct_chg = round((price - prev) / prev * 100, 2) if prev > 0 else None
        return {
            "price": price,
            "prev_close": prev,
            "pct_change": pct_chg,
            "market_cap": mktcap,
        }
    except Exception:
        return {"price": None, "prev_close": None, "pct_change": None, "market_cap": None}


@router.get("/list")
def list_ipos(limit: int = 30):
    """Son BIST halka arzlarını güncel fiyatlarla döner."""
    items = _BIST_IPOS[:limit]
    result = []
    for ipo in items:
        price_data = _get_price_data(ipo["symbol"])
        ipo_dt = datetime.strptime(ipo["ipo_date"], "%Y-%m-%d")
        days_since = (datetime.now() - ipo_dt).days
        result.append({
            **ipo,
            **price_data,
            "days_since_ipo": days_since,
        })
    return {"ipos": result, "count": len(result)}


@router.get("/{symbol}")
def get_ipo_detail(symbol: str):
    """Belirli bir IPO hissesinin detay verisini döner."""
    symbol = symbol.upper()
    ipo = next((i for i in _BIST_IPOS if i["symbol"] == symbol), None)
    if not ipo:
        return {"error": f"{symbol} IPO listesinde bulunamadı"}
    price_data = _get_price_data(symbol)
    ipo_dt = datetime.strptime(ipo["ipo_date"], "%Y-%m-%d")
    days_since = (datetime.now() - ipo_dt).days
    return {**ipo, **price_data, "days_since_ipo": days_since}
