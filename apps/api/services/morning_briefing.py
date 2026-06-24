"""
60-second AI morning briefing service.
Combines: macro data, top scanner results, news, yield curve, TR macro.
"""
from __future__ import annotations
from datetime import datetime
import random

from services.macro_data import get_yield_curve, get_tr_macro
from services.real_data import get_symbol_info
from services.technical_analysis import build_indicators
from services.real_data import get_ohlcv
from services.scenario_engine import build_scenarios
from services.news_service import get_all_news


def _signal_label(score: int) -> str:
    if score >= 65: return " Güçlü Yükseliş"
    if score >= 50: return " Hafif Pozitif"
    if score >= 35: return " Karışık"
    return " Zayıf"


def _rsi_comment(rsi: float) -> str:
    if rsi < 30: return "aşırı satım — dip sinyali"
    if rsi < 40: return "satım baskısı azalıyor"
    if rsi > 70: return "aşırı alım — dikkat"
    if rsi > 60: return "güçlü momentum"
    return "nötr bölge"


def build_morning_briefing() -> dict:
    now = datetime.now()
    day_tr = ["Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi","Pazar"][now.weekday()]
    date_str = f"{day_tr}, {now.strftime('%d %B %Y')}"

    # ── 1. Yield curve ─────────────────────────────────────────────────────────
    yc = get_yield_curve()
    spread = yc.get("spread_2_10")
    inverted = yc.get("inverted", False)

    macro_headline = (
        "️ ABD tahvil eğrisi ters — tarihsel olarak resesyon habercisi" if inverted
        else f"ABD getiri eğrisi normal (+{spread:.2f}% spread), risk iştahı korunuyor" if spread
        else "Makro görünüm stabil"
    )

    # ── 2. TR macro ────────────────────────────────────────────────────────────
    tr = get_tr_macro()
    tr_inds = tr.get("indicators", {})
    policy_rate = tr_inds.get("policy_rate", {}).get("value", 50.0)
    cpi_tr = tr_inds.get("cpi_tr", {}).get("value", 44.0)
    usd_try = tr_inds.get("usd_try", {}).get("value", 38.85)

    # ── 3. Top opportunities from scanner ─────────────────────────────────────
    WATCH = ["THYAO", "GARAN", "EREGL", "SISE", "ASELS", "AAPL", "MSFT", "NVDA", "BTC-USD", "ETH-USD"]
    opportunities = []
    market_changes = []

    for sym in WATCH:
        try:
            info = get_symbol_info(sym)
            if not info:
                continue
            df = get_ohlcv(sym, days=100)
            if df is None or df.empty:
                continue
            ind = build_indicators(df)
            conf = ind["confluence"]
            score = conf["score"]
            rsi = ind["rsi"]
            change = info["change_pct"]

            market_changes.append({"symbol": sym, "change": change, "price": info["price"], "currency": info["currency"]})

            if score >= 55 or rsi < 35 or rsi > 68:
                opportunities.append({
                    "symbol": sym,
                    "name": info["name"],
                    "price": info["price"],
                    "currency": info["currency"],
                    "change_pct": round(change, 2),
                    "score": score,
                    "signal": _signal_label(score),
                    "rsi": round(rsi, 1),
                    "rsi_comment": _rsi_comment(rsi),
                    "macd_bull": bool(ind["macd"] > ind["macd_signal"]),
                    "ema_trend": "above" if info["price"] > ind["ema200"] else "below",
                })
        except Exception:
            continue

    # Sort by score
    opportunities.sort(key=lambda x: x["score"], reverse=True)

    # ── 4. News highlights ─────────────────────────────────────────────────────
    news_data = get_all_news(limit=20)
    top_news = news_data["items"][:5]
    news_mood = news_data["stats"]["market_mood"]
    news_pos  = news_data["stats"]["positive_pct"]

    # ── 5. Market summary ─────────────────────────────────────────────────────
    gainers = sorted(market_changes, key=lambda x: x["change"], reverse=True)[:3]
    losers  = sorted(market_changes, key=lambda x: x["change"])[:3]

    avg_change = sum(x["change"] for x in market_changes) / max(len(market_changes), 1)
    market_tone = "yükseliş" if avg_change > 0.5 else ("düşüş" if avg_change < -0.5 else "yatay")
    market_emoji = "" if avg_change > 0.5 else ("" if avg_change < -0.5 else "")

    # ── 6. AI-generated narrative ──────────────────────────────────────────────
    top_opp = opportunities[0] if opportunities else None
    narrative_lines = [
        f"Bugün piyasalar genel olarak **{market_tone}** seyrediyor {market_emoji}.",
        f"Makro cephede: {macro_headline}.",
        f"Türkiye'de politika faizi %{policy_rate:.0f}, TÜFE yıllık %{cpi_tr:.1f} ile açıklanan verilerde görece {'gerileme' if cpi_tr < 50 else 'baskı'} var.",
        f"Haber akışı **{news_mood.lower()}** (%{news_pos} olumlu).",
    ]
    if top_opp:
        narrative_lines.append(
            f"En dikkat çekici fırsat: **{top_opp['symbol']}** — "
            f"uyum skoru {top_opp['score']}/100, RSI {top_opp['rsi']} ({top_opp['rsi_comment']})."
        )

    narrative = " ".join(narrative_lines)

    # ── 7. Key levels ──────────────────────────────────────────────────────────
    key_levels = {}
    for sym in ["THYAO", "AAPL", "BTC-USD"]:
        try:
            df = get_ohlcv(sym, days=60)
            if df is not None and not df.empty:
                closes = df["close"].values
                support    = round(float(min(closes[-20:])), 2)
                resistance = round(float(max(closes[-20:])), 2)
                key_levels[sym] = {"support": support, "resistance": resistance}
        except Exception:
            pass

    # ── 8. Action checklist ────────────────────────────────────────────────────
    checklist = []
    if inverted:
        checklist.append({"item": "Resesyon riskini portföyünde fiyatla — defansif hisseler öne çıkabilir", "priority": "high"})
    if opportunities:
        for opp in opportunities[:3]:
            if opp["rsi"] < 35:
                checklist.append({"item": f"{opp['symbol']} aşırı satım bölgesinde — destek seviyesini izle", "priority": "medium"})
            elif opp["score"] >= 65:
                checklist.append({"item": f"{opp['symbol']} güçlü sinyal — kırılım onayı bekle", "priority": "medium"})
    if not checklist:
        checklist.append({"item": "Belirgin fırsat yok — nakit pozisyon korumak mantıklı olabilir", "priority": "low"})

    return {
        "date": date_str,
        "generated_at": now.isoformat(),
        "narrative": narrative,
        "market_tone": market_tone,
        "market_emoji": market_emoji,
        "avg_change": round(avg_change, 2),
        "macro": {
            "headline": macro_headline,
            "yield_curve": yc,
            "policy_rate_tr": policy_rate,
            "cpi_tr": cpi_tr,
            "usd_try": usd_try,
        },
        "opportunities": opportunities[:5],
        "gainers": gainers,
        "losers": losers,
        "news_mood": news_mood,
        "top_news": top_news,
        "key_levels": key_levels,
        "checklist": checklist,
    }
