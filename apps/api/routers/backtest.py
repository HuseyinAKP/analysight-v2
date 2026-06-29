from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str  # "ma_cross" | "rsi" | "bollinger" | "ml_signal"
    start_date: str
    end_date: str
    initial_capital: float = 100_000.0
    # RSI
    rsi_buy: float = 30.0
    rsi_sell: float = 70.0
    rsi_period: int = 14
    # MA
    fast_period: int = 10
    slow_period: int = 50
    # Bollinger
    bb_period: int = 20
    bb_std: float = 2.0
    # ML
    ml_threshold: float = 55.0
    # Risk
    stop_loss_pct: Optional[float] = None    # ör: 0.05
    take_profit_pct: Optional[float] = None  # ör: 0.10


@router.post("/api/backtest")
async def run_backtest_endpoint(req: BacktestRequest):
    try:
        from services.backtest_engine import run_backtest
        result = run_backtest(
            symbol=req.symbol,
            strategy=req.strategy,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
            rsi_buy=req.rsi_buy,
            rsi_sell=req.rsi_sell,
            rsi_period=req.rsi_period,
            fast_period=req.fast_period,
            slow_period=req.slow_period,
            bb_period=req.bb_period,
            bb_std=req.bb_std,
            ml_threshold=req.ml_threshold,
            stop_loss_pct=req.stop_loss_pct,
            take_profit_pct=req.take_profit_pct,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])

        # Frontend uyumluluğu için stats wrapper
        result["stats"] = {
            "total_return":  result.get("total_return"),
            "final_value":   result.get("final_value"),
            "sharpe_ratio":  result.get("sharpe"),
            "max_drawdown":  result.get("max_drawdown"),
            "win_rate":      result.get("win_rate"),
            "total_trades":  result.get("n_trades"),
            "cagr":          result.get("cagr"),
            "sortino":       result.get("sortino"),
            "calmar":        result.get("calmar"),
            "profit_factor": result.get("profit_factor"),
            "avg_hold_days": result.get("avg_hold_days"),
            "rr_ratio":      result.get("rr_ratio"),
            "alpha":         result.get("alpha"),
        }
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class WalkForwardRequest(BaseModel):
    symbol: str
    strategy: str
    start_date: str
    end_date: str
    initial_capital: float = 100_000.0
    n_splits: int = 5
    min_train_days: int = 252
    rsi_buy: float = 30.0
    rsi_sell: float = 70.0
    rsi_period: int = 14
    fast_period: int = 10
    slow_period: int = 50
    bb_period: int = 20
    bb_std: float = 2.0
    ml_threshold: float = 55.0
    stop_loss_pct: Optional[float] = None
    take_profit_pct: Optional[float] = None


@router.post("/api/backtest/walk-forward")
async def run_walk_forward_endpoint(req: WalkForwardRequest):
    try:
        from services.backtest_engine import run_walk_forward
        result = run_walk_forward(
            symbol=req.symbol,
            strategy=req.strategy,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
            n_splits=req.n_splits,
            min_train_days=req.min_train_days,
            rsi_buy=req.rsi_buy,
            rsi_sell=req.rsi_sell,
            rsi_period=req.rsi_period,
            fast_period=req.fast_period,
            slow_period=req.slow_period,
            bb_period=req.bb_period,
            bb_std=req.bb_std,
            ml_threshold=req.ml_threshold,
            stop_loss_pct=req.stop_loss_pct,
            take_profit_pct=req.take_profit_pct,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/backtest/strategies")
async def list_strategies():
    return {
        "strategies": [
            {"id": "rsi",       "name": "RSI Stratejisi",       "description": "RSI aşırı alım/satım sinyalleri"},
            {"id": "ma_cross",  "name": "MA Kesişimi",           "description": "Hızlı/yavaş hareketli ortalama kesişimi"},
            {"id": "bollinger", "name": "Bollinger Bantları",    "description": "Bant kırılımı sinyalleri"},
            {"id": "ml_signal", "name": "XGBoost ML Sinyali",   "description": "Makine öğrenmesi tahmin sinyali"},
        ]
    }
