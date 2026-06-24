"""
AI Araştırma Modu — Multi-servis otonom araştırma.

Scanner + Briefing + Social Signals → Claude AI → "Bugünün 5 Fırsatı" raporu.
"""
from __future__ import annotations
import os
from typing import Optional
from fastapi import APIRouter
from services.scanner import run_scan, PRESET_FILTERS
from services.morning_briefing import build_morning_briefing
from services.watchlist_scan import scan_watchlist

router = APIRouter()


def _get_anthropic_client():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        return anthropic.Anthropic(api_key=api_key)
    except Exception:
        return None


def _template_research_report(opportunities: list, briefing: dict, market_tone: str) -> str:
    """Rich template fallback when Claude API key not set."""
    lines = [
        f"Piyasa Tonu: {market_tone}",
        "",
        "Gunun En Iyi Firsatlari:",
        "",
    ]
    for i, opp in enumerate(opportunities[:5], 1):
        lines.append(
            f"{i}. {opp['symbol']} — Skor {opp['score']}/100 | "
            f"RSI {opp.get('rsi', '—')} | {opp.get('signal', '')} | "
            f"Fiyat {opp.get('price', '—')}"
        )
        if opp.get("commentary"):
            lines.append(f"   {opp['commentary']}")
        lines.append("")

    lines += [
        "Makro Gorunum:",
        f"  Ortalama degisim: {briefing.get('avg_change', 0):+.2f}%",
        f"  Piyasa haber duygusu: {briefing.get('news_mood', 'Karisik')}",
        "",
        "Bu analiz yatirim tavsiyesi degildir.",
    ]
    return "\n".join(lines)


def _claude_research(opportunities: list, briefing: dict, market_tone: str) -> Optional[str]:
    client = _get_anthropic_client()
    if client is None:
        return None

    opp_text = "\n".join(
        f"  {i+1}. {o['symbol']} — Skor {o['score']}/100, RSI {o.get('rsi','?')}, "
        f"Sinyal: {o.get('signal','')}, Fiyat: {o.get('price','?')}, "
        f"Degisim: {o.get('change_pct', 0):+.2f}%"
        for i, o in enumerate(opportunities[:7])
    )

    prompt = f"""Sen Analysight'in otonom AI piyasa arastirmacisisın. Asagidaki verileri analiz ederek kisa, net ve kullanilabilir bir Turkce rapor yaz.

PIYASA DURUMU:
- Genel ton: {market_tone}
- Ortalama degisim: {briefing.get('avg_change', 0):+.2f}%
- Haber duygusu: {briefing.get('news_mood', 'Karisik')}

EN YUKSEK SKORLU FIRSATLAR (confluence skoru ve teknik filtrelerden gecenler):
{opp_text}

Gorev: Asagidaki formatta kisa bir "Gunun Firsatlari" raporu yaz:

**Piyasa Ozeti** (1-2 cumle: bugunku genel hava nedir?)

**Top 5 Firsat**
Her biri icin:
- Sembol ve neden one ciktigini 1 cumlede acikla
- Teknik gucu (RSI, skor) yorumla
- Izlenecek kritik seviye

**Gunun Onemli Notu** (1 cumle: piyasada dikkat edilmesi gereken seye dikkat cek)

Kisa tut, maksimum 250 kelime. Turk bireysel yatirimci icin yaz. Yatirim tavsiyesi olmadigini son satirda belirt."""

    try:
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception:
        return None


@router.post("/auto")
def auto_research():
    """
    Otonom AI arastirma:
    1. Watchlist taramasi
    2. Sabah brifing verisi
    3. Claude ile sentez → gunun firsatlari raporu
    """
    # Step 1: Scan watchlist for top opportunities
    try:
        watchlist = scan_watchlist()
        opportunities = sorted(watchlist, key=lambda x: x.get("score", 0), reverse=True)
    except Exception:
        opportunities = []

    # Step 2: Get briefing context
    try:
        briefing = build_morning_briefing()
        market_tone = briefing.get("market_tone", "karisik")
    except Exception:
        briefing = {"avg_change": 0, "news_mood": "Karisik"}
        market_tone = "karisik"

    # Step 3: Claude synthesis or template fallback
    claude_report = _claude_research(opportunities, briefing, market_tone)
    is_claude = claude_report is not None
    report = claude_report or _template_research_report(opportunities, briefing, market_tone)

    return {
        "is_claude": is_claude,
        "market_tone": market_tone,
        "avg_change": briefing.get("avg_change", 0),
        "opportunities": opportunities[:5],
        "report": report,
        "sources_used": ["watchlist_scan", "morning_briefing"],
    }


@router.get("/status")
def research_status():
    """AI Arastirma Modu durumu."""
    return {
        "claude_available": _get_anthropic_client() is not None,
        "endpoints": ["/api/research/auto"],
    }
