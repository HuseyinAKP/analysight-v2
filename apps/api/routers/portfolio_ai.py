"""
Portfolio AI Router — AI-powered portfolio management.
Endpoints:
  POST /api/portfolio-ai/analyze   Full portfolio AI analysis
  POST /api/portfolio-ai/chat      Ask anything about portfolio
  POST /api/portfolio-ai/scenario  Scenario stress test
"""
from __future__ import annotations
import os
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel

from services.real_data import get_ohlcv, get_symbol_info
from services.technical_analysis import build_indicators
from services.scenario_engine import build_scenarios
from services.risk_engine import calc_risk

router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────────

class HoldingInput(BaseModel):
    symbol: str
    shares: float
    avg_cost: float


class PortfolioAnalyzeRequest(BaseModel):
    holdings: list[HoldingInput]


class PortfolioChatRequest(BaseModel):
    holdings: list[HoldingInput]
    question: str
    # Optional context from previous analysis
    portfolio_summary: Optional[str] = None


class ScenarioRequest(BaseModel):
    holdings: list[HoldingInput]
    drop_pct: float = 10.0   # market drop %


# ── Helpers ────────────────────────────────────────────────────────────────────

SECTOR_MAP = {
    # BIST
    "THYAO": "Havacılık", "GARAN": "Bankacılık", "EREGL": "Demir-Çelik",
    "SISE": "Cam/Endüstri", "ASELS": "Savunma", "AKBNK": "Bankacılık",
    "ISCTR": "Bankacılık", "KCHOL": "Holding", "SAHOL": "Holding",
    "TCELL": "Telekomünikasyon", "BIMAS": "Perakende", "FROTO": "Otomotiv",
    "TUPRS": "Enerji/Rafine", "KOZAL": "Madencilik", "PGSUS": "Havacılık",
    # US
    "AAPL": "Teknoloji", "MSFT": "Teknoloji", "NVDA": "Teknoloji",
    "GOOGL": "Teknoloji", "AMZN": "E-Ticaret", "META": "Sosyal Medya",
    "TSLA": "Otomotiv/EV", "JPM": "Bankacılık", "BAC": "Bankacılık",
    "XOM": "Enerji", "CVX": "Enerji", "JNJ": "Sağlık",
    # Crypto
    "BTC-USD": "Kripto", "ETH-USD": "Kripto", "BNB-USD": "Kripto",
    "SOL-USD": "Kripto", "XRP-USD": "Kripto",
}

BETA_MAP = {
    "Kripto": 2.5, "Savunma": 0.7, "Bankacılık": 1.2, "Teknoloji": 1.3,
    "Havacılık": 1.4, "Enerji": 1.1, "Holding": 0.9, "Perakende": 0.8,
    "Otomotiv": 1.1, "Otomotiv/EV": 1.8, "Demir-Çelik": 1.3, "Madencilik": 1.5,
}


def _enrich_holding(h: HoldingInput) -> dict:
    sym = h.symbol.upper()
    try:
        df = get_ohlcv(sym, days=90)
        ind = build_indicators(df)
        sc  = build_scenarios(df)
        info = get_symbol_info(sym)
        curr_price = float(df["close"].iloc[-1]) if df is not None and not df.empty else (info.get("price", h.avg_cost) if info else h.avg_cost)
    except Exception:
        curr_price = h.avg_cost
        ind = None
        sc  = None
        info = None

    cost_basis   = h.shares * h.avg_cost
    market_value = h.shares * curr_price
    pnl          = market_value - cost_basis
    pnl_pct      = (pnl / cost_basis * 100) if cost_basis else 0

    sector = SECTOR_MAP.get(sym, "Diğer")
    beta   = BETA_MAP.get(sector, 1.0)

    rsi   = ind["rsi"]  if ind else 50.0
    score = ind["confluence"]["score"] if ind else 50
    macd_bull = (ind["macd"] > ind["macd_signal"]) if ind else False
    bull_prob = sc["scenarios"]["bull"]["probability"] if sc else 33

    signal_label = ("Güçlü Al" if score >= 70 else
                    "Al"       if score >= 55 else
                    "Nötr"     if score >= 40 else
                    "Sat")
    signal_color = ("green" if score >= 55 else "yellow" if score >= 40 else "red")

    # Simple rebalance suggestion
    if rsi > 72 and pnl_pct > 20:
        rebalance_hint = "Kâr realizasyonu değerlendirilebilir"
        rebalance_action = "reduce"
    elif rsi < 30 and score >= 50:
        rebalance_hint = "Ortalama düşürme fırsatı olabilir"
        rebalance_action = "add"
    elif score < 35:
        rebalance_hint = "Teknik görünüm zayıf — dikkatli izle"
        rebalance_action = "watch"
    else:
        rebalance_hint = "Mevcut pozisyon korunabilir"
        rebalance_action = "hold"

    return {
        "symbol": sym,
        "name": info["name"] if info else sym,
        "sector": sector,
        "shares": h.shares,
        "avg_cost": h.avg_cost,
        "current_price": round(curr_price, 4),
        "cost_basis": round(cost_basis, 2),
        "market_value": round(market_value, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
        "rsi": round(rsi, 1),
        "score": score,
        "macd_bull": macd_bull,
        "bull_prob": bull_prob,
        "signal": signal_label,
        "signal_color": signal_color,
        "beta": beta,
        "rebalance_hint": rebalance_hint,
        "rebalance_action": rebalance_action,
    }


def _portfolio_metrics(enriched: list[dict]) -> dict:
    total_value = sum(e["market_value"] for e in enriched)
    total_cost  = sum(e["cost_basis"]   for e in enriched)
    total_pnl   = total_value - total_cost
    pnl_pct     = (total_pnl / total_cost * 100) if total_cost else 0

    # Allocations
    for e in enriched:
        e["allocation_pct"] = round(e["market_value"] / total_value * 100, 1) if total_value else 0

    # Sector breakdown
    sector_alloc: dict[str, float] = {}
    for e in enriched:
        sector_alloc[e["sector"]] = sector_alloc.get(e["sector"], 0) + e["market_value"]
    sector_pct = {k: round(v / total_value * 100, 1) for k, v in sector_alloc.items()}

    # Weighted beta
    weighted_beta = sum(e["beta"] * e["allocation_pct"] / 100 for e in enriched)

    # Concentration risk: top position > 40% is high
    max_alloc = max((e["allocation_pct"] for e in enriched), default=0)
    top_sector_alloc = max(sector_pct.values(), default=0)
    concentration_risk = "Yüksek" if max_alloc > 40 or top_sector_alloc > 55 else "Orta" if max_alloc > 25 else "Düşük"

    # Portfolio health score (0-100)
    avg_score    = sum(e["score"] * e["allocation_pct"] / 100 for e in enriched)
    avg_rsi      = sum(e["rsi"]   * e["allocation_pct"] / 100 for e in enriched)
    avg_bull_prob= sum(e["bull_prob"] * e["allocation_pct"] / 100 for e in enriched)

    health = avg_score * 0.4 + (avg_bull_prob / 100 * 40) + (20 if concentration_risk == "Düşük" else 10 if concentration_risk == "Orta" else 0)
    health = max(0, min(100, round(health)))

    # Signals count
    bull_count = sum(1 for e in enriched if e["score"] >= 55)
    bear_count = sum(1 for e in enriched if e["score"] < 40)

    return {
        "total_value":  round(total_value, 2),
        "total_cost":   round(total_cost, 2),
        "total_pnl":    round(total_pnl, 2),
        "pnl_pct":      round(pnl_pct, 2),
        "health_score": health,
        "weighted_beta": round(weighted_beta, 2),
        "concentration_risk": concentration_risk,
        "sector_allocation": sector_pct,
        "bull_count": bull_count,
        "bear_count": bear_count,
        "neutral_count": len(enriched) - bull_count - bear_count,
        "avg_score": round(avg_score),
    }


def _claude_portfolio_analysis(enriched: list[dict], metrics: dict) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        positions_text = "\n".join([
            f"- {e['symbol']} ({e['sector']}): %{e['allocation_pct']} ağırlık, "
            f"P&L {e['pnl_pct']:+.1f}%, RSI {e['rsi']}, Skor {e['score']}/100, Sinyal: {e['signal']}"
            for e in enriched
        ])
        sectors_text = ", ".join([f"{k} %{v}" for k, v in metrics["sector_allocation"].items()])

        prompt = f"""Aşağıdaki portföyü Türkçe olarak analiz et ve yatırımcıya somut öneriler sun.

PORTFÖY:
{positions_text}

ÖZET METRİKLER:
- Toplam Değer: {metrics['total_value']:,.0f}
- Toplam P&L: {metrics['pnl_pct']:+.1f}%
- Portföy Sağlık Skoru: {metrics['health_score']}/100
- Konsantrasyon Riski: {metrics['concentration_risk']}
- Ağırlıklı Beta: {metrics['weighted_beta']:.2f}
- Sektör Dağılımı: {sectors_text}
- Yükseliş Sinyali Veren: {metrics['bull_count']}/{len(enriched)} pozisyon

Lütfen şu başlıklar altında yaz:
1. **Genel Değerlendirme** (2-3 cümle, portföyün genel durumu)
2. **Güçlü Noktalar** (2-3 madde)
3. **Risk Uyarıları** (2-3 madde, varsa)
4. **Somut Öneriler** (3-4 madde, hangi sembolde ne yapılmalı)
5. **Kısa Vadeli Görünüm** (1-2 cümle)

Sade, anlaşılır Türkçe kullan. Yatırım tavsiyesi değil, teknik analiz rehberi olarak yaz."""

        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=900,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text
    except Exception:
        return None


def _template_portfolio_analysis(enriched: list[dict], metrics: dict) -> str:
    health = metrics["health_score"]
    conc   = metrics["concentration_risk"]
    pnl    = metrics["pnl_pct"]
    beta   = metrics["weighted_beta"]

    verdict = ("Portföy genel olarak güçlü bir teknik görünüm sergilemiyor."
               if health < 40 else
               "Portföy karma bir teknik tablo sunuyor, dikkatli takip önerilir."
               if health < 60 else
               "Portföy sağlıklı görünüyor, teknik göstergeler genel olarak olumlu.")

    lines = [
        f"**Genel Değerlendirme**",
        f"{verdict} Portföy P&L {pnl:+.1f}%, sağlık skoru {health}/100.",
        "",
        f"**Güçlü Noktalar**",
    ]
    winners = [e for e in enriched if e["pnl_pct"] > 5]
    if winners:
        lines.append(f"- {winners[0]['symbol']} başta olmak üzere kârlı pozisyonlar portföyü destekliyor.")
    bull_syms = [e["symbol"] for e in enriched if e["score"] >= 55]
    if bull_syms:
        lines.append(f"- {', '.join(bull_syms[:3])} pozitif teknik sinyal veriyor.")
    lines.append(f"- Ağırlıklı beta {beta:.2f} — piyasayla uyumlu risk seviyesi.")
    lines.append("")
    lines.append("**Risk Uyarıları**")
    if conc == "Yüksek":
        top = max(enriched, key=lambda x: x["allocation_pct"])
        lines.append(f"- {top['symbol']} pozisyonu portföyde yüksek konsantrasyon oluşturuyor (%{top['allocation_pct']}).")
    high_rsi = [e for e in enriched if e["rsi"] > 70]
    if high_rsi:
        lines.append(f"- {', '.join(e['symbol'] for e in high_rsi)} aşırı alım bölgesinde — kâr satışı riski.")
    bear_syms = [e for e in enriched if e["score"] < 40]
    if bear_syms:
        lines.append(f"- {', '.join(e['symbol'] for e in bear_syms[:2])} zayıf teknik görünüm sergiliyor.")
    if not high_rsi and not bear_syms and conc != "Yüksek":
        lines.append("- Belirgin bir risk sinyali yok, ancak piyasa koşullarını takip edin.")
    lines.append("")
    lines.append("**Somut Öneriler**")
    for e in enriched:
        if e["rebalance_action"] != "hold":
            lines.append(f"- {e['symbol']}: {e['rebalance_hint']}")
    if not any(e["rebalance_action"] != "hold" for e in enriched):
        lines.append("- Mevcut pozisyonlar genel olarak korunabilir.")
    lines.append("")
    lines.append("**Kısa Vadeli Görünüm**")
    bull_pct = round(metrics["bull_count"] / len(enriched) * 100) if enriched else 50
    lines.append(f"Portföy pozisyonlarının %{bull_pct}'i yükseliş sinyali veriyor. "
                 f"{'Genel görünüm olumlu.' if bull_pct >= 60 else 'Karma sinyal ortamında temkinli olunması önerilir.'}")

    return "\n".join(lines)


def _claude_portfolio_chat(enriched: list[dict], metrics: dict, question: str) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        positions_text = "\n".join([
            f"- {e['symbol']}: %{e['allocation_pct']} ağırlık, RSI {e['rsi']}, Skor {e['score']}, P&L {e['pnl_pct']:+.1f}%"
            for e in enriched
        ])

        prompt = f"""Sen bir portföy analiz asistanısın. Kullanıcının portföyü:
{positions_text}

Portföy sağlık skoru: {metrics['health_score']}/100
Konsantrasyon riski: {metrics['concentration_risk']}
Ağırlıklı beta: {metrics['weighted_beta']:.2f}

Kullanıcı sorusu: {question}

Türkçe, kısa ve net cevap ver (maksimum 3-4 cümle veya madde). Yatırım tavsiyesi değil, teknik analiz odaklı yorum yap."""

        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text
    except Exception:
        return None


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/analyze")
def analyze_portfolio(body: PortfolioAnalyzeRequest):
    """Full AI portfolio analysis."""
    if not body.holdings:
        return {"error": "No holdings provided"}

    enriched = [_enrich_holding(h) for h in body.holdings]
    metrics  = _portfolio_metrics(enriched)

    ai_analysis = _claude_portfolio_analysis(enriched, metrics)
    is_claude   = ai_analysis is not None
    analysis    = ai_analysis or _template_portfolio_analysis(enriched, metrics)

    # Rebalance suggestions — normalized target weights
    total_val = metrics["total_value"]
    rebalance_suggestions = []
    for e in enriched:
        if e["rebalance_action"] in ("reduce", "add"):
            current_w = e["allocation_pct"]
            suggested_w = current_w * 0.7 if e["rebalance_action"] == "reduce" else min(current_w * 1.3, 30)
            rebalance_suggestions.append({
                "symbol": e["symbol"],
                "action": e["rebalance_action"],
                "hint": e["rebalance_hint"],
                "current_weight_pct": current_w,
                "suggested_weight_pct": round(suggested_w, 1),
                "value_change": round((suggested_w - current_w) / 100 * total_val, 0),
            })

    return {
        "positions": enriched,
        "metrics": metrics,
        "analysis": analysis,
        "is_claude": is_claude,
        "rebalance_suggestions": rebalance_suggestions,
    }


@router.post("/chat")
def portfolio_chat(body: PortfolioChatRequest):
    """Ask anything about the portfolio."""
    if not body.holdings:
        return {"answer": "Portföy bilgisi bulunamadı."}

    enriched = [_enrich_holding(h) for h in body.holdings]
    metrics  = _portfolio_metrics(enriched)

    answer = _claude_portfolio_chat(enriched, metrics, body.question)
    if not answer:
        # Simple keyword-based fallback
        q = body.question.lower()
        if "rsk" in q or "risk" in q:
            answer = f"Portföy konsantrasyon riski: {metrics['concentration_risk']}. Ağırlıklı beta {metrics['weighted_beta']:.2f}. En yüksek riskli sektörler için pozisyon büyüklüklerini gözden geçirin."
        elif "en iyi" in q or "güçlü" in q:
            top = max(enriched, key=lambda x: x["score"])
            answer = f"En güçlü teknik görünüm: {top['symbol']} (Skor {top['score']}/100, RSI {top['rsi']})."
        elif "sat" in q or "çıkış" in q:
            reduce_list = [e["symbol"] for e in enriched if e["rebalance_action"] == "reduce"]
            if reduce_list:
                answer = f"Kâr realizasyonu değerlendirilebilecek pozisyonlar: {', '.join(reduce_list)}. RSI 70+ veya güçlü P&L kriterleri baz alındı."
            else:
                answer = "Mevcut teknik verilere göre acil çıkış sinyali veren pozisyon bulunmuyor."
        else:
            answer = f"Portföy sağlık skoru {metrics['health_score']}/100. {metrics['bull_count']}/{len(enriched)} pozisyon yükseliş sinyali veriyor. Daha spesifik bir soru sormayı deneyin."

    return {"answer": answer, "is_claude": answer != ""}


@router.post("/scenario")
def portfolio_scenario(body: ScenarioRequest):
    """Stress test: what if market drops X%?"""
    enriched = [_enrich_holding(h) for h in body.holdings]
    drop     = body.drop_pct / 100

    results = []
    for e in enriched:
        # Beta-adjusted drop
        adjusted_drop = drop * e["beta"]
        new_price     = e["current_price"] * (1 - adjusted_drop)
        new_value     = e["shares"] * new_price
        scenario_pnl  = new_value - e["cost_basis"]
        scenario_pnl_pct = (scenario_pnl / e["cost_basis"] * 100) if e["cost_basis"] else 0
        results.append({
            "symbol": e["symbol"],
            "sector": e["sector"],
            "beta": e["beta"],
            "current_value": e["market_value"],
            "scenario_value": round(new_value, 2),
            "scenario_pnl": round(scenario_pnl, 2),
            "scenario_pnl_pct": round(scenario_pnl_pct, 2),
            "adjusted_drop_pct": round(adjusted_drop * 100, 1),
        })

    total_curr  = sum(e["market_value"] for e in enriched)
    total_scen  = sum(r["scenario_value"] for r in results)
    portfolio_drop = round((total_scen - total_curr) / total_curr * 100, 2) if total_curr else 0

    return {
        "market_drop_pct": body.drop_pct,
        "portfolio_drop_pct": portfolio_drop,
        "portfolio_value_loss": round(total_scen - total_curr, 2),
        "positions": results,
    }
