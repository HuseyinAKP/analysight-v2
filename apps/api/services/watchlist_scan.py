"""
Watchlist Tarama Komutu — Tüm izleme listesini tek komutla tara.
Her sembol için RSI/MACD/confluence analizi + AI yorumu üretir.
"""
from __future__ import annotations
from datetime import datetime

from services.real_data import get_symbol_info, get_ohlcv
from services.technical_analysis import build_indicators


WATCHLIST = [
    "THYAO", "GARAN", "EREGL", "SISE", "ASELS",
    "AAPL", "MSFT", "NVDA", "BTC-USD", "ETH-USD",
]


def _signal_label(score: int) -> str:
    if score >= 65: return "Güçlü Yükseliş"
    if score >= 50: return "Hafif Pozitif"
    if score >= 35: return "Karışık"
    return "Zayıf / Düşüş"


def _signal_color(score: int) -> str:
    if score >= 65: return "green"
    if score >= 50: return "yellow"
    if score >= 35: return "orange"
    return "red"


def _rsi_comment(rsi: float) -> str:
    if rsi < 30: return "Aşırı satım — dip sinyali olabilir"
    if rsi < 40: return "Satım baskısı azalıyor"
    if rsi > 70: return "Aşırı alım — dikkatli ol"
    if rsi > 60: return "Güçlü momentum"
    return "Nötr bölge"


def _generate_commentary(sym: str, score: int, rsi: float, macd_bull: bool,
                          ema_trend: str, change_pct: float) -> str:
    parts = []

    # Trend direction
    if ema_trend == "above":
        parts.append("fiyat EMA200 üzerinde — uzun vadeli trend pozitif")
    else:
        parts.append("fiyat EMA200 altında — trend henüz toparlanmadı")

    # MACD
    if macd_bull:
        parts.append("MACD sinyal çizgisini yukarı kesti")
    else:
        parts.append("MACD baskı altında")

    # RSI
    if rsi < 30:
        parts.append(f"RSI {rsi:.0f} — aşırı satım, toparlanma potansiyeli")
    elif rsi > 70:
        parts.append(f"RSI {rsi:.0f} — aşırı alım, dikkatli")
    else:
        parts.append(f"RSI {rsi:.0f} ({_rsi_comment(rsi).lower()})")

    # Confluence score summary
    if score >= 65:
        parts.append(f"güçlü uyum skoru ({score}/100) — birden fazla gösterge hizalı")
    elif score >= 50:
        parts.append(f"uyum skoru {score}/100 — sinyal oluşuyor")
    else:
        parts.append(f"uyum skoru {score}/100 — henüz net sinyal yok")

    return "; ".join(parts).capitalize() + "."


def scan_watchlist(symbols: list[str] | None = None) -> dict:
    universe = symbols or WATCHLIST
    results = []
    scanned_at = datetime.now().isoformat()
    errors = []

    for sym in universe:
        try:
            info = get_symbol_info(sym)
            if not info:
                errors.append(sym)
                continue
            df = get_ohlcv(sym, days=100)
            if df is None or df.empty:
                errors.append(sym)
                continue
            ind = build_indicators(df)
            conf = ind["confluence"]
            score = conf["score"]
            rsi = ind["rsi"]
            macd_bull = bool(ind["macd"] > ind["macd_signal"])
            ema_trend = "above" if info["price"] > ind["ema200"] else "below"
            change_pct = round(float(info["change_pct"]), 2)

            results.append({
                "symbol": sym,
                "name": info["name"],
                "price": info["price"],
                "currency": info["currency"],
                "change_pct": change_pct,
                "score": score,
                "signal": _signal_label(score),
                "signal_color": _signal_color(score),
                "rsi": round(rsi, 1),
                "rsi_comment": _rsi_comment(rsi),
                "macd_bull": macd_bull,
                "ema_trend": ema_trend,
                "bull_count": conf["bull_count"],
                "bear_count": conf["bear_count"],
                "neutral_count": conf["neutral_count"],
                "commentary": _generate_commentary(
                    sym, score, rsi, macd_bull, ema_trend, change_pct
                ),
            })
        except Exception as e:
            errors.append(sym)
            continue

    # Rank by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    # Summary stats
    avg_score = round(sum(r["score"] for r in results) / max(len(results), 1), 1)
    bullish_count = sum(1 for r in results if r["score"] >= 50)
    bearish_count = sum(1 for r in results if r["score"] < 35)

    market_mood = "yükseliş" if bullish_count > len(results) // 2 else \
                  ("düşüş" if bearish_count > len(results) // 2 else "karışık")

    top = results[0] if results else None

    return {
        "scanned_at": scanned_at,
        "total_scanned": len(results),
        "market_mood": market_mood,
        "avg_score": avg_score,
        "bullish_count": bullish_count,
        "bearish_count": bearish_count,
        "top_pick": top["symbol"] if top else None,
        "results": results,
        "errors": errors,
    }
