"""
Earnings Reviewer: Şirket kazanç verilerini analiz eder.
EPS, gelir, sürpriz yüzdesi, rehberlik ve analist tahminleri.
"""
from __future__ import annotations
from datetime import datetime, timedelta
import random

# Sabit seed — her çağrıda aynı veri gelsin
_RNG = random.Random(42)

EARNINGS_DB: dict[str, dict] = {
    "THYAO": {
        "company": "Türk Hava Yolları",
        "sector": "Havacılık",
        "currency": "TRY",
        "fiscal_year_end": "Aralık",
        "next_earnings_date": "2026-08-12",
        "quarters": [
            {"period": "Q1 2025", "date": "2025-05-08", "eps_actual": 18.4, "eps_estimate": 16.2, "revenue_actual": 142_800, "revenue_estimate": 138_000, "net_income": 21_400, "yoy_revenue_growth": 22.4, "yoy_eps_growth": 31.2, "beat": True},
            {"period": "Q4 2024", "date": "2025-02-12", "eps_actual": 14.7, "eps_estimate": 15.1, "revenue_actual": 128_600, "revenue_estimate": 127_200, "net_income": 17_100, "yoy_revenue_growth": 18.6, "yoy_eps_growth": 14.8, "beat": False},
            {"period": "Q3 2024", "date": "2024-11-07", "eps_actual": 22.1, "eps_estimate": 19.8, "revenue_actual": 158_300, "revenue_estimate": 151_000, "net_income": 25_700, "yoy_revenue_growth": 28.3, "yoy_eps_growth": 42.1, "beat": True},
            {"period": "Q2 2024", "date": "2024-08-09", "eps_actual": 20.3, "eps_estimate": 18.9, "revenue_actual": 151_200, "revenue_estimate": 148_500, "net_income": 23_600, "yoy_revenue_growth": 24.7, "yoy_eps_growth": 35.6, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 16.0, "next_quarter_eps_high": 19.5, "comment": "Yaz sezonu kapasitesi %94'e ulaşması bekleniyor. Yakıt maliyetleri baskı unsuru olmaya devam ediyor."},
        "analyst_ratings": {"buy": 12, "hold": 5, "sell": 2, "target_price": 312.0, "current_consensus": "Güçlü Al"},
        "key_metrics": {"pe_ratio": 8.2, "ev_ebitda": 5.1, "gross_margin_pct": 38.4, "operating_margin_pct": 22.1, "debt_to_equity": 1.4},
    },
    "GARAN": {
        "company": "Garanti BBVA",
        "sector": "Bankacılık",
        "currency": "TRY",
        "fiscal_year_end": "Aralık",
        "next_earnings_date": "2026-07-28",
        "quarters": [
            {"period": "Q1 2025", "date": "2025-04-30", "eps_actual": 6.82, "eps_estimate": 6.45, "revenue_actual": 89_200, "revenue_estimate": 86_000, "net_income": 28_600, "yoy_revenue_growth": 41.2, "yoy_eps_growth": 38.7, "beat": True},
            {"period": "Q4 2024", "date": "2025-01-29", "eps_actual": 5.91, "eps_estimate": 6.10, "revenue_actual": 79_400, "revenue_estimate": 80_100, "net_income": 24_800, "yoy_revenue_growth": 34.8, "yoy_eps_growth": 28.3, "beat": False},
            {"period": "Q3 2024", "date": "2024-10-30", "eps_actual": 7.14, "eps_estimate": 6.88, "revenue_actual": 84_700, "revenue_estimate": 82_200, "net_income": 29_900, "yoy_revenue_growth": 38.1, "yoy_eps_growth": 44.2, "beat": True},
            {"period": "Q2 2024", "date": "2024-07-31", "eps_actual": 6.43, "eps_estimate": 6.20, "revenue_actual": 77_800, "revenue_estimate": 76_500, "net_income": 26_900, "yoy_revenue_growth": 31.4, "yoy_eps_growth": 29.8, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 6.2, "next_quarter_eps_high": 7.4, "comment": "Faiz marjı baskısı devam edebilir. Kredi büyümesinin güçlü kalması bekleniyor."},
        "analyst_ratings": {"buy": 9, "hold": 7, "sell": 1, "target_price": 178.0, "current_consensus": "Al"},
        "key_metrics": {"pe_ratio": 5.8, "ev_ebitda": None, "gross_margin_pct": None, "operating_margin_pct": 42.3, "debt_to_equity": None},
    },
    "EREGL": {
        "company": "Ereğli Demir Çelik",
        "sector": "Çelik & Madencilik",
        "currency": "TRY",
        "fiscal_year_end": "Aralık",
        "next_earnings_date": "2026-08-05",
        "quarters": [
            {"period": "Q1 2025", "date": "2025-05-02", "eps_actual": 3.12, "eps_estimate": 3.45, "revenue_actual": 48_200, "revenue_estimate": 50_100, "net_income": 9_300, "yoy_revenue_growth": -8.4, "yoy_eps_growth": -18.2, "beat": False},
            {"period": "Q4 2024", "date": "2025-02-06", "eps_actual": 4.21, "eps_estimate": 4.10, "revenue_actual": 52_800, "revenue_estimate": 51_200, "net_income": 12_600, "yoy_revenue_growth": -2.1, "yoy_eps_growth": -4.8, "beat": True},
            {"period": "Q3 2024", "date": "2024-11-04", "eps_actual": 5.68, "eps_estimate": 5.20, "revenue_actual": 61_400, "revenue_estimate": 59_800, "net_income": 17_000, "yoy_revenue_growth": 8.7, "yoy_eps_growth": 12.4, "beat": True},
            {"period": "Q2 2024", "date": "2024-08-02", "eps_actual": 6.14, "eps_estimate": 5.90, "revenue_actual": 64_200, "revenue_estimate": 62_700, "net_income": 18_400, "yoy_revenue_growth": 14.2, "yoy_eps_growth": 18.8, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 3.0, "next_quarter_eps_high": 4.2, "comment": "Küresel çelik fiyatlarındaki baskı ve enerji maliyetleri kârlılığı olumsuz etkileyebilir."},
        "analyst_ratings": {"buy": 6, "hold": 8, "sell": 3, "target_price": 52.0, "current_consensus": "Nötr"},
        "key_metrics": {"pe_ratio": 7.4, "ev_ebitda": 4.8, "gross_margin_pct": 22.1, "operating_margin_pct": 18.3, "debt_to_equity": 0.6},
    },
    "SISE": {
        "company": "Türkiye Şişe ve Cam",
        "sector": "Cam & Ambalaj",
        "currency": "TRY",
        "fiscal_year_end": "Aralık",
        "next_earnings_date": "2026-08-14",
        "quarters": [
            {"period": "Q1 2025", "date": "2025-05-09", "eps_actual": 2.84, "eps_estimate": 2.70, "revenue_actual": 38_400, "revenue_estimate": 37_200, "net_income": 8_500, "yoy_revenue_growth": 16.2, "yoy_eps_growth": 21.4, "beat": True},
            {"period": "Q4 2024", "date": "2025-02-13", "eps_actual": 2.41, "eps_estimate": 2.50, "revenue_actual": 35_200, "revenue_estimate": 36_100, "net_income": 7_200, "yoy_revenue_growth": 12.8, "yoy_eps_growth": 8.6, "beat": False},
            {"period": "Q3 2024", "date": "2024-11-08", "eps_actual": 3.12, "eps_estimate": 2.95, "revenue_actual": 39_800, "revenue_estimate": 38_400, "net_income": 9_300, "yoy_revenue_growth": 19.4, "yoy_eps_growth": 26.1, "beat": True},
            {"period": "Q2 2024", "date": "2024-08-08", "eps_actual": 2.78, "eps_estimate": 2.62, "revenue_actual": 37_100, "revenue_estimate": 36_000, "net_income": 8_300, "yoy_revenue_growth": 17.1, "yoy_eps_growth": 18.7, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 2.6, "next_quarter_eps_high": 3.2, "comment": "Enerji maliyetlerinde normalleşme kârlılığı destekleyebilir. Avrupa cam talebi izleniyor."},
        "analyst_ratings": {"buy": 8, "hold": 5, "sell": 1, "target_price": 48.0, "current_consensus": "Al"},
        "key_metrics": {"pe_ratio": 9.1, "ev_ebitda": 6.2, "gross_margin_pct": 28.4, "operating_margin_pct": 20.8, "debt_to_equity": 0.9},
    },
    "ASELS": {
        "company": "Aselsan",
        "sector": "Savunma & Teknoloji",
        "currency": "TRY",
        "fiscal_year_end": "Aralık",
        "next_earnings_date": "2026-08-01",
        "quarters": [
            {"period": "Q1 2025", "date": "2025-05-06", "eps_actual": 4.12, "eps_estimate": 3.85, "revenue_actual": 22_100, "revenue_estimate": 20_800, "net_income": 6_800, "yoy_revenue_growth": 34.2, "yoy_eps_growth": 28.4, "beat": True},
            {"period": "Q4 2024", "date": "2025-02-05", "eps_actual": 3.78, "eps_estimate": 3.90, "revenue_actual": 20_400, "revenue_estimate": 21_200, "net_income": 6_200, "yoy_revenue_growth": 28.7, "yoy_eps_growth": 18.8, "beat": False},
            {"period": "Q3 2024", "date": "2024-11-05", "eps_actual": 4.54, "eps_estimate": 4.20, "revenue_actual": 23_800, "revenue_estimate": 22_400, "net_income": 7_500, "yoy_revenue_growth": 42.1, "yoy_eps_growth": 38.6, "beat": True},
            {"period": "Q2 2024", "date": "2024-08-06", "eps_actual": 3.91, "eps_estimate": 3.65, "revenue_actual": 21_200, "revenue_estimate": 20_100, "net_income": 6_400, "yoy_revenue_growth": 36.8, "yoy_eps_growth": 31.2, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 3.8, "next_quarter_eps_high": 4.6, "comment": "Savunma ihracat siparişleri güçlü seyrediyor. Yurt içi proje teslimatları hız kazanacak."},
        "analyst_ratings": {"buy": 14, "hold": 3, "sell": 0, "target_price": 88.0, "current_consensus": "Güçlü Al"},
        "key_metrics": {"pe_ratio": 14.2, "ev_ebitda": 9.8, "gross_margin_pct": 34.1, "operating_margin_pct": 28.6, "debt_to_equity": 0.3},
    },
    "AAPL": {
        "company": "Apple Inc.",
        "sector": "Teknoloji",
        "currency": "USD",
        "fiscal_year_end": "Eylül",
        "next_earnings_date": "2026-07-31",
        "quarters": [
            {"period": "Q2 FY2025", "date": "2025-05-01", "eps_actual": 1.65, "eps_estimate": 1.61, "revenue_actual": 95_360, "revenue_estimate": 94_200, "net_income": 24_780, "yoy_revenue_growth": 4.8, "yoy_eps_growth": 8.2, "beat": True},
            {"period": "Q1 FY2025", "date": "2025-01-30", "eps_actual": 2.40, "eps_estimate": 2.35, "revenue_actual": 124_300, "revenue_estimate": 123_700, "net_income": 36_330, "yoy_revenue_growth": 3.9, "yoy_eps_growth": 10.1, "beat": True},
            {"period": "Q4 FY2024", "date": "2024-10-31", "eps_actual": 1.64, "eps_estimate": 1.60, "revenue_actual": 94_930, "revenue_estimate": 94_500, "net_income": 14_736, "yoy_revenue_growth": 6.1, "yoy_eps_growth": 12.0, "beat": True},
            {"period": "Q3 FY2024", "date": "2024-08-01", "eps_actual": 1.40, "eps_estimate": 1.35, "revenue_actual": 85_777, "revenue_estimate": 84_600, "net_income": 21_448, "yoy_revenue_growth": 4.9, "yoy_eps_growth": 11.1, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 1.58, "next_quarter_eps_high": 1.72, "comment": "Services büyümesi güçlü devam ediyor. iPhone 17 lansman etkisi Q4'ta hissedilecek."},
        "analyst_ratings": {"buy": 34, "hold": 12, "sell": 3, "target_price": 245.0, "current_consensus": "Al"},
        "key_metrics": {"pe_ratio": 32.1, "ev_ebitda": 24.8, "gross_margin_pct": 46.2, "operating_margin_pct": 31.4, "debt_to_equity": 1.8},
    },
    "MSFT": {
        "company": "Microsoft Corp.",
        "sector": "Teknoloji",
        "currency": "USD",
        "fiscal_year_end": "Haziran",
        "next_earnings_date": "2026-07-29",
        "quarters": [
            {"period": "Q3 FY2025", "date": "2025-04-30", "eps_actual": 3.46, "eps_estimate": 3.22, "revenue_actual": 70_066, "revenue_estimate": 68_400, "net_income": 25_826, "yoy_revenue_growth": 13.3, "yoy_eps_growth": 18.1, "beat": True},
            {"period": "Q2 FY2025", "date": "2025-01-29", "eps_actual": 3.23, "eps_estimate": 3.11, "revenue_actual": 69_632, "revenue_estimate": 68_900, "net_income": 24_107, "yoy_revenue_growth": 12.3, "yoy_eps_growth": 10.2, "beat": True},
            {"period": "Q1 FY2025", "date": "2024-10-30", "eps_actual": 3.30, "eps_estimate": 3.10, "revenue_actual": 65_585, "revenue_estimate": 64_500, "net_income": 24_667, "yoy_revenue_growth": 16.0, "yoy_eps_growth": 10.7, "beat": True},
            {"period": "Q4 FY2024", "date": "2024-07-30", "eps_actual": 2.95, "eps_estimate": 2.94, "revenue_actual": 64_727, "revenue_estimate": 64_500, "net_income": 22_036, "yoy_revenue_growth": 15.2, "yoy_eps_growth": 9.7, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 3.10, "next_quarter_eps_high": 3.55, "comment": "Azure ve yapay zeka hizmetleri büyümesi %35+ seyrediyor. Copilot penetrasyonu hızlanıyor."},
        "analyst_ratings": {"buy": 45, "hold": 8, "sell": 1, "target_price": 510.0, "current_consensus": "Güçlü Al"},
        "key_metrics": {"pe_ratio": 36.4, "ev_ebitda": 28.1, "gross_margin_pct": 69.8, "operating_margin_pct": 44.6, "debt_to_equity": 0.4},
    },
    "NVDA": {
        "company": "NVIDIA Corp.",
        "sector": "Yarı İletken",
        "currency": "USD",
        "fiscal_year_end": "Ocak",
        "next_earnings_date": "2026-08-27",
        "quarters": [
            {"period": "Q1 FY2026", "date": "2025-05-28", "eps_actual": 0.96, "eps_estimate": 0.89, "revenue_actual": 44_062, "revenue_estimate": 43_300, "net_income": 18_775, "yoy_revenue_growth": 69.0, "yoy_eps_growth": 145.0, "beat": True},
            {"period": "Q4 FY2025", "date": "2025-02-26", "eps_actual": 0.89, "eps_estimate": 0.85, "revenue_actual": 39_331, "revenue_estimate": 38_200, "net_income": 22_091, "yoy_revenue_growth": 78.0, "yoy_eps_growth": 82.0, "beat": True},
            {"period": "Q3 FY2025", "date": "2024-11-20", "eps_actual": 0.81, "eps_estimate": 0.75, "revenue_actual": 35_082, "revenue_estimate": 33_200, "net_income": 19_309, "yoy_revenue_growth": 94.0, "yoy_eps_growth": 109.0, "beat": True},
            {"period": "Q2 FY2025", "date": "2024-08-28", "eps_actual": 0.68, "eps_estimate": 0.65, "revenue_actual": 30_040, "revenue_estimate": 28_700, "net_income": 16_599, "yoy_revenue_growth": 122.0, "yoy_eps_growth": 168.0, "beat": True},
        ],
        "guidance": {"next_quarter_eps_low": 0.92, "next_quarter_eps_high": 1.04, "comment": "Blackwell GPU talebi beklentilerin üzerinde. Veri merkezi geliri rekor kırmaya devam ediyor."},
        "analyst_ratings": {"buy": 52, "hold": 6, "sell": 1, "target_price": 180.0, "current_consensus": "Güçlü Al"},
        "key_metrics": {"pe_ratio": 48.2, "ev_ebitda": 38.4, "gross_margin_pct": 74.8, "operating_margin_pct": 61.1, "debt_to_equity": 0.4},
    },
}

# Crypto'nun earnings yok
for sym in ["BTC-USD", "ETH-USD"]:
    EARNINGS_DB[sym] = None  # type: ignore


def get_earnings(symbol: str) -> dict | None:
    """Sembol için kazanç verisini döner."""
    data = EARNINGS_DB.get(symbol.upper())
    if data is None:
        return None

    quarters = data["quarters"]

    # Surprise yüzdesi hesapla
    enriched_quarters = []
    for q in quarters:
        surprise_pct = ((q["eps_actual"] - q["eps_estimate"]) / abs(q["eps_estimate"])) * 100 if q["eps_estimate"] else 0
        rev_surprise_pct = ((q["revenue_actual"] - q["revenue_estimate"]) / abs(q["revenue_estimate"])) * 100 if q["revenue_estimate"] else 0
        enriched_quarters.append({
            **q,
            "eps_surprise_pct": round(surprise_pct, 2),
            "revenue_surprise_pct": round(rev_surprise_pct, 2),
        })

    # Beat streak
    beat_streak = 0
    for q in enriched_quarters:
        if q["beat"]:
            beat_streak += 1
        else:
            break

    avg_eps_surprise = sum(q["eps_surprise_pct"] for q in enriched_quarters) / len(enriched_quarters)
    avg_rev_surprise = sum(q["revenue_surprise_pct"] for q in enriched_quarters) / len(enriched_quarters)

    return {
        **data,
        "quarters": enriched_quarters,
        "summary": {
            "beat_streak": beat_streak,
            "total_quarters": len(enriched_quarters),
            "beats": sum(1 for q in enriched_quarters if q["beat"]),
            "avg_eps_surprise_pct": round(avg_eps_surprise, 2),
            "avg_rev_surprise_pct": round(avg_rev_surprise, 2),
            "consistency_label": (
                "Tutarlı Güçlü" if beat_streak >= 3 else
                "Karışık" if beat_streak == 0 else
                "Genel İtibarıyla Güçlü"
            ),
        },
    }


def get_earnings_calendar(days_ahead: int = 30) -> list[dict]:
    """Yaklaşan kazanç açıklamalarını listele."""
    today = datetime.now()
    result = []
    for symbol, data in EARNINGS_DB.items():
        if data is None:
            continue
        try:
            ed = datetime.strptime(data["next_earnings_date"], "%Y-%m-%d")
            delta = (ed - today).days
            if -7 <= delta <= days_ahead:
                result.append({
                    "symbol": symbol,
                    "company": data["company"],
                    "sector": data["sector"],
                    "date": data["next_earnings_date"],
                    "days_until": delta,
                    "currency": data["currency"],
                    "consensus": data["analyst_ratings"]["current_consensus"],
                    "target_price": data["analyst_ratings"]["target_price"],
                    "last_beat": data["quarters"][0]["beat"] if data["quarters"] else None,
                })
        except (ValueError, KeyError):
            continue
    return sorted(result, key=lambda x: x["days_until"])
