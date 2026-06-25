"""
B2B Emtia Modülü — Hammadde fiyat takibi ve tedarik zinciri analizi.

Desteklenen emtialar: pamuk, enerji (ham petrol, doğalgaz), metaller,
tarım ürünleri. yfinance üzerinden vadeli kontrat verileri çekilir.
"""
from __future__ import annotations
import time
from fastapi import APIRouter, HTTPException
from services.real_data import get_ohlcv
from services.technical_analysis import build_indicators

router = APIRouter()

# ── Emtia sembol haritası ──────────────────────────────────────────────────────
# Yahoo Finance ticker → meta
COMMODITIES: dict[str, dict] = {
    # Pamuk
    "CT=F":   {"name": "Pamuk (ICE)",         "unit": "cent/lb",   "category": "Tekstil"},
    # Enerji
    "CL=F":   {"name": "Ham Petrol (WTI)",    "unit": "USD/varil", "category": "Enerji"},
    "NG=F":   {"name": "Doğal Gaz",           "unit": "USD/MMBtu", "category": "Enerji"},
    "BZ=F":   {"name": "Brent Petrol",        "unit": "USD/varil", "category": "Enerji"},
    # Metaller
    "GC=F":   {"name": "Altın",               "unit": "USD/oz",    "category": "Metal"},
    "SI=F":   {"name": "Gümüş",               "unit": "USD/oz",    "category": "Metal"},
    "HG=F":   {"name": "Bakır",               "unit": "USD/lb",    "category": "Metal"},
    "ALI=F":  {"name": "Alüminyum",           "unit": "USD/ton",   "category": "Metal"},
    # Tarım
    "ZW=F":   {"name": "Buğday (CBOT)",       "unit": "cent/bu",   "category": "Tarım"},
    "ZC=F":   {"name": "Mısır",               "unit": "cent/bu",   "category": "Tarım"},
    "ZS=F":   {"name": "Soya Fasulyesi",      "unit": "cent/bu",   "category": "Tarım"},
    "KC=F":   {"name": "Kahve (Arabica)",     "unit": "cent/lb",   "category": "Tarım"},
    "SB=F":   {"name": "Şeker",               "unit": "cent/lb",   "category": "Tarım"},
    # Kimyasal / Plastik proxy
    "RB=F":   {"name": "RBOB Benzin (petrokimya proxy)", "unit": "USD/galon", "category": "Kimyasal"},
}

_price_cache: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 300  # 5 dakika


def _get_price(ticker: str) -> dict:
    """Emtia için güncel fiyat ve teknik özet döner."""
    now = time.time()
    if ticker in _price_cache:
        ts, data = _price_cache[ticker]
        if now - ts < _CACHE_TTL:
            return data

    df = get_ohlcv(ticker, days=90)
    if df is None or df.empty:
        return {}

    ind = build_indicators(df)
    close = float(df["close"].iloc[-1])
    prev  = float(df["close"].iloc[-2]) if len(df) > 1 else close
    change_pct = ((close - prev) / prev * 100) if prev else 0

    # 30 günlük yüksek/düşük
    high_30 = float(df["close"].tail(30).max())
    low_30  = float(df["close"].tail(30).min())

    # Basit trend: fiyat EMA50'nin üstünde mi?
    ema50 = ind.get("ema50", 0)
    trend = "yükseliş" if close > ema50 else "düşüş"

    meta = COMMODITIES.get(ticker, {})
    result = {
        "ticker": ticker,
        "name": meta.get("name", ticker),
        "unit": meta.get("unit", ""),
        "category": meta.get("category", ""),
        "price": round(close, 4),
        "change_pct": round(change_pct, 2),
        "high_30d": round(high_30, 4),
        "low_30d": round(low_30, 4),
        "rsi": round(ind.get("rsi", 50), 1),
        "ema50": round(ema50, 4),
        "trend": trend,
        "volatility_pct": round(float(df["close"].pct_change().std()) * 100, 2),
    }
    _price_cache[ticker] = (now, result)
    return result


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/list")
def list_commodities():
    """Desteklenen emtia listesi."""
    return {
        "commodities": [
            {"ticker": k, **v} for k, v in COMMODITIES.items()
        ]
    }


@router.get("/prices")
def all_prices():
    """Tüm emtiaların güncel fiyat özeti."""
    results = []
    for ticker in COMMODITIES:
        data = _get_price(ticker)
        if data:
            results.append(data)
    # Kategoriye göre grupla
    by_category: dict[str, list] = {}
    for r in results:
        cat = r.get("category", "Diğer")
        by_category.setdefault(cat, []).append(r)
    return {"by_category": by_category, "total": len(results)}


@router.get("/{ticker}/detail")
def commodity_detail(ticker: str):
    """Tek emtia için detaylı analiz."""
    t = ticker.upper()
    if t not in COMMODITIES:
        raise HTTPException(status_code=404, detail=f"Emtia bulunamadı: {t}")
    data = _get_price(t)
    if not data:
        raise HTTPException(status_code=503, detail="Fiyat verisi alınamadı")
    return data


@router.post("/{ticker}/timing")
def procurement_timing(ticker: str, body: dict = {}):
    """
    Alım zamanlama önerisi — tedarik kararı için basit sinyal.

    Girdi (opsiyonel):
      - days_until_need: kaç gün sonra hammaddeye ihtiyaç var (varsayılan 30)
      - quantity_units: kaç birim alınacak (bilgi amaçlı)

    Çıktı:
      - signal: "al" | "bekle" | "acil_al"
      - reasoning: gerekçe
      - risk_level: "düşük" | "orta" | "yüksek"
    """
    t = ticker.upper()
    if t not in COMMODITIES:
        raise HTTPException(status_code=404, detail=f"Emtia bulunamadı: {t}")

    data = _get_price(t)
    if not data:
        raise HTTPException(status_code=503, detail="Fiyat verisi alınamadı")

    days_until_need = int(body.get("days_until_need", 30))
    rsi = data["rsi"]
    trend = data["trend"]
    vol = data["volatility_pct"]
    price = data["price"]
    low_30 = data["low_30d"]
    high_30 = data["high_30d"]

    # Fiyat yüzde konumu (30 günlük aralıkta)
    price_pct = (price - low_30) / (high_30 - low_30) * 100 if high_30 != low_30 else 50

    # Sinyal mantığı
    reasons = []
    urgency = 0

    if rsi <= 35:
        urgency += 2
        reasons.append(f"RSI {rsi:.0f} — aşırı satım bölgesinde, fiyat düşük")
    elif rsi >= 65:
        urgency -= 1
        reasons.append(f"RSI {rsi:.0f} — aşırı alım, fiyat yüksek")

    if price_pct < 25:
        urgency += 2
        reasons.append(f"Fiyat 30 günlük düşüğüne yakın (%{price_pct:.0f} aralıkta)")
    elif price_pct > 75:
        urgency -= 1
        reasons.append(f"Fiyat 30 günlük yükseyine yakın (%{price_pct:.0f} aralıkta)")

    if trend == "düşüş":
        urgency -= 1
        reasons.append("EMA50 altında — düşüş trendi devam edebilir")
    else:
        urgency += 1
        reasons.append("EMA50 üstünde — yükseliş trendi")

    if days_until_need <= 14:
        urgency += 3
        reasons.append(f"İhtiyaç {days_until_need} gün içinde — acil alım penceresi")

    # Karar
    if urgency >= 4:
        signal = "acil_al"
        signal_label = "Şimdi Al"
        risk_level = "düşük" if rsi < 50 else "orta"
    elif urgency >= 2:
        signal = "al"
        signal_label = "Alım Fırsatı"
        risk_level = "orta"
    elif urgency <= 0:
        signal = "bekle"
        signal_label = "Bekle"
        risk_level = "orta" if vol > 2 else "düşük"
    else:
        signal = "izle"
        signal_label = "İzle"
        risk_level = "orta"

    return {
        "ticker": t,
        "name": data["name"],
        "price": price,
        "signal": signal,
        "signal_label": signal_label,
        "risk_level": risk_level,
        "reasoning": reasons,
        "days_until_need": days_until_need,
        "volatility_pct": vol,
        "disclaimer": "Bu sinyal yatırım tavsiyesi değildir. Kendi analizinizle destekleyin.",
    }
