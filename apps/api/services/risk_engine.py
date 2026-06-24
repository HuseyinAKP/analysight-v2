"""Risk engine: dynamic stop-loss, targets, R/R ratio, position sizing."""
from __future__ import annotations
from typing import Optional
import numpy as np
import pandas as pd
from .technical_analysis import calc_atr


def calc_risk(
    df: pd.DataFrame,
    entry_price: Optional[float] = None,
    account_size: float = 100_000,
    risk_pct: float = 1.0,
) -> dict:
    current = float(df["close"].iloc[-1])
    entry = entry_price or current
    atr = float(calc_atr(df).iloc[-1])

    stop_loss = round(entry - atr * 1.5, 4)
    target1 = round(entry + atr * 2.0, 4)
    target2 = round(entry + atr * 3.5, 4)

    risk_per_share = entry - stop_loss
    reward1 = target1 - entry
    reward2 = target2 - entry

    rr1 = round(reward1 / risk_per_share, 2) if risk_per_share > 0 else 0
    rr2 = round(reward2 / risk_per_share, 2) if risk_per_share > 0 else 0

    max_risk_amount = account_size * (risk_pct / 100)
    position_size = int(max_risk_amount / risk_per_share) if risk_per_share > 0 else 0
    position_value = round(position_size * entry, 2)

    stop_pct = round((stop_loss - entry) / entry * 100, 2)
    target1_pct = round((target1 - entry) / entry * 100, 2)
    target2_pct = round((target2 - entry) / entry * 100, 2)

    return {
        "entry_price": round(entry, 4),
        "stop_loss": round(stop_loss, 4),
        "stop_pct": stop_pct,
        "target1": round(target1, 4),
        "target1_pct": target1_pct,
        "target2": round(target2, 4),
        "target2_pct": target2_pct,
        "rr_ratio_t1": rr1,
        "rr_ratio_t2": rr2,
        "atr": round(atr, 4),
        "position_sizing": {
            "account_size": account_size,
            "risk_pct": risk_pct,
            "max_risk_amount": round(max_risk_amount, 2),
            "shares": position_size,
            "position_value": position_value,
        },
    }


def calc_advanced_risk(
    df: pd.DataFrame,
    entry_price: Optional[float] = None,
    account_size: float = 100_000,
    risk_pct: float = 1.0,
    stop_method: str = "atr",
    manual_stop: Optional[float] = None,
    stop_pct_manual: Optional[float] = None,
    atr_multiplier: float = 1.5,
    target_rr: float = 2.0,
) -> dict:
    closes = df["close"].values
    current = float(closes[-1])
    entry = entry_price or current
    atr = float(calc_atr(df).iloc[-1])

    # ── Determine stop loss ───────────────────────────────────────────────────
    if stop_method == "manual" and manual_stop is not None:
        stop_loss = float(manual_stop)
        stop_method_label = "Manuel stop"
    elif stop_method == "pct" and stop_pct_manual is not None:
        stop_loss = entry * (1 - stop_pct_manual / 100)
        stop_method_label = f"%{stop_pct_manual:.1f} sabit stop"
    elif stop_method == "swing_low":
        # Lowest low in last 20 bars
        swing = float(np.min(df["low"].values[-20:])) if "low" in df.columns else entry - atr * 2
        stop_loss = swing * 0.995  # slight buffer below swing low
        stop_method_label = "Son 20 bar dip (salınım)"
    else:  # default ATR
        stop_loss = entry - atr * atr_multiplier
        stop_method_label = f"ATR × {atr_multiplier:.1f}"

    stop_loss = round(stop_loss, 4)
    risk_per_share = entry - stop_loss
    if risk_per_share <= 0:
        risk_per_share = atr * atr_multiplier  # fallback

    # ── Targets based on R/R ──────────────────────────────────────────────────
    target1 = round(entry + risk_per_share * target_rr, 4)
    target2 = round(entry + risk_per_share * target_rr * 1.75, 4)
    target3 = round(entry + risk_per_share * target_rr * 2.5, 4)

    # ── Position sizing ───────────────────────────────────────────────────────
    max_risk_amount = account_size * (risk_pct / 100)
    shares = int(max_risk_amount / risk_per_share) if risk_per_share > 0 else 0
    position_value = round(shares * entry, 2)
    position_pct_of_portfolio = round(position_value / account_size * 100, 2)

    # Max position rule: don't exceed 20% of portfolio
    max_position_value = account_size * 0.20
    if position_value > max_position_value:
        capped_shares = int(max_position_value / entry)
        position_capped = True
        cap_reason = "Portföyün %20'si aşıldı — pozisyon sınırlandırıldı"
    else:
        capped_shares = shares
        position_capped = False
        cap_reason = None

    # ── Kelly Criterion (simplified) ──────────────────────────────────────────
    # Assumes 55% win rate and target_rr R/R
    win_rate = 0.55
    kelly_pct = win_rate - (1 - win_rate) / target_rr
    kelly_pct = max(0, min(kelly_pct, 0.25))  # cap at 25%
    kelly_shares = int(account_size * kelly_pct / entry)

    # ── Breakeven analysis ────────────────────────────────────────────────────
    commission_est = 0.001  # 0.1% per trade (entry + exit)
    breakeven = round(entry * (1 + commission_est * 2), 4)

    # ── Risk scenarios ────────────────────────────────────────────────────────
    scenarios = []
    for rr_test in [1.0, 1.5, 2.0, 2.5, 3.0]:
        t = round(entry + risk_per_share * rr_test, 4)
        profit = round(shares * (t - entry), 2)
        scenarios.append({
            "rr": rr_test,
            "target": t,
            "target_pct": round((t - entry) / entry * 100, 2),
            "profit": profit,
            "net_profit": round(profit - max_risk_amount * 0.002, 2),
        })

    # ── Risk/reward rating ────────────────────────────────────────────────────
    if target_rr >= 3:
        rr_rating = "Mükemmel"
        rr_color = "green"
    elif target_rr >= 2:
        rr_rating = "İyi"
        rr_color = "blue"
    elif target_rr >= 1.5:
        rr_rating = "Kabul edilebilir"
        rr_color = "yellow"
    else:
        rr_rating = "Zayıf — bu trade'den kaçın"
        rr_color = "red"

    return {
        "entry_price": round(entry, 4),
        "current_price": round(current, 4),
        "atr": round(atr, 4),
        "stop_loss": stop_loss,
        "stop_pct": round((stop_loss - entry) / entry * 100, 2),
        "stop_method": stop_method,
        "stop_method_label": stop_method_label,
        "target1": target1,
        "target1_pct": round((target1 - entry) / entry * 100, 2),
        "target2": target2,
        "target2_pct": round((target2 - entry) / entry * 100, 2),
        "target3": target3,
        "target3_pct": round((target3 - entry) / entry * 100, 2),
        "rr_ratio": round(target_rr, 2),
        "rr_rating": rr_rating,
        "rr_color": rr_color,
        "risk_per_share": round(risk_per_share, 4),
        "position_sizing": {
            "account_size": account_size,
            "risk_pct": risk_pct,
            "max_risk_amount": round(max_risk_amount, 2),
            "shares": shares,
            "shares_capped": capped_shares,
            "position_capped": position_capped,
            "cap_reason": cap_reason,
            "position_value": position_value,
            "position_pct_of_portfolio": position_pct_of_portfolio,
            "kelly_pct": round(kelly_pct * 100, 1),
            "kelly_shares": kelly_shares,
        },
        "breakeven": breakeven,
        "scenarios": scenarios,
        "rules": _generate_rules(risk_per_share, entry, target_rr, position_pct_of_portfolio, risk_pct),
    }


def _generate_rules(risk_per_share: float, entry: float,
                    target_rr: float, position_pct: float, risk_pct: float) -> list:
    rules = []
    stop_pct = risk_per_share / entry * 100

    if risk_pct > 2:
        rules.append({"type": "warning", "text": f"Risk %{risk_pct:.1f} — Güvenli limit (%2) aşıldı. Pozisyonu küçült."})
    else:
        rules.append({"type": "ok", "text": f"Risk %{risk_pct:.1f} — Güvenli sınır içinde."})

    if target_rr < 1.5:
        rules.append({"type": "warning", "text": f"R/R oranı {target_rr:.1f}x — Minimum 1.5x önerilir."})
    elif target_rr >= 2:
        rules.append({"type": "ok", "text": f"R/R oranı {target_rr:.1f}x — İyi setup."})

    if position_pct > 20:
        rules.append({"type": "warning", "text": f"Pozisyon portföyün %{position_pct:.0f}'i — Tek pozisyon %20'yi aşmamalı."})
    else:
        rules.append({"type": "ok", "text": f"Pozisyon büyüklüğü %{position_pct:.1f} — Makul."})

    if stop_pct > 8:
        rules.append({"type": "warning", "text": f"Stop uzaklığı %{stop_pct:.1f} — Stop çok geniş, ATR çarpanını düşür."})

    return rules
