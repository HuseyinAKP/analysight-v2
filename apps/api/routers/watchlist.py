"""
Watchlist Feed Router
GET /api/watchlist/feed?symbols=THYAO,GARAN,AAPL
  → Kişisel hisse akışı: fiyat hareketleri, teknik sinyaller, haberler
"""
from __future__ import annotations
import os
from typing import Optional
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
import random

from services.real_data import get_ohlcv, get_symbol_info, SYMBOL_META
from services.technical_analysis import build_indicators

router = APIRouter()


def _get_feed_for_symbol(symbol: str) -> list[dict]:
    """Bir sembol için feed olayları üret."""
    items = []
    sym = symbol.upper()
    now = datetime.now()

    try:
        info = get_symbol_info(sym)
        df   = get_ohlcv(sym, days=5)
        ind  = build_indicators(df) if df is not None and not df.empty else None
    except Exception:
        return []

    if not info:
        return []

    price      = info.get("price", 0)
    change_pct = info.get("change_pct", 0)
    name       = info.get("name", sym)

    # ── 1. Günlük fiyat hareketi ────────────────────────────────────────────
    if abs(change_pct) >= 1.0:
        direction = "yükseliş" if change_pct > 0 else "düşüş"
        icon      = "📈" if change_pct > 0 else "📉"
        urgency   = abs(change_pct) >= 4
        items.append({
            "id":         f"{sym}_price_{now.strftime('%Y%m%d')}",
            "type":       "price_move",
            "symbol":     sym,
            "name":       name,
            "title":      f"{sym} güçlü {direction} gösteriyor",
            "body":       f"{name} bugün {'+' if change_pct > 0 else ''}{change_pct:.2f}% hareketle {price:,.2f} seviyesinde işlem görüyor.",
            "badge":      f"{'+' if change_pct > 0 else ''}{change_pct:.2f}%",
            "badge_color": "green" if change_pct > 0 else "red",
            "icon":       icon,
            "urgent":     urgency,
            "minutes_ago": random.randint(5, 60),
        })

    # ── 2. Teknik sinyal ────────────────────────────────────────────────────
    if ind:
        rsi   = ind.get("rsi", 50)
        score = ind.get("confluence", {}).get("score", 50)
        macd_bull = ind.get("macd", 0) > ind.get("macd_signal", 0)

        if rsi <= 30:
            items.append({
                "id":         f"{sym}_rsi_oversold_{now.strftime('%Y%m%d')}",
                "type":       "signal",
                "symbol":     sym,
                "name":       name,
                "title":      f"{sym} aşırı satım bölgesine girdi",
                "body":       f"RSI {rsi:.1f} seviyesiyle 30'un altına indi. Tarihsel olarak bu bölgeler toparlanma başlangıcı olabilir. Diğer göstergelerle teyit edin.",
                "badge":      f"RSI {rsi:.0f}",
                "badge_color": "green",
                "icon":       "🟢",
                "urgent":     True,
                "minutes_ago": random.randint(10, 90),
            })
        elif rsi >= 70:
            items.append({
                "id":         f"{sym}_rsi_overbought_{now.strftime('%Y%m%d')}",
                "type":       "signal",
                "symbol":     sym,
                "name":       name,
                "title":      f"{sym} aşırı alım bölgesinde",
                "body":       f"RSI {rsi:.1f} ile 70'in üstünde. Kısa vadeli kâr satışı riski artmış olabilir. Pozisyonunuzu gözden geçirin.",
                "badge":      f"RSI {rsi:.0f}",
                "badge_color": "red",
                "icon":       "🔴",
                "urgent":     False,
                "minutes_ago": random.randint(10, 90),
            })

        if score >= 70:
            items.append({
                "id":         f"{sym}_strong_signal_{now.strftime('%Y%m%d')}",
                "type":       "signal",
                "symbol":     sym,
                "name":       name,
                "title":      f"{sym} için güçlü yükseliş sinyali",
                "body":       f"Uyum skoru {score}/100. Birden fazla teknik gösterge yükseliş yönünde hizalanmış durumda.",
                "badge":      f"Skor {score}",
                "badge_color": "green",
                "icon":       "⚡",
                "urgent":     True,
                "minutes_ago": random.randint(15, 120),
            })
        elif score <= 30:
            items.append({
                "id":         f"{sym}_weak_signal_{now.strftime('%Y%m%d')}",
                "type":       "signal",
                "symbol":     sym,
                "name":       name,
                "title":      f"{sym} teknik görünümü zayıfladı",
                "body":       f"Uyum skoru {score}/100. Teknik göstergeler düşüş yönüne işaret ediyor. Dikkatli olunması önerilir.",
                "badge":      f"Skor {score}",
                "badge_color": "red",
                "icon":       "⚠️",
                "urgent":     False,
                "minutes_ago": random.randint(15, 120),
            })

    # ── 3. Haberler ─────────────────────────────────────────────────────────
    try:
        from routers.news import _generate_news_items
        all_news = _generate_news_items()
        # Sembole özel haberler
        sym_news = [n for n in all_news if sym in n.get("headline", "").upper() or
                    sym in n.get("source", "").upper()][:2]
        # Genel piyasa haberleri (az sayıda)
        market_news = [n for n in all_news
                       if n.get("category") in ("macro", "central_bank", "earnings")
                       and n not in sym_news][:1]

        for n in sym_news + market_news:
            sentiment  = n.get("sentiment", "neutral")
            badge_col  = "green" if sentiment == "positive" else "red" if sentiment == "negative" else "gray"
            items.append({
                "id":         f"{sym}_news_{n.get('timestamp','')[:10]}_{hash(n.get('headline',''))}",
                "type":       "news",
                "symbol":     sym,
                "name":       name,
                "title":      n.get("headline", ""),
                "body":       n.get("category_label", "Haber"),
                "badge":      n.get("impact", "Orta").capitalize(),
                "badge_color": badge_col,
                "icon":       "📰",
                "urgent":     n.get("impact") == "Yüksek",
                "source":     n.get("source", ""),
                "minutes_ago": n.get("hours_ago", 1) * 60,
            })
    except Exception:
        pass

    return items


def _claude_daily_brief(symbols: list[str], feed_items: list[dict]) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key or not symbols:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        signals = [f"- {i['symbol']}: {i['title']}" for i in feed_items
                   if i["type"] in ("signal", "price_move")][:8]
        signals_text = "\n".join(signals) if signals else "Önemli sinyal yok"

        prompt = (
            f"Takip edilen hisseler: {', '.join(symbols)}\n\n"
            f"Bugünkü önemli gelişmeler:\n{signals_text}\n\n"
            "Bu portföy için bugünkü günlük özeti 2-3 cümleyle Türkçe yaz. "
            "Hangi hisse dikkat çekiyor, genel tablo ne? Sade ve net yaz."
        )
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text
    except Exception:
        return None


def _template_brief(symbols: list[str], feed_items: list[dict]) -> str:
    urgent = [i for i in feed_items if i.get("urgent")]
    green  = [i for i in feed_items if i.get("badge_color") == "green" and i["type"] == "price_move"]
    red    = [i for i in feed_items if i.get("badge_color") == "red"   and i["type"] == "price_move"]

    if urgent:
        top = urgent[0]
        return (f"{top['symbol']} için dikkat çekici bir gelişme var: {top['title'].lower()}. "
                f"Takip listende {len(green)} hisse yükseliş, {len(red)} hisse düşüş gösteriyor. "
                f"Detaylar için aşağıdaki akışı incele.")
    return (f"Takip listende {len(symbols)} hisse var. "
            f"{len(green)} hisse pozitif, {len(red)} hisse negatif seyirde. "
            f"Önemli bir sinyal yok, piyasa sakin görünüyor.")


@router.get("/feed")
def get_watchlist_feed(symbols: str = Query(..., description="Virgülle ayrılmış semboller")):
    """Kişisel hisse akışı — watchlist'teki hisseler için birleşik feed."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]

    if not sym_list:
        return {"items": [], "daily_brief": "", "is_claude": False}

    all_items: list[dict] = []
    for sym in sym_list:
        all_items.extend(_get_feed_for_symbol(sym))

    # Karıştır ve minutes_ago'ya göre sırala (en yeni üste)
    all_items.sort(key=lambda x: x.get("minutes_ago", 999))

    # Acil olanları en üste taşı
    urgent   = [i for i in all_items if i.get("urgent")]
    normal   = [i for i in all_items if not i.get("urgent")]
    all_items = urgent + normal

    # Günlük brifing
    brief    = _claude_daily_brief(sym_list, all_items)
    is_claude = brief is not None
    if not brief:
        brief = _template_brief(sym_list, all_items)

    return {
        "items":       all_items[:40],
        "daily_brief": brief,
        "is_claude":   is_claude,
        "symbol_count": len(sym_list),
    }


@router.get("/metrics")
def get_watchlist_metrics(symbols: str = Query(...)):
    """Watchlist'teki her hisse için özet metrik."""
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:20]
    results  = []

    for sym in sym_list:
        try:
            info = get_symbol_info(sym)
            df   = get_ohlcv(sym, days=30)
            ind  = build_indicators(df) if df is not None and not df.empty else None
            meta = SYMBOL_META.get(sym, {})

            price      = info.get("price", 0) if info else 0
            change_pct = info.get("change_pct", 0) if info else 0
            rsi        = ind["rsi"] if ind else 50
            score      = ind["confluence"]["score"] if ind else 50
            signal     = ("Güçlü Al" if score >= 70 else "Al" if score >= 55
                          else "Nötr" if score >= 40 else "Sat")
            signal_color = ("green" if score >= 55 else "yellow" if score >= 40 else "red")

            results.append({
                "symbol":      sym,
                "name":        info.get("name", sym) if info else sym,
                "market":      meta.get("market", ""),
                "price":       round(price, 4),
                "change_pct":  round(change_pct, 2),
                "rsi":         round(rsi, 1),
                "score":       score,
                "signal":      signal,
                "signal_color": signal_color,
            })
        except Exception:
            results.append({"symbol": sym, "name": sym, "price": 0, "change_pct": 0,
                            "rsi": 50, "score": 50, "signal": "Nötr", "signal_color": "yellow"})

    return results
