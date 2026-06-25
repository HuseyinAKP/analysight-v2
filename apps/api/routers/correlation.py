from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import pandas as pd

router = APIRouter()


class CorrelationRequest(BaseModel):
    symbols: list[str]
    period: str = "1y"  # 1mo, 3mo, 6mo, 1y, 2y, 5y


@router.post("/api/correlation")
async def get_correlation(req: CorrelationRequest):
    if len(req.symbols) < 2:
        raise HTTPException(status_code=400, detail="En az 2 sembol girin")
    if len(req.symbols) > 15:
        raise HTTPException(status_code=400, detail="En fazla 15 sembol")

    symbols = [s.upper().strip() for s in req.symbols]

    try:
        data = yf.download(symbols, period=req.period, auto_adjust=True, progress=False)
        if data.empty:
            raise HTTPException(status_code=400, detail="Veri alınamadı")

        if len(symbols) == 1:
            prices = data["Close"].to_frame(symbols[0])
        else:
            prices = data["Close"] if "Close" in data.columns else data

        prices = prices.dropna(axis=1, thresh=int(len(prices) * 0.7))
        prices = prices.ffill().dropna()

        if prices.empty or len(prices.columns) < 2:
            raise HTTPException(status_code=400, detail="Yeterli veri bulunamadı")

        returns = prices.pct_change().dropna()
        corr = returns.corr().round(3)

        valid_symbols = list(corr.columns)
        matrix = []
        for s1 in valid_symbols:
            row = []
            for s2 in valid_symbols:
                row.append(float(corr.loc[s1, s2]))
            matrix.append(row)

        # Volatilite ve getiri bilgileri
        stats = {}
        for sym in valid_symbols:
            r = returns[sym]
            stats[sym] = {
                "annual_return": round(float(r.mean() * 252 * 100), 2),
                "annual_vol": round(float(r.std() * (252 ** 0.5) * 100), 2),
                "sharpe": round(float(r.mean() / r.std() * (252 ** 0.5)), 2) if r.std() > 0 else 0,
            }

        return {
            "symbols": valid_symbols,
            "matrix": matrix,
            "stats": stats,
            "period": req.period,
            "data_points": len(prices),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
