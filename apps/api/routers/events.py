"""
Tarihsel Olay Zekası API

GET  /api/events/stats                  → DB istatistikleri
POST /api/events/build/{symbol}         → sembol için olay DB'si oluştur (arka planda)
GET  /api/events/{symbol}               → sembol olaylarını listele
POST /api/events/embed/{symbol}         → olayları vektörleştir (arka planda)
POST /api/events/forecast               → güncel haberlere göre tarihsel analoji tahmini
GET  /api/events/forecast/{symbol}      → sembolün son haberlerini analiz et
"""
from __future__ import annotations
import threading
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

_build_state: dict = {}   # symbol → {"running": bool, "result": ..., "error": ...}
_embed_state: dict = {}


# ── Yardımcılar ───────────────────────────────────────────────────────────────
def _build_task(symbol: str):
    _build_state[symbol] = {"running": True, "result": None, "error": None}
    try:
        from services.event_database import build_event_database
        result = build_event_database(symbol, verbose=True)
        _build_state[symbol]["result"] = result
    except Exception as e:
        _build_state[symbol]["error"] = str(e)
    finally:
        _build_state[symbol]["running"] = False


def _embed_task(symbol: str):
    _embed_state[symbol] = {"running": True, "result": None, "error": None}
    try:
        from services.event_similarity import embed_events
        result = embed_events(symbol=symbol, verbose=True)
        _embed_state[symbol]["result"] = result
    except Exception as e:
        _embed_state[symbol]["error"] = str(e)
    finally:
        _embed_state[symbol]["running"] = False


# ── Endpoint'ler ──────────────────────────────────────────────────────────────
@router.get("/stats")
def event_stats():
    try:
        from services.event_database import get_event_stats
        stats = get_event_stats()
        stats["build_states"] = {k: v["running"] for k, v in _build_state.items()}
        return stats
    except Exception as e:
        return {"error": str(e), "total_events": 0, "total_news": 0}


@router.post("/build/{symbol}")
def build_events(symbol: str, background_tasks: BackgroundTasks):
    """
    Sembol için geçmişten bugüne kırılım günlerini bul,
    GDELT'ten haberleri çek ve DB'ye kaydet (~5-10 dk).
    """
    sym = symbol.upper()
    if _build_state.get(sym, {}).get("running"):
        return {"status": "already_running", "symbol": sym}

    background_tasks.add_task(_build_task, sym)
    return {"status": "started", "symbol": sym,
            "message": f"{sym} için olay DB oluşturuluyor. /api/events/stats ile takip edin."}


@router.get("/build/{symbol}/status")
def build_status(symbol: str):
    sym = symbol.upper()
    state = _build_state.get(sym, {"running": False, "result": None, "error": None})
    return {"symbol": sym, **state}


@router.post("/embed/{symbol}")
def embed_symbol(symbol: str, background_tasks: BackgroundTasks):
    """Sembol olaylarını vektörleştir (önce /build çalışmış olmalı)."""
    sym = symbol.upper()
    if _embed_state.get(sym, {}).get("running"):
        return {"status": "already_running", "symbol": sym}

    background_tasks.add_task(_embed_task, sym)
    return {"status": "started", "symbol": sym,
            "message": "Embedding başladı. /api/events/stats ile takip edin."}


@router.get("/{symbol}")
def list_events(
    symbol: str,
    limit: int = 20,
    direction: Optional[str] = None,
):
    try:
        from services.event_database import get_events_for_symbol
        events = get_events_for_symbol(symbol.upper(), limit=limit, direction=direction)
        return {"symbol": symbol.upper(), "events": events, "count": len(events)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ForecastRequest(BaseModel):
    query: str            # güncel haber / olay metni
    symbol: Optional[str] = None
    top_k: int = 5


@router.post("/forecast")
def forecast_from_text(req: ForecastRequest):
    """
    Serbest metin → tarihsel analoji tahmini.

    Örnek:
      {"query": "Türkiye merkez bankası faiz artırdı, dolar/TL 30'u geçti",
       "symbol": "THYAO"}
    """
    try:
        from services.event_similarity import generate_forecast
        result = generate_forecast(
            query_text=req.query,
            symbol=req.symbol.upper() if req.symbol else None,
            top_k=req.top_k,
        )
        return result
    except RuntimeError as e:
        # sentence-transformers kurulu değil
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/forecast/{symbol}")
def forecast_from_latest_news(symbol: str, top_k: int = 5):
    """
    Sembolün RSS'den gelen son haberlerini alır ve
    tarihsel analoji tahmini yapar.
    """
    try:
        from services.rss_news import get_news_for_symbol
        from services.event_similarity import generate_forecast

        news_items = get_news_for_symbol(symbol.upper(), limit=10)
        if not news_items:
            raise HTTPException(status_code=404, detail="Bu sembol için güncel haber bulunamadı")

        # Haberleri birleştir
        combined = " | ".join(
            item.get("title", "") + " " + item.get("summary", "")
            for item in news_items[:5]
        )

        result = generate_forecast(
            query_text=combined,
            symbol=symbol.upper(),
            top_k=top_k,
        )
        result["news_used"] = [item.get("title", "") for item in news_items[:5]]
        return result

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
