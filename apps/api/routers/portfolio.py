"""
D: Portföy Takibi — Backend

Kullanıcı Supabase'de oturum açtıktan sonra:
  POST /api/portfolio/positions          — pozisyon ekle
  GET  /api/portfolio/positions          — tüm pozisyonlar + anlık P&L
  DELETE /api/portfolio/positions/{id}   — pozisyon sil
  GET  /api/portfolio/summary            — toplam özet

Veri Supabase'de `portfolio_positions` tablosunda tutulur.
Auth: Supabase JWT — Authorization: Bearer <token>
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
import yfinance as yf

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


# ── Supabase yardımcıları ─────────────────────────────────────────────────────

def _supa_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

def _user_id_from_token(token: str) -> Optional[str]:
    """Supabase JWT'den user_id çıkar."""
    if not token or not SUPABASE_URL:
        return None
    import urllib.request, json
    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": os.getenv("SUPABASE_ANON_KEY", ""),
                "Authorization": f"Bearer {token}",
            }
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read())
            return data.get("id")
    except Exception:
        return None

def _supabase_get(path: str, params: str = "") -> list:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return []
    import urllib.request, json
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, headers=_supa_headers())
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read())
    except Exception:
        return []

def _supabase_post(path: str, body: dict) -> dict:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return {}
    import urllib.request, json
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, headers=_supa_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            result = json.loads(r.read())
            return result[0] if isinstance(result, list) and result else result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _supabase_delete(path: str, params: str) -> bool:
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return False
    import urllib.request
    url = f"{SUPABASE_URL}/rest/v1/{path}?{params}"
    req = urllib.request.Request(url, headers=_supa_headers(), method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status in (200, 204)
    except Exception:
        return False


# ── Fiyat önbelleği ──────────────────────────────────────────────────────────
import time
_price_cache: dict[str, tuple[float, float]] = {}  # sym → (ts, price)

def _get_price(symbol: str) -> Optional[float]:
    sym = symbol.upper()
    now = time.time()
    if sym in _price_cache:
        ts, px = _price_cache[sym]
        if now - ts < 120:   # 2 dk cache
            return px

    yf_sym = f"{sym}.IS" if "." not in sym and not sym.endswith("=F") and "-" not in sym else sym
    try:
        t = yf.Ticker(yf_sym)
        px = t.fast_info.get("last_price") or t.fast_info.get("regularMarketPrice")
        if px:
            _price_cache[sym] = (now, float(px))
            return float(px)
    except Exception:
        pass
    return None


# ── P&L hesaplama ─────────────────────────────────────────────────────────────
def _enrich_position(pos: dict) -> dict:
    symbol     = pos.get("symbol", "")
    quantity   = float(pos.get("quantity", 0))
    avg_price  = float(pos.get("avg_price", 0))
    currency   = pos.get("currency", "TRY")

    current_price = _get_price(symbol)
    if current_price is None:
        return {**pos, "current_price": None, "pnl": None, "pnl_pct": None, "current_value": None}

    cost_basis    = quantity * avg_price
    current_value = quantity * current_price
    pnl           = current_value - cost_basis
    pnl_pct       = ((current_price / avg_price) - 1) * 100 if avg_price > 0 else 0

    return {
        **pos,
        "current_price":  round(current_price, 4),
        "current_value":  round(current_value, 2),
        "cost_basis":     round(cost_basis, 2),
        "pnl":            round(pnl, 2),
        "pnl_pct":        round(pnl_pct, 2),
        "currency":       currency,
    }


# ── Models ────────────────────────────────────────────────────────────────────
class AddPositionRequest(BaseModel):
    symbol:     str
    quantity:   float
    avg_price:  float
    currency:   str = "TRY"
    note:       Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/positions")
def get_positions(authorization: Optional[str] = Header(None)):
    """Kullanıcının tüm pozisyonlarını + anlık P&L ile döndür."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = _user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")

    rows = _supabase_get(
        "portfolio_positions",
        f"user_id=eq.{user_id}&order=created_at.desc"
    )

    enriched = [_enrich_position(r) for r in rows]
    return {"positions": enriched, "count": len(enriched)}


@router.post("/positions")
def add_position(
    body: AddPositionRequest,
    authorization: Optional[str] = Header(None)
):
    """Yeni pozisyon ekle."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = _user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")

    sym = body.symbol.upper()
    current_price = _get_price(sym)

    row = _supabase_post("portfolio_positions", {
        "user_id":    user_id,
        "symbol":     sym,
        "quantity":   body.quantity,
        "avg_price":  body.avg_price,
        "currency":   body.currency,
        "note":       body.note or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return _enrich_position(row) if row else {"ok": True}


@router.delete("/positions/{position_id}")
def delete_position(
    position_id: str,
    authorization: Optional[str] = Header(None)
):
    """Pozisyon sil — sadece kendi pozisyonunu silebilir."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = _user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")

    ok = _supabase_delete(
        "portfolio_positions",
        f"id=eq.{position_id}&user_id=eq.{user_id}"
    )
    return {"deleted": ok}


@router.get("/summary")
def portfolio_summary(authorization: Optional[str] = Header(None)):
    """Portföy özeti: toplam değer, toplam P&L, dağılım."""
    token = (authorization or "").removeprefix("Bearer ").strip()
    user_id = _user_id_from_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor")

    rows = _supabase_get(
        "portfolio_positions",
        f"user_id=eq.{user_id}"
    )
    enriched = [_enrich_position(r) for r in rows]

    total_cost    = sum(p.get("cost_basis", 0)    or 0 for p in enriched)
    total_value   = sum(p.get("current_value", 0) or 0 for p in enriched)
    total_pnl     = total_value - total_cost
    total_pnl_pct = ((total_value / total_cost) - 1) * 100 if total_cost > 0 else 0

    # Sembol başına ağırlık
    allocation = []
    for p in enriched:
        cv = p.get("current_value") or p.get("cost_basis") or 0
        allocation.append({
            "symbol":  p["symbol"],
            "value":   round(cv, 2),
            "weight":  round(cv / total_value * 100, 1) if total_value > 0 else 0,
            "pnl_pct": p.get("pnl_pct"),
        })
    allocation.sort(key=lambda x: x["value"], reverse=True)

    return {
        "total_cost":     round(total_cost, 2),
        "total_value":    round(total_value, 2),
        "total_pnl":      round(total_pnl, 2),
        "total_pnl_pct":  round(total_pnl_pct, 2),
        "position_count": len(enriched),
        "allocation":     allocation,
    }
