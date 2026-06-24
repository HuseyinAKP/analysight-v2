"""
TradingView Webhook Köprüsü — Claude AI Destekli Versiyon.

TradingView alert → Analysight tam analiz → Claude API → zenginleştirilmiş mesaj.
In-memory alert feed with last 50 alerts stored.

TradingView alert message formatı (JSON):
{
  "symbol": "BIST:THYAO",
  "price": 285.5,
  "condition": "EMA20 crossover",
  "timeframe": "1D"
}

Env değişkenleri:
  ANTHROPIC_API_KEY — Claude API anahtarı (yoksa template-based fallback kullanılır)
"""
from __future__ import annotations
import os
import threading
from collections import deque
from datetime import datetime
from typing import Optional
from .real_data import get_ohlcv, get_symbol_info
from .technical_analysis import build_indicators
from .scenario_engine import build_scenarios
from .risk_engine import calc_risk
from .market_structure import calc_adx, detect_structure

# ── Claude API setup ──────────────────────────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
_anthropic_client = None

def _get_anthropic_client():
    global _anthropic_client
    if _anthropic_client is None and ANTHROPIC_API_KEY:
        try:
            import anthropic
            _anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        except Exception:
            pass
    return _anthropic_client


# ── In-memory alert feed ───────────────────────────────────────────────────────
_alert_lock = threading.Lock()
_alert_feed: deque = deque(maxlen=50)  # last 50 alerts


def get_alert_feed() -> list:
    with _alert_lock:
        return list(reversed(list(_alert_feed)))


def _store_alert(alert: dict) -> None:
    with _alert_lock:
        _alert_feed.append(alert)


def clean_symbol(raw: str) -> str:
    """'BIST:THYAO' → 'THYAO', 'NASDAQ:AAPL' → 'AAPL'"""
    return raw.split(":")[-1].upper().strip()


def _quality_label(rsi: float, macd_bull: bool, uncert: float, score: int) -> tuple[str, str]:
    """Returns (label, color)"""
    if score >= 65 and rsi < 60 and macd_bull:
        return "Güçlü Yükseliş", "green"
    elif score >= 50 and macd_bull:
        return "Pozitif", "yellow"
    elif rsi <= 30:
        return "Aşırı Satım", "green"
    elif rsi >= 70:
        return "Aşırı Alım", "red"
    elif uncert > 65:
        return "Belirsiz", "yellow"
    elif not macd_bull and score < 40:
        return "Zayıf", "red"
    else:
        return "Nötr", "yellow"


def _claude_analysis(
    symbol: str,
    name: str,
    tv_condition: str,
    tv_timeframe: str,
    curr_price: float,
    change_pct: float,
    rsi: float,
    macd_bull: bool,
    adx_val: float,
    adx_label: str,
    structure: str,
    score: int,
    bull_count: int,
    bear_count: int,
    uncert: float,
    bull_p: float,
    bear_p: float,
    stop_loss: float,
    target1: float,
    target2: float,
    rr_ratio: float,
    top_signals: list,
) -> Optional[str]:
    """
    Claude API'ye teknik veriyi göndererek Türkçe analiz narratifi üretir.
    ANTHROPIC_API_KEY yoksa None döner → template fallback kullanılır.
    """
    client = _get_anthropic_client()
    if client is None:
        return None

    signal_bullets = "\n".join(
        f"  - {s['label']}: {'YUKSELIS' if s['signal'] == 'bull' else 'DUSUS'} ({s['note']})"
        for s in top_signals
    ) or "  - Belirgin sinyal yok"

    prompt = f"""Sen Analysight'ın AI analist asistanısın. Bir TradingView alert geldi ve aşağıdaki teknik verilerle kısa, net bir Türkçe analiz yazman gerekiyor.

ALERT: {symbol} ({name}) için "{tv_condition}" koşulu tetiklendi. Zaman dilimi: {tv_timeframe or '1D'}

TEKNİK VERİLER:
- Güncel Fiyat: {curr_price:.4f} ({'+' if change_pct >= 0 else ''}{change_pct:.2f}%)
- RSI (14): {rsi:.1f}
- MACD: {'Yükseliş sinyali (MACD > Signal)' if macd_bull else 'Düşüş sinyali (MACD < Signal)'}
- ADX: {adx_val:.1f} ({adx_label})
- Piyasa Yapısı: {structure}
- Uyum Skoru: {score}/100 ({bull_count} yükseliş, {bear_count} düşüş sinyali)
- Belirsizlik İndeksi: {uncert:.0f}/100

ÖNEMLİ SİNYALLER:
{signal_bullets}

SENARYO BANDI (28 günlük):
- Boğa Senaryosu: {target2:.4f} (%{bull_p:.0f} olasılık)
- Ayı Senaryosu: {stop_loss:.4f} (%{bear_p:.0f} olasılık)

RİSK YÖNETİMİ:
- Stop-Loss: {stop_loss:.4f}
- Hedef 1: {target1:.4f} | Risk/Ödül: {rr_ratio:.1f}x
- Hedef 2: {target2:.4f}

Lütfen şu formatta KISA ve NET bir analiz yaz (max 4 cümle):
1. Alert koşulunu ve önemini değerlendir
2. En kritik teknik göstergeyi öne çıkar
3. İşlem tavsiyesi: stop ve hedef seviyeleriyle somut söyle
4. Tek cümleyle özet karar (Güçlü al / Al / Bekle / Sat)

ÖNEMLI: Yatırım tavsiyesi olmadığını belirt. Kısa, net, Türkçe yaz."""

    try:
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as e:
        return None


def enrich_tradingview_alert(payload: dict) -> dict:
    """
    TV alert payload'ını alır, Analysight analizini ekler ve
    Telegram/Email için hazır mesaj üretir.
    """
    raw_symbol = payload.get("symbol", "")
    symbol     = clean_symbol(raw_symbol)
    tv_condition  = payload.get("condition", "Bilinmeyen koşul")
    tv_timeframe  = payload.get("timeframe", "")
    tv_price      = payload.get("price")
    received_at   = datetime.now().isoformat()

    # Get real data
    df = get_ohlcv(symbol, days=180)
    info = get_symbol_info(symbol)

    if df is None or df.empty:
        error_result = {
            "status": "error",
            "symbol": symbol,
            "message": f"Veri alınamadı: {symbol}",
            "received_at": received_at,
        }
        _store_alert(error_result)
        return error_result

    ind = build_indicators(df)
    sc  = build_scenarios(df)
    rsk = calc_risk(df)
    adx_data = calc_adx(df)
    struct = detect_structure(df)

    rsi      = float(ind["rsi"])
    macd_bull = bool(ind["macd"] > ind["macd_signal"])
    uncert   = float(sc["uncertainty_index"])
    bull_p   = float(sc["scenarios"]["bull"]["probability"])
    bear_p   = float(sc["scenarios"]["bear"]["probability"])
    conf     = ind["confluence"]
    score    = conf["score"]
    curr_price = float(df["close"].iloc[-1])
    name     = info["name"] if info else symbol
    change_pct = float(info["change_pct"]) if info else 0.0

    quality, quality_color = _quality_label(rsi, macd_bull, uncert, score)

    # Top confluence signals
    top_signals = [s for s in conf["signals"] if s["signal"] != "neutral"][:3]
    signal_lines = [
        f"  • {s['label']}: {'↑' if s['signal'] == 'bull' else '↓'} {s['note']}"
        for s in top_signals
    ]

    # ── Claude AI Analizi ─────────────────────────────────────────────────────
    ai_narrative = _claude_analysis(
        symbol=symbol, name=name,
        tv_condition=tv_condition, tv_timeframe=tv_timeframe,
        curr_price=curr_price, change_pct=change_pct,
        rsi=rsi, macd_bull=macd_bull,
        adx_val=float(adx_data["adx"]), adx_label=adx_data["label"],
        structure=struct["structure"],
        score=score, bull_count=conf["bull_count"], bear_count=conf["bear_count"],
        uncert=uncert, bull_p=bull_p, bear_p=bear_p,
        stop_loss=rsk["stop_loss"], target1=rsk["target1"], target2=rsk["target2"],
        rr_ratio=rsk["rr_ratio_t1"],
        top_signals=top_signals,
    )
    ai_powered = ai_narrative is not None

    # Telegram-ready message
    header_label = " *TradingView Alert — Claude AI Analizi*" if ai_powered else " *TradingView Alert — Analysight Analizi*"
    lines = [
        header_label,
        f"",
        f"*{symbol}* ({name}) | {tv_condition}",
        f" Zaman Dilimi: {tv_timeframe or 'Belirtilmemiş'}",
        f"",
        f" *Fiyat:* {curr_price:.4f}  ({'+' if change_pct >= 0 else ''}{change_pct:.2f}%)",
        f" *Sinyal Kalitesi:* {quality}",
        f" *Uyum Skoru:* {score}/100 ({conf['bull_count']}↑ {conf['bear_count']}↓)",
    ]

    # AI narrative block (if available)
    if ai_narrative:
        lines += [
            f"",
            f" *Claude AI Analizi:*",
            f"{ai_narrative}",
        ]

    lines += [
        f"",
        f" *Teknik Durum:*",
        f"• RSI (14): {rsi:.1f} {'️ Aşırı Alım' if rsi>70 else ' Aşırı Satım' if rsi<30 else ''}",
        f"• MACD: {' Yükseliş' if macd_bull else ' Düşüş'} sinyali",
        f"• ADX: {adx_data['adx']:.1f} — {adx_data['label']}",
        f"• Piyasa Yapısı: {struct['structure']}",
    ]
    if signal_lines:
        lines.append(f"• Uyum Sinyalleri:")
        lines.extend(signal_lines)

    lines += [
        f"",
        f" *Senaryo Bandı (28 gün):*",
        f"•  Boğa: {sc['scenarios']['bull']['target']:.4f} (%{bull_p:.0f} olasılık)",
        f"•  Baz:  {sc['scenarios']['base']['target']:.4f}",
        f"•  Ayı:  {sc['scenarios']['bear']['target']:.4f} (%{bear_p:.0f} olasılık)",
        f"• Belirsizlik: {uncert:.0f}/100",
        f"",
        f"️ *Risk Motoru:*",
        f"• Stop-Loss: {rsk['stop_loss']:.4f} ({rsk['stop_pct']:.1f}%)",
        f"• Hedef 1: {rsk['target1']:.4f} ({rsk['target1_pct']:.1f}%) | R/R {rsk['rr_ratio_t1']}x",
        f"• Hedef 2: {rsk['target2']:.4f} ({rsk['target2_pct']:.1f}%) | R/R {rsk['rr_ratio_t2']}x",
        f"",
        f"️ _Bu analiz yatırım tavsiyesi değildir._",
        f" Detay: analysight.app/symbol/{symbol}",
    ]

    telegram_message = "\n".join(lines)

    result = {
        "status": "ok",
        "symbol": symbol,
        "name": name,
        "received_at": received_at,
        "tv_condition": tv_condition,
        "tv_timeframe": tv_timeframe,
        "signal_quality": quality,
        "signal_quality_color": quality_color,
        "current_price": round(curr_price, 4),
        "change_pct": round(change_pct, 2),
        "analysis": {
            "confluence_score": score,
            "bull_count": conf["bull_count"],
            "bear_count": conf["bear_count"],
            "rsi": round(rsi, 1),
            "macd_bullish": macd_bull,
            "adx": round(float(adx_data["adx"]), 1),
            "adx_label": adx_data["label"],
            "structure": struct["structure"],
            "uncertainty": round(uncert, 1),
            "bull_probability": bull_p,
            "bear_probability": bear_p,
            "stop_loss": rsk["stop_loss"],
            "target1": rsk["target1"],
            "target2": rsk["target2"],
            "rr_ratio": rsk["rr_ratio_t1"],
            "top_signals": top_signals,
        },
        "ai_powered": ai_powered,
        "ai_narrative": ai_narrative,
        "telegram_message": telegram_message,
        "setup_instructions": {
            "step1": "TradingView → Alerts → Create Alert",
            "step2": "Webhook URL: https://your-domain.com/api/webhook/tradingview",
            "step3": 'Message: {"symbol": "{{ticker}}", "price": {{close}}, "condition": "My Alert", "timeframe": "{{interval}}"}',
            "step4": "Telegram bot token + chat_id ekleyin → otomatik mesaj gelir",
        },
    }

    # Store in feed
    _store_alert({
        "id": f"{symbol}-{datetime.now().strftime('%H%M%S')}",
        "symbol": symbol,
        "name": name,
        "received_at": received_at,
        "tv_condition": tv_condition,
        "tv_timeframe": tv_timeframe,
        "signal_quality": quality,
        "signal_quality_color": quality_color,
        "current_price": round(curr_price, 4),
        "change_pct": round(change_pct, 2),
        "confluence_score": score,
        "rsi": round(rsi, 1),
        "macd_bullish": macd_bull,
        "stop_loss": rsk["stop_loss"],
        "target1": rsk["target1"],
        "rr_ratio": rsk["rr_ratio_t1"],
        "ai_powered": ai_powered,
        "ai_narrative": ai_narrative,
    })

    return result
