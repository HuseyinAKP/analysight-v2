from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, date

router = APIRouter()


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str  # "ma_cross" | "rsi" | "bollinger"
    start_date: str  # YYYY-MM-DD
    end_date: str
    initial_capital: float = 10000.0
    fast_period: int = 10
    slow_period: int = 50
    rsi_period: int = 14
    rsi_buy: float = 30.0
    rsi_sell: float = 70.0
    bb_period: int = 20
    bb_std: float = 2.0


def _get_signals_ma(df: pd.DataFrame, fast: int, slow: int) -> pd.Series:
    fast_ma = df["Close"].rolling(fast).mean()
    slow_ma = df["Close"].rolling(slow).mean()
    signal = pd.Series(0, index=df.index)
    signal[fast_ma > slow_ma] = 1
    signal[fast_ma < slow_ma] = -1
    return signal


def _get_signals_rsi(df: pd.DataFrame, period: int, buy: float, sell: float) -> pd.Series:
    delta = df["Close"].diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    signal = pd.Series(0, index=df.index)
    signal[rsi < buy] = 1
    signal[rsi > sell] = -1
    return signal


def _get_signals_bollinger(df: pd.DataFrame, period: int, std: float) -> pd.Series:
    ma = df["Close"].rolling(period).mean()
    std_dev = df["Close"].rolling(period).std()
    upper = ma + std * std_dev
    lower = ma - std * std_dev
    signal = pd.Series(0, index=df.index)
    signal[df["Close"] < lower] = 1
    signal[df["Close"] > upper] = -1
    return signal


def _run_backtest(df: pd.DataFrame, signals: pd.Series, capital: float):
    position = 0
    cash = capital
    shares = 0.0
    trades = []
    equity = []

    for i, (idx, row) in enumerate(df.iterrows()):
        price = float(row["Close"])
        sig = int(signals.iloc[i])
        date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, "strftime") else str(idx)[:10]

        if sig == 1 and position == 0 and cash > price:
            shares = cash / price
            cash = 0.0
            position = 1
            trades.append({"date": date_str, "type": "BUY", "price": round(price, 2), "shares": round(shares, 4)})
        elif sig == -1 and position == 1:
            cash = shares * price
            trades.append({"date": date_str, "type": "SELL", "price": round(price, 2), "shares": round(shares, 4), "value": round(cash, 2)})
            shares = 0.0
            position = 0

        total = cash + shares * price
        equity.append({"date": date_str, "value": round(total, 2)})

    final_value = cash + shares * float(df["Close"].iloc[-1])
    return trades, equity, final_value


def _calc_stats(equity: list, trades: list, capital: float, final_value: float):
    values = [e["value"] for e in equity]
    returns = pd.Series(values).pct_change().dropna()

    total_return = (final_value - capital) / capital * 100
    sharpe = float(returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0.0

    peak = pd.Series(values).cummax()
    drawdown = (pd.Series(values) - peak) / peak * 100
    max_drawdown = float(drawdown.min())

    sell_trades = [t for t in trades if t["type"] == "SELL"]
    buy_map = {i: trades[i] for i in range(len(trades)) if trades[i]["type"] == "BUY"}

    wins = 0
    for i, t in enumerate(trades):
        if t["type"] == "SELL":
            buy_idx = next((j for j in range(i - 1, -1, -1) if trades[j]["type"] == "BUY"), None)
            if buy_idx is not None:
                if t["price"] > trades[buy_idx]["price"]:
                    wins += 1

    win_rate = (wins / len(sell_trades) * 100) if sell_trades else 0.0

    return {
        "total_return": round(total_return, 2),
        "final_value": round(final_value, 2),
        "sharpe_ratio": round(sharpe, 2),
        "max_drawdown": round(max_drawdown, 2),
        "win_rate": round(win_rate, 1),
        "total_trades": len(sell_trades),
    }


@router.post("/api/backtest")
async def run_backtest(req: BacktestRequest):
    try:
        ticker = yf.Ticker(req.symbol)
        df = ticker.history(start=req.start_date, end=req.end_date)
        if df.empty or len(df) < 30:
            raise HTTPException(status_code=400, detail="Yeterli fiyat verisi bulunamadı")
        df = df[["Close"]].dropna()

        if req.strategy == "ma_cross":
            signals = _get_signals_ma(df, req.fast_period, req.slow_period)
        elif req.strategy == "rsi":
            signals = _get_signals_rsi(df, req.rsi_period, req.rsi_buy, req.rsi_sell)
        elif req.strategy == "bollinger":
            signals = _get_signals_bollinger(df, req.bb_period, req.bb_std)
        else:
            raise HTTPException(status_code=400, detail="Geçersiz strateji")

        trades, equity, final_value = _run_backtest(df, signals, req.initial_capital)
        stats = _calc_stats(equity, trades, req.initial_capital, final_value)

        # Buy & Hold karşılaştırma
        bh_shares = req.initial_capital / float(df["Close"].iloc[0])
        bh_final = bh_shares * float(df["Close"].iloc[-1])
        bh_return = (bh_final - req.initial_capital) / req.initial_capital * 100

        return {
            "symbol": req.symbol.upper(),
            "strategy": req.strategy,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "initial_capital": req.initial_capital,
            "stats": stats,
            "buy_hold_return": round(bh_return, 2),
            "equity_curve": equity[::max(1, len(equity) // 200)],  # max 200 nokta
            "trades": trades[-50:],  # son 50 işlem
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
