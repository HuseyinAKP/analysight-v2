from __future__ import annotations
from fastapi import APIRouter
from services.macro_data import get_macro_dashboard, get_yield_curve, get_us_macro, get_tr_macro

router = APIRouter()


@router.get("/macro/dashboard")
def macro_dashboard():
    """Bloomberg-style macro dashboard — yield curve, rates, inflation, TR macro."""
    return get_macro_dashboard()


@router.get("/macro/yield-curve")
def yield_curve():
    return get_yield_curve()


@router.get("/macro/us")
def us_macro():
    return get_us_macro()


@router.get("/macro/tr")
def tr_macro():
    return get_tr_macro()
