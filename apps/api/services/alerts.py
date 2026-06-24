"""
Alarm sistemi: Koşul kombinasyonlarına dayalı gösterge alarmları.
Kullanıcı tanımlı alarmlar in-memory saklanır (DB entegrasyonuna hazır).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
import uuid

# In-memory store (Supabase/DB entegrasyonuna kadar)
_ALERTS: dict[str, dict] = {}


CONDITION_TYPES = {
    "rsi_below":       "RSI değeri altına düştü",
    "rsi_above":       "RSI değeri üstüne çıktı",
    "price_above":     "Fiyat seviyesini yukarı kırdı",
    "price_below":     "Fiyat seviyesini aşağı kırdı",
    "macd_crossover":  "MACD sinyal üstüne çıktı (boğa kesişimi)",
    "macd_crossunder": "MACD sinyal altına düştü (ayı kesişimi)",
    "uncertainty_above": "Belirsizlik endeksi eşiği aştı",
    "bull_prob_above":   "Boğa senaryosu olasılığı eşiği aştı",
    "rsi_and_macd":    "RSI koşulu VE MACD koşulu aynı anda",
}

NOTIFY_CHANNELS = ["in_app", "telegram", "email"]


def create_alert(
    symbol: str,
    condition_type: str,
    threshold: float,
    notify_channels: list[str],
    label: Optional[str] = None,
    user_id: str = "demo_user",
) -> dict:
    alert_id = str(uuid.uuid4())[:8]
    alert = {
        "id": alert_id,
        "user_id": user_id,
        "symbol": symbol.upper(),
        "condition_type": condition_type,
        "condition_label": CONDITION_TYPES.get(condition_type, condition_type),
        "threshold": threshold,
        "label": label or f"{symbol.upper()} — {CONDITION_TYPES.get(condition_type, condition_type)}",
        "notify_channels": notify_channels,
        "active": True,
        "triggered": False,
        "triggered_at": None,
        "created_at": datetime.now().isoformat(),
    }
    _ALERTS[alert_id] = alert
    return alert


def list_alerts(user_id: str = "demo_user") -> list[dict]:
    return [a for a in _ALERTS.values() if a["user_id"] == user_id]


def delete_alert(alert_id: str) -> bool:
    if alert_id in _ALERTS:
        del _ALERTS[alert_id]
        return True
    return False


def toggle_alert(alert_id: str) -> Optional[dict]:
    if alert_id in _ALERTS:
        _ALERTS[alert_id]["active"] = not _ALERTS[alert_id]["active"]
        return _ALERTS[alert_id]
    return None


def check_alerts(symbol: str, indicators: dict, scenarios: dict) -> list[dict]:
    """
    Verilen sembol için aktif alarmları kontrol eder.
    Tetiklenen alarmları döner.
    """
    triggered = []
    for alert in _ALERTS.values():
        if alert["symbol"] != symbol.upper() or not alert["active"] or alert["triggered"]:
            continue

        cond = alert["condition_type"]
        th   = alert["threshold"]
        fired = False

        rsi  = indicators.get("rsi", 50)
        macd = indicators.get("macd", 0)
        macd_sig = indicators.get("macd_signal", 0)
        uncertainty = scenarios.get("uncertainty_index", 50)
        bull_prob   = scenarios.get("scenarios", {}).get("bull", {}).get("probability", 30)
        # price from close series
        closes = indicators.get("series", {}).get("close", [])
        price = closes[-1] if closes else 0

        if cond == "rsi_below" and rsi < th:         fired = True
        elif cond == "rsi_above" and rsi > th:       fired = True
        elif cond == "price_above" and price > th:   fired = True
        elif cond == "price_below" and price < th:   fired = True
        elif cond == "macd_crossover" and macd > macd_sig: fired = True
        elif cond == "macd_crossunder" and macd < macd_sig: fired = True
        elif cond == "uncertainty_above" and uncertainty > th: fired = True
        elif cond == "bull_prob_above" and bull_prob > th: fired = True

        if fired:
            _ALERTS[alert["id"]]["triggered"] = True
            _ALERTS[alert["id"]]["triggered_at"] = datetime.now().isoformat()
            triggered.append({**alert, "current_value": rsi if "rsi" in cond else price})

    return triggered
