"""
Yatırım Fonları modülü — TEFAS (Türkiye Elektronik Fon Alım Satım Platformu)
tefas-crawler kütüphanesi ile ücretsiz, gerçek zamanlı fon verileri.
"""
from __future__ import annotations
import time
from datetime import date, timedelta
from functools import lru_cache
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# Popüler TEFAS fonları — kod: kategori eşlemesi
POPULAR_FUNDS: list[dict] = [
    # Hisse senedi fonları
    {"code": "MAC",  "category": "hisse"},
    {"code": "GAF",  "category": "hisse"},
    {"code": "ZPT",  "category": "hisse"},
    {"code": "IPB",  "category": "hisse"},
    {"code": "IYD",  "category": "hisse"},
    {"code": "TYH",  "category": "hisse"},
    {"code": "TSF",  "category": "hisse"},
    # Yabancı hisse fonları
    {"code": "AFA",  "category": "yabanci_hisse"},
    {"code": "GYF",  "category": "yabanci_hisse"},
    {"code": "TI2",  "category": "yabanci_hisse"},
    {"code": "AFT",  "category": "yabanci_hisse"},
    # Altın / emtia fonları
    {"code": "IAF",  "category": "altin"},
    {"code": "GAG",  "category": "altin"},
    {"code": "AKA",  "category": "altin"},
    # Borç / tahvil fonları
    {"code": "TRT",  "category": "tahvil"},
    {"code": "AKO",  "category": "tahvil"},
    {"code": "GBF",  "category": "tahvil"},
    # Para piyasası fonları
    {"code": "PPF",  "category": "para_piyasasi"},
    {"code": "ACF",  "category": "para_piyasasi"},
    {"code": "IKB",  "category": "para_piyasasi"},
]

CATEGORY_TR = {
    "hisse":          "Hisse Senedi",
    "yabanci_hisse":  "Yabancı Hisse",
    "altin":          "Altın / Emtia",
    "tahvil":         "Tahvil / Bono",
    "para_piyasasi":  "Para Piyasası",
}

_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 1800  # 30 dakika


def _fetch_fund_data(code: str) -> dict | None:
    """Tek bir fon için TEFAS verisi çeker; 30g performans hesaplar."""
    now = time.time()
    if code in _cache:
        ts, val = _cache[code]
        if now - ts < _CACHE_TTL:
            return val

    try:
        from tefas import Crawler
        import warnings
        warnings.filterwarnings("ignore")

        c = Crawler()
        today = date.today()
        start_30d = today - timedelta(days=40)
        start_7d  = today - timedelta(days=10)
        start_1d  = today - timedelta(days=3)

        df30 = c.fetch(start=str(start_30d), end=str(today), name=code)
        if df30 is None or df30.empty:
            return None

        df7  = df30[df30["date"] >= str(start_7d)]
        df1  = df30[df30["date"] >= str(start_1d)]

        p_now = float(df30["price"].iloc[-1])
        p_30d = float(df30["price"].iloc[0])
        p_7d  = float(df7["price"].iloc[0])  if not df7.empty  else p_now
        p_1d  = float(df1["price"].iloc[-2]) if len(df1) >= 2  else p_now

        title = str(df30["title"].iloc[-1])
        cat_rank  = int(df30["category_rank"].iloc[-1])
        cat_total = int(df30["category_total"].iloc[-1])
        last_date = str(df30["date"].iloc[-1])

        result = {
            "code": code,
            "title": title,
            "price": round(p_now, 6),
            "last_date": last_date,
            "return_1d":  round((p_now - p_1d) / p_1d * 100, 2),
            "return_7d":  round((p_now - p_7d) / p_7d * 100, 2),
            "return_30d": round((p_now - p_30d) / p_30d * 100, 2),
            "category_rank":  cat_rank,
            "category_total": cat_total,
        }
        _cache[code] = (now, result)
        return result
    except Exception:
        return None


@router.get("/list")
def list_funds(category: str | None = Query(None)):
    """Popüler TEFAS fonlarını listeler (opsiyonel kategori filtresi)."""
    funds = POPULAR_FUNDS
    if category:
        funds = [f for f in funds if f["category"] == category]

    results = []
    for f in funds:
        data = _fetch_fund_data(f["code"])
        if data:
            results.append({
                **data,
                "category": f["category"],
                "category_tr": CATEGORY_TR.get(f["category"], f["category"]),
            })

    results.sort(key=lambda x: x.get("return_30d", 0), reverse=True)
    return {"funds": results, "count": len(results)}


@router.get("/categories")
def get_categories():
    return {"categories": [
        {"key": k, "label": v} for k, v in CATEGORY_TR.items()
    ]}


@router.get("/{code}")
def get_fund(code: str):
    """Belirli bir TEFAS fonunun detay verisini döner."""
    code = code.upper()
    data = _fetch_fund_data(code)
    if not data:
        raise HTTPException(status_code=404, detail=f"{code} fonu bulunamadı")

    cat = next((f["category"] for f in POPULAR_FUNDS if f["code"] == code), "diger")
    return {
        **data,
        "category": cat,
        "category_tr": CATEGORY_TR.get(cat, cat),
    }


@router.get("/{code}/history")
def get_fund_history(code: str, days: int = 90):
    """Fon fiyat geçmişini döner."""
    code = code.upper()
    try:
        from tefas import Crawler
        import warnings
        warnings.filterwarnings("ignore")
        c = Crawler()
        today = date.today()
        start = today - timedelta(days=days + 5)
        df = c.fetch(start=str(start), end=str(today), name=code)
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"{code} verisi bulunamadı")
        rows = [
            {"date": str(r["date"]), "price": round(float(r["price"]), 6)}
            for _, r in df.iterrows()
        ]
        return {"code": code, "history": rows}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
