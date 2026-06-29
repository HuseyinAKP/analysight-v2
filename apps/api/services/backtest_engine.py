"""
Gerçek Ticaret Simülasyonu Backtest Engine

Strateji türleri:
  - ml_signal:   XGBoost prob > eşik → al, < eşik → sat
  - rsi:         RSI < buy → al, RSI > sell → sat
  - ma_cross:    Hızlı MA > Yavaş MA → al
  - bollinger:   Fiyat < alt bant → al, > üst bant → sat
  - composite:   Composite score > eşik → al

Her backtest için gerçekçi varsayımlar:
  - Komisyon: %0.1 her işlemde (BIST standart)
  - Spread:   %0.05 (bid/ask farkı)
  - Slippage: %0.05 (piyasa etkisi)
  - Pozisyon: sermayenin %100'ü (tek hisse)
  - Stop-loss: opsiyonel

Çıktı metrikleri:
  - Toplam getiri, Yıllık getiri (CAGR)
  - Sharpe Ratio, Sortino Ratio
  - Max Drawdown, Calmar Ratio
  - Win rate, Profit factor
  - İşlem sayısı, Ortalama pozisyon süresi
  - Equity curve (grafik için)
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from typing import Optional
import yfinance as yf

# Gerçekçi maliyet varsayımları
COMMISSION = 0.001   # %0.1
SPREAD     = 0.0005  # %0.05
SLIPPAGE   = 0.0005  # %0.05
TOTAL_COST = COMMISSION + SPREAD + SLIPPAGE  # giriş + çıkış = 2x


# ── Teknik gösterge yardımcıları ──────────────────────────────────────────────
def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()

def _rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l = (-d.clip(upper=0)).rolling(n).mean()
    return 100 - 100 / (1 + g / l.replace(0, np.nan))

def _bb(s: pd.Series, n: int = 20, k: float = 2.0):
    mid   = s.rolling(n).mean()
    std   = s.rolling(n).std()
    return mid - k * std, mid, mid + k * std


# ── Sinyal üreticiler ─────────────────────────────────────────────────────────
def _signals_rsi(df: pd.DataFrame, buy: float = 30, sell: float = 70, period: int = 14) -> pd.Series:
    rsi = _rsi(df["Close"], period)
    sig = pd.Series(0, index=df.index)
    in_pos = False
    for i in range(len(sig)):
        r = rsi.iloc[i]
        if np.isnan(r):
            continue
        if not in_pos and r < buy:
            sig.iloc[i] = 1
            in_pos = True
        elif in_pos and r > sell:
            sig.iloc[i] = -1
            in_pos = False
    return sig

def _signals_ma(df: pd.DataFrame, fast: int = 10, slow: int = 50) -> pd.Series:
    fast_ma = df["Close"].rolling(fast).mean()
    slow_ma = df["Close"].rolling(slow).mean()
    sig = pd.Series(0, index=df.index)
    prev = None
    for i in range(1, len(sig)):
        cur = 1 if fast_ma.iloc[i] > slow_ma.iloc[i] else -1
        if prev is not None and prev != cur:
            sig.iloc[i] = 1 if cur == 1 else -1
        prev = cur
    return sig

def _signals_bollinger(df: pd.DataFrame, period: int = 20, k: float = 2.0) -> pd.Series:
    lower, _, upper = _bb(df["Close"], period, k)
    sig = pd.Series(0, index=df.index)
    in_pos = False
    for i in range(len(sig)):
        c = df["Close"].iloc[i]
        if np.isnan(lower.iloc[i]):
            continue
        if not in_pos and c < lower.iloc[i]:
            sig.iloc[i] = 1
            in_pos = True
        elif in_pos and c > upper.iloc[i]:
            sig.iloc[i] = -1
            in_pos = False
    return sig

def _signals_ml(df: pd.DataFrame, threshold: float = 55.0) -> pd.Series:
    """XGBoost ML sinyali — model yoksa RSI'ya düş"""
    try:
        from services.ml_engine_v2 import predict as predict_v2, build_features
        sig = pd.Series(0, index=df.index)
        in_pos = False
        window = 250  # rolling window

        for i in range(window, len(df)):
            sub_df = df.iloc[:i+1].copy()
            result = predict_v2(sub_df)
            prob5 = result.get("prob5", 50.0)

            if not in_pos and prob5 >= threshold:
                sig.iloc[i] = 1
                in_pos = True
            elif in_pos and prob5 < (threshold - 5):  # hysteresis
                sig.iloc[i] = -1
                in_pos = False

        return sig
    except Exception:
        return _signals_rsi(df)  # fallback


# ── Ana simülasyon ────────────────────────────────────────────────────────────
def run_simulation(
    df: pd.DataFrame,
    signals: pd.Series,
    initial_capital: float = 100_000,
    stop_loss_pct: Optional[float] = None,   # ör: 0.05 = %5 stop
    take_profit_pct: Optional[float] = None, # ör: 0.10 = %10 hedef
) -> dict:
    """
    Sinyal serisine göre alım-satım simülasyonu yapar.
    Komisyon, spread, slippage dahildir.
    """
    close = df["Close"].astype(float)
    dates = df.index if not isinstance(df.index, pd.RangeIndex) else pd.to_datetime(df.get("Date", pd.RangeIndex(len(df))))

    capital      = initial_capital
    position     = 0.0    # hisse adedi
    entry_price  = 0.0
    entry_date   = None

    equity_curve = []
    trades       = []

    for i in range(len(close)):
        price = close.iloc[i]
        sig   = signals.iloc[i]
        date  = dates[i] if i < len(dates) else i

        # Stop-loss / take-profit kontrolü
        if position > 0 and entry_price > 0:
            current_ret = (price - entry_price) / entry_price
            if stop_loss_pct and current_ret <= -stop_loss_pct:
                sig = -1  # zorla çık
            if take_profit_pct and current_ret >= take_profit_pct:
                sig = -1  # zorla çık

        # Al
        if sig == 1 and position == 0:
            exec_price = price * (1 + TOTAL_COST)  # alış maliyeti
            position   = capital / exec_price
            entry_price = exec_price
            entry_date  = date
            capital    = 0.0

        # Sat
        elif sig == -1 and position > 0:
            exec_price = price * (1 - TOTAL_COST)  # satış getirisi
            proceeds   = position * exec_price
            pnl        = proceeds - position * entry_price
            pnl_pct    = pnl / (position * entry_price) * 100

            trades.append({
                "entry_date":  str(entry_date)[:10] if entry_date else "",
                "exit_date":   str(date)[:10],
                "entry_price": round(float(entry_price / (1 + TOTAL_COST)), 4),
                "exit_price":  round(float(exec_price  / (1 - TOTAL_COST)), 4),
                "pnl":         round(float(pnl), 2),
                "pnl_pct":     round(float(pnl_pct), 2),
                "hold_days":   (pd.Timestamp(str(date)) - pd.Timestamp(str(entry_date))).days if entry_date else 0,
            })

            capital    = proceeds
            position   = 0.0
            entry_price = 0.0
            entry_date  = None

        # Equity değeri
        current_value = capital + (position * price if position > 0 else 0)
        equity_curve.append({
            "date":  str(date)[:10],
            "value": round(float(current_value), 2),
        })

    # Açık pozisyonu kapat
    if position > 0:
        last_price = close.iloc[-1]
        exec_price = last_price * (1 - TOTAL_COST)
        proceeds   = position * exec_price
        pnl        = proceeds - position * entry_price
        capital    = proceeds
        trades.append({
            "entry_date":  str(entry_date)[:10] if entry_date else "",
            "exit_date":   "open",
            "entry_price": round(float(entry_price / (1 + TOTAL_COST)), 4),
            "exit_price":  round(float(last_price), 4),
            "pnl":         round(float(pnl), 2),
            "pnl_pct":     round(float(pnl / (position * entry_price) * 100), 2),
            "hold_days":   -1,
        })

    final_value = capital

    # ── Metrikler ─────────────────────────────────────────────────────────────
    equity_values = np.array([e["value"] for e in equity_curve], dtype=float)

    total_return  = (final_value / initial_capital - 1) * 100

    n_days = len(equity_curve)
    years  = n_days / 252
    cagr   = ((final_value / initial_capital) ** (1 / max(years, 0.1)) - 1) * 100

    # Drawdown
    peak = np.maximum.accumulate(equity_values)
    dd   = (equity_values - peak) / peak
    max_dd = abs(dd.min()) * 100

    # Günlük getiriler
    daily_ret = np.diff(equity_values) / equity_values[:-1]
    sharpe    = 0.0
    sortino   = 0.0
    if len(daily_ret) > 10 and daily_ret.std() > 0:
        sharpe  = (daily_ret.mean() / daily_ret.std()) * np.sqrt(252)
        neg_ret = daily_ret[daily_ret < 0]
        if len(neg_ret) > 0 and neg_ret.std() > 0:
            sortino = (daily_ret.mean() / neg_ret.std()) * np.sqrt(252)

    calmar = cagr / max(max_dd, 0.1)

    # Trade istatistikleri
    closed_trades = [t for t in trades if t["exit_date"] != "open"]
    wins   = [t for t in closed_trades if t["pnl"] > 0]
    losses = [t for t in closed_trades if t["pnl"] <= 0]
    win_rate = len(wins) / len(closed_trades) * 100 if closed_trades else 0

    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss   = abs(sum(t["pnl"] for t in losses))
    profit_factor = gross_profit / max(gross_loss, 0.01)

    avg_win  = gross_profit / len(wins)   if wins   else 0
    avg_loss = gross_loss   / len(losses) if losses else 0
    rr_ratio = avg_win / max(avg_loss, 0.01)

    avg_hold = np.mean([t["hold_days"] for t in closed_trades]) if closed_trades else 0

    # Buy & hold karşılaştırma
    bh_start = close.iloc[0]
    bh_end   = close.iloc[-1]
    bh_return = (bh_end / bh_start - 1) * 100

    return {
        # Özet
        "initial_capital": initial_capital,
        "final_value":     round(final_value, 2),
        "total_return":    round(total_return, 2),
        "cagr":            round(cagr, 2),
        "max_drawdown":    round(max_dd, 2),
        "sharpe":          round(sharpe, 3),
        "sortino":         round(sortino, 3),
        "calmar":          round(calmar, 3),
        # Trade
        "n_trades":        len(closed_trades),
        "win_rate":        round(win_rate, 1),
        "profit_factor":   round(profit_factor, 3),
        "avg_hold_days":   round(avg_hold, 1),
        "rr_ratio":        round(rr_ratio, 3),
        # Kıyaslama
        "buy_hold_return": round(bh_return, 2),
        "alpha":           round(total_return - bh_return, 2),
        # Detay
        "trades":          trades[-20:],   # son 20 işlem
        "equity_curve":    equity_curve[::max(1, len(equity_curve)//200)],  # max 200 nokta
    }


# ── Ana endpoint fonksiyonu ───────────────────────────────────────────────────
def run_backtest(
    symbol: str,
    strategy: str,
    start_date: str,
    end_date: str,
    initial_capital: float = 100_000,
    # RSI params
    rsi_buy: float = 30,
    rsi_sell: float = 70,
    rsi_period: int = 14,
    # MA params
    fast_period: int = 10,
    slow_period: int = 50,
    # BB params
    bb_period: int = 20,
    bb_std: float = 2.0,
    # ML params
    ml_threshold: float = 55.0,
    # Risk
    stop_loss_pct: Optional[float] = None,
    take_profit_pct: Optional[float] = None,
) -> dict:
    # Veri çek
    yf_sym = f"{symbol}.IS" if "." not in symbol and "-" not in symbol else symbol
    try:
        df = yf.download(yf_sym, start=start_date, end=end_date,
                         progress=False, auto_adjust=True)
        if df is None or len(df) < 20:
            raise ValueError("Yetersiz veri")
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df = df.reset_index()
    except Exception as e:
        return {"error": str(e)}

    # Sinyal üret
    if strategy == "rsi":
        signals = _signals_rsi(df, rsi_buy, rsi_sell, rsi_period)
    elif strategy == "ma_cross":
        signals = _signals_ma(df, fast_period, slow_period)
    elif strategy == "bollinger":
        signals = _signals_bollinger(df, bb_period, bb_std)
    elif strategy == "ml_signal":
        signals = _signals_ml(df, ml_threshold)
    else:
        return {"error": f"Bilinmeyen strateji: {strategy}"}

    result = run_simulation(df, signals, initial_capital, stop_loss_pct, take_profit_pct)
    result["symbol"]     = symbol
    result["strategy"]   = strategy
    result["start_date"] = start_date
    result["end_date"]   = end_date
    result["n_days"]     = len(df)
    return result
