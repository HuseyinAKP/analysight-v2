from __future__ import annotations
from fastapi import APIRouter, HTTPException
from services.real_data import get_symbol_info, search_symbols, list_symbols, KNOWN_SYMBOLS

router = APIRouter()


@router.get("/search")
def search_sym(q: str = ""):
    return search_symbols(q, limit=10)


@router.get("/")
def list_sym():
    return list_symbols()


@router.get("/{symbol}")
def get_sym(symbol: str):
    info = get_symbol_info(symbol.upper())
    if not info:
        raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
    return info
