"""
Ekonomik Takvim Router — Yüksek etkili makro olaylar + AI yorumu.
"""
from __future__ import annotations
import os
from typing import Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from services.economic_calendar import get_calendar, get_event_ai_context

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


@router.get("/calendar")
def economic_calendar(days: int = Query(30, le=90)):
    """Önümüzdeki N günün yüksek etkili ekonomik olayları."""
    return get_calendar(days_ahead=days)


class EventAnalyzeRequest(BaseModel):
    event_abbr: str
    event_name: str
    forecast: Optional[str] = None
    previous: Optional[str] = None
    actual: Optional[str] = None
    portfolio_symbols: Optional[list[str]] = None


@router.post("/calendar/analyze")
def analyze_event(req: EventAnalyzeRequest):
    """
    Ekonomik olay + portföy → AI yorumu.
    Claude yoksa şablon döner.
    """
    ctx = get_event_ai_context(req.event_abbr)

    # Şablon analiz
    def template_analysis() -> str:
        lines = [
            f"**{req.event_name}**",
            "",
            ctx.get("description", ""),
            "",
            "**Piyasa Etkisi**",
            ctx.get("market_impact", "Bu veri yayınlandığında piyasalarda volatilite artabilir."),
            "",
        ]
        if req.portfolio_symbols:
            lines.append("**Portföyünüze Etkisi**")
            sector_impacts = ctx.get("sector_impacts", {})
            for sym in req.portfolio_symbols[:4]:
                impact = sector_impacts.get("Bankacılık", "Dolaylı etki olabilir") if any(
                    b in sym for b in ["GARAN", "AKBNK", "YKBNK", "ISCTR", "VAKBN"]
                ) else "Bu veriyi yakından takip edin."
                lines.append(f"- **{sym}**: {impact}")
            lines.append("")
        lines.append("*Bu analiz bilgi amaçlıdır, yatırım tavsiyesi değildir.*")
        return "\n".join(lines)

    client = _get_anthropic_client()
    if not client:
        return {"is_claude": False, "analysis": template_analysis()}

    # Claude analizi
    portfolio_txt = ""
    if req.portfolio_symbols:
        portfolio_txt = f"\nPortföydeki hisseler: {', '.join(req.portfolio_symbols)}"

    actual_txt = f"\nGerçekleşen: {req.actual}" if req.actual else "\n(Henüz açıklanmadı)"

    prompt = f"""Sen Analysight'in makroekonomi analisti olarak Türk bireysel yatırımcıya hitap ediyorsun.

Ekonomik Olay: {req.event_name}
Açıklama: {ctx.get('description', '')}
Beklenti: {req.forecast or 'Bilinmiyor'} | Önceki: {req.previous or 'Bilinmiyor'}{actual_txt}{portfolio_txt}

Sektör bazlı etkiler:
{chr(10).join(f'  {k}: {v}' for k, v in ctx.get('sector_impacts', {}).items())}

Kısa, net Türkçe analiz yaz:

**Olayın Özeti** (Bu veri ne gösteriyor? 1-2 cümle)

**Piyasa Etkisi** (BIST, TRY ve küresel piyasalar için ne anlama geliyor? 2-3 cümle)

**Portföy Perspektifi** (yukarıdaki hisseler varsa onlara odaklan, yoksa genel yatırımcı için yaz)

**Ne Yapmalı?** (Bekle / İzle / Dikkat et — 1 cümle tavsiye değil not)

Maksimum 150 kelime. Teknik jargonu açıkla."""

    try:
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=450,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"is_claude": True, "analysis": msg.content[0].text.strip()}
    except Exception:
        return {"is_claude": False, "analysis": template_analysis()}
