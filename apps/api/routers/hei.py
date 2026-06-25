"""
HEI — Tarihsel Olay Zekası API

GET /api/hei/{symbol}/anomalies          → geçmiş anomali listesi
GET /api/hei/{symbol}/anomalies/{date}   → tek anomali tam bağlam
GET /api/hei/{symbol}/timeline           → grafik için özet zaman çizelgesi
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query

from services.anomaly_detector import detect_anomalies
from services.context_enricher import enrich_anomaly

router = APIRouter()


@router.get("/{symbol}/anomalies")
def list_anomalies(
    symbol: str,
    years: int = Query(default=5, ge=1, le=10),
    type_filter: str = Query(default="", description="flash_crash | surge | slow_trend"),
    min_magnitude: float = Query(default=3.0, description="Minimum mutlak hareket (%)"),
):
    """
    Sembolün geçmiş anomali listesi.
    Her anomali için tarih, büyüklük, tür ve kısa etiket döner.
    Bağlam (haberler) dahil değildir — hız için.
    """
    sym = symbol.upper()
    anomalies = detect_anomalies(sym, years=years)

    # Filtrele
    if type_filter:
        anomalies = [a for a in anomalies if a["anomaly_type"] == type_filter]
    anomalies = [a for a in anomalies if abs(a["magnitude"]) >= min_magnitude]

    # Büyüklüğe göre sırala
    anomalies_sorted = sorted(anomalies, key=lambda x: abs(x["magnitude"]), reverse=True)

    return {
        "symbol":  sym,
        "years":   years,
        "total":   len(anomalies),
        "anomalies": anomalies_sorted,
    }


@router.get("/{symbol}/anomalies/{date}")
def anomaly_detail(symbol: str, date: str):
    """
    Tek bir anomali için tam bağlam paketi.
    Tarih formatı: YYYY-MM-DD
    """
    sym = symbol.upper()
    anomalies = detect_anomalies(sym, years=10)

    # Tam tarih eşleşmesi veya en yakın tarih
    match = next((a for a in anomalies if a["date"] == date), None)
    if not match:
        # Yakın tarihte (±3 gün) anomali ara
        from datetime import datetime, timedelta
        try:
            target = datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Tarih formatı YYYY-MM-DD olmalı")

        best = None
        best_delta = 999
        for a in anomalies:
            try:
                d = datetime.strptime(a["date"], "%Y-%m-%d")
                delta = abs((d - target).days)
                if delta < best_delta:
                    best_delta = delta
                    best = a
            except Exception:
                continue

        if not best or best_delta > 7:
            raise HTTPException(status_code=404, detail=f"Bu tarihe yakın anomali bulunamadı: {date}")
        match = best

    # Bağlam zenginleştir
    context = enrich_anomaly(sym, match["date"], match["magnitude"])

    return {
        **match,
        "context": context,
    }


@router.get("/{symbol}/timeline")
def timeline(
    symbol: str,
    years: int = Query(default=3, ge=1, le=10),
    min_magnitude: float = Query(default=5.0),
):
    """
    Frontend grafik katmanı için hafif zaman çizelgesi.
    Her nokta için yalnızca date, magnitude, type, label döner.
    Bağlam dahil değil — grafik render performansı için.
    """
    sym = symbol.upper()
    anomalies = detect_anomalies(sym, years=years)
    filtered = [
        {
            "date":         a["date"],
            "magnitude":    a["magnitude"],
            "anomaly_type": a["anomaly_type"],
            "label":        a["label"],
            "volume_confirmed": a["volume_confirmed"],
        }
        for a in anomalies
        if abs(a["magnitude"]) >= min_magnitude
    ]
    return {
        "symbol":    sym,
        "years":     years,
        "points":    len(filtered),
        "timeline":  sorted(filtered, key=lambda x: x["date"]),
    }
