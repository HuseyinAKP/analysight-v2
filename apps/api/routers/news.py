from __future__ import annotations
import os
from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from services.news_service import get_symbol_news, get_all_news, NEWS_SOURCES

router = APIRouter()


@router.get("/news")
def all_news(
    source: Optional[str] = Query(None),
    sentiment: Optional[str] = Query(None),
    limit: int = Query(40, le=100),
):
    return get_all_news(limit=limit, source_filter=source, sentiment_filter=sentiment)


@router.get("/news/sources")
def list_sources():
    return NEWS_SOURCES


@router.get("/news/rss")
def rss_news(limit: int = Query(30, le=80)):
    """Gerçek zamanlı RSS haberleri — Bloomberg HT, Hürriyet, AA, Investing TR."""
    try:
        from services.rss_news import get_latest_news
        return get_latest_news(limit=limit)
    except Exception as e:
        return {"error": str(e), "items": []}


@router.get("/news/rss/{symbol}")
def rss_news_symbol(symbol: str, limit: int = Query(10, le=30)):
    """Belirli bir sembolle ilgili RSS haberleri."""
    try:
        from services.rss_news import get_news_for_symbol
        return get_news_for_symbol(symbol.upper(), limit=limit)
    except Exception as e:
        return {"error": str(e), "items": []}


class NewsAnalyzeRequest(BaseModel):
    headline: str
    summary: Optional[str] = None
    sentiment: Optional[str] = None
    category: Optional[str] = None
    symbol: Optional[str] = None
    rsi: Optional[float] = None
    macd_bull: Optional[bool] = None
    price_change_pct: Optional[float] = None


def _get_anthropic_client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception:
        return None


def _news_template_analysis(req: NewsAnalyzeRequest) -> str:
    """Rich template fallback for news analysis when Claude not available."""
    sentiment_map = {"positive": "olumlu", "negative": "olumsuz", "neutral": "nötr"}
    sent = sentiment_map.get(req.sentiment or "neutral", "nötr")

    lines = []

    # Haber etkisi
    lines.append(f"**Haber Etkisi: {sent.upper()}**")
    lines.append("")

    if req.sentiment == "positive":
        lines.append("Bu haber genel olarak olumlu bir sinyal taşıyor. Yatırımcılar arasında alım iştahı artabilir.")
    elif req.sentiment == "negative":
        lines.append("Bu haber olumsuz bir gelişmeye işaret ediyor. Kısa vadede satış baskısı oluşabilir.")
    else:
        lines.append("Bu haber piyasa üzerinde beklenen etkisi net olmayan, nötr bir içerik taşıyor.")

    lines.append("")

    # Teknik bağlam (varsa)
    if req.rsi is not None:
        lines.append("**Teknik Görünüm ile Birlikte Değerlendirme**")
        if req.rsi < 30:
            lines.append(f"RSI {req.rsi:.0f} — Hisse zaten aşırı satım bölgesinde. Bu olumlu haber bir toparlanma fitilini ateşleyebilir.")
        elif req.rsi > 70:
            lines.append(f"RSI {req.rsi:.0f} — Hisse aşırı alım bölgesinde. Olumsuz bir haber kâr realizasyonunu hızlandırabilir.")
        else:
            lines.append(f"RSI {req.rsi:.0f} — Teknik açıdan nötr bölgede. Haberin etkisi daha belirleyici olabilir.")
        lines.append("")

    # Kategori bazlı yorum
    cat_insights = {
        "earnings": "Kazanç haberleri fiyatı doğrudan etkiler. Beklentilerin üzerinde/altında açıklanan rakamlar sert hareketlere yol açabilir.",
        "macro": "Makro ekonomik gelişmeler sektörün tamamını etkiler. Tek hisseye odaklanmak yerine sektör görünümünü değerlendirin.",
        "regulation": "Düzenleyici kararlar uzun vadeli risk yaratabilir. Şirketin uyum kapasitesini araştırın.",
        "dividend": "Temettü kararları uzun vadeli yatırımcılar için önemli. Temettü verimi ve sürdürülebilirliğini kontrol edin.",
        "costs": "Maliyet artışları kâr marjlarını sıkıştırabilir. Şirketin bu artışı fiyatlarına yansıtma gücüne bakın.",
        "growth": "Büyüme haberleri gelecek dönem beklentilerini güçlendirir. Büyüme kalitesine dikkat edin.",
    }
    if req.category and req.category in cat_insights:
        lines.append("**Kategori Notu**")
        lines.append(cat_insights[req.category])
        lines.append("")

    lines.append("*Bu analiz bilgi amaçlıdır, yatırım tavsiyesi değildir.*")
    return "\n".join(lines)


def _claude_news_analysis(req: NewsAnalyzeRequest) -> Optional[str]:
    client = _get_anthropic_client()
    if not client:
        return None

    ctx_parts = [f'Haber Başlığı: "{req.headline}"']
    if req.summary:
        ctx_parts.append(f"Özet: {req.summary}")
    if req.sentiment:
        ctx_parts.append(f"Duygu: {req.sentiment}")
    if req.symbol:
        ctx_parts.append(f"İlgili Hisse: {req.symbol}")
    if req.rsi is not None:
        ctx_parts.append(f"Güncel RSI: {req.rsi:.1f}")
    if req.macd_bull is not None:
        ctx_parts.append(f"MACD Yönü: {'Yükseliş' if req.macd_bull else 'Düşüş'}")
    if req.price_change_pct is not None:
        ctx_parts.append(f"Günlük Fiyat Değişimi: {req.price_change_pct:+.2f}%")

    prompt = f"""Sen Analysight'in haber analiz asistanısın. Türkiye'de yeni başlayan bireysel yatırımcılara hitap ediyorsun.

{chr(10).join(ctx_parts)}

Aşağıdaki formatta kısa, net ve öğretici bir analiz yaz:

**Haberin Özeti** (1 cümle — ne oldu?)

**Piyasa Etkisi** (Bu haber hisse/piyasa için ne anlama geliyor? 2-3 cümle)

**Teknik ile Bağlantı** (Mevcut teknik göstergelerle nasıl örtüşüyor? — sadece teknik veri varsa yaz)

**Yeni Başlayanlar için Not** (Bu haberde geçen bir kavramı 1 cümleyle açıkla — ör. "Kâr marjı nedir?")

**Dikkat Edilmesi Gereken** (1 cümle risk veya fırsat notu)

Maksimum 180 kelime. Türkçe yaz. Teknik jargonu sade dille açıkla."""

    try:
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=500,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception:
        return None


@router.post("/news/analyze")
def analyze_news(req: NewsAnalyzeRequest):
    """
    Haber + teknik göstergeler → AI analizi.
    Claude yoksa zengin şablon döner.
    """
    claude_result = _claude_news_analysis(req)
    is_claude = claude_result is not None
    analysis = claude_result or _news_template_analysis(req)

    return {
        "is_claude": is_claude,
        "analysis": analysis,
        "headline": req.headline,
        "symbol": req.symbol,
    }


@router.get("/news/{symbol}")
def symbol_news(symbol: str, limit: int = Query(15, le=50)):
    return {"symbol": symbol.upper(), "items": get_symbol_news(symbol, limit=limit)}
