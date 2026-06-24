from __future__ import annotations
import os
import base64
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from services.real_data import get_ohlcv, get_symbol_info, SYMBOL_META
from services.technical_analysis import build_indicators
from services.scenario_engine import build_scenarios
from services.risk_engine import calc_risk

router = APIRouter()

def _require_symbol(symbol: str):
    """Allow any symbol — yfinance handles unknown ones too."""
    return symbol.upper()


@router.get("/{symbol}/info")
def get_symbol_info_route(symbol: str):
    """Lightweight price + change info for a symbol — used by Paper Trade."""
    symbol = _require_symbol(symbol)
    info = get_symbol_info(symbol)
    if not info:
        raise HTTPException(status_code=404, detail=f"No info for {symbol}")
    return {
        "symbol":     symbol,
        "name":       info.get("name", symbol),
        "price":      info.get("price", 0),
        "change_pct": info.get("change_pct", 0),
        "change_abs": info.get("change_abs", 0),
        "currency":   info.get("currency", "TRY"),
        "market":     info.get("market", ""),
    }


@router.get("/{symbol}/indicators")
def get_indicators(symbol: str, days: int = 200):
    symbol = _require_symbol(symbol)
    df = get_ohlcv(symbol, days=days)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return build_indicators(df)


@router.get("/{symbol}/scenarios")
def get_scenarios(symbol: str):
    symbol = _require_symbol(symbol)
    df = get_ohlcv(symbol, days=200)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return build_scenarios(df)


@router.get("/{symbol}/ohlcv")
def get_ohlcv_route(symbol: str, days: int = 90):
    symbol = _require_symbol(symbol)
    # 5Y = 1825, MAX = 9999 (return all available)
    fetch_days = min(days, 9999)
    df = get_ohlcv(symbol, days=fetch_days)
    if df is None or df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    df2 = df.copy()
    df2["date"] = df2["date"].dt.strftime("%Y-%m-%d") if hasattr(df2["date"].iloc[0], "strftime") else df2["date"].astype(str)
    result = df2 if days >= 9999 else df2.tail(days)
    return result.round(4).to_dict(orient="records")


@router.get("/{symbol}/multiframe")
def get_multiframe(symbol: str):
    """Multi-timeframe confluence — Bloomberg-style cross-timeframe analysis."""
    symbol = symbol.upper()
    pass  # open to all symbols

    TIMEFRAMES = {
        "1W":  {"days": 30,  "label": "1 Hafta",   "candles": 5},
        "1M":  {"days": 90,  "label": "1 Ay",       "candles": 22},
        "3M":  {"days": 180, "label": "3 Ay",       "candles": 66},
        "6M":  {"days": 365, "label": "6 Ay",       "candles": 132},
    }

    result = []
    for tf, cfg in TIMEFRAMES.items():
        df = get_ohlcv(symbol, days=cfg["days"])
        ind = build_indicators(df)
        conf = ind["confluence"]
        bull = conf["bull_count"]
        bear = conf["bear_count"]
        total = bull + bear + conf["neutral_count"]
        direction = "bull" if bull > bear else ("bear" if bear > bull else "neutral")
        result.append({
            "timeframe": tf,
            "label": cfg["label"],
            "direction": direction,
            "confluence_score": conf["score"],
            "bull_count": bull,
            "bear_count": bear,
            "rsi": ind["rsi"],
            "macd_bullish": bool(ind["macd"] > ind["macd_signal"]),
            "price_vs_ema200": "above" if ind["series"]["close"][-1] > ind["ema200"] else "below",
        })
    return {"symbol": symbol, "frames": result}


@router.get("/{symbol}/fundamentals")
def get_fundamentals(symbol: str):
    """Company fundamental data — revenue, earnings, margins, valuation multiples."""
    symbol = symbol.upper()
    pass  # open to all symbols

    import random, math
    random.seed(hash(symbol) % 2**31)

    # Mock per-symbol fundamentals
    _BASE = {
        "THYAO": {"revenue_b": 12.4, "net_income_b": 1.8, "pe": 6.2,  "pb": 1.1, "ps": 0.5,  "roe": 28.4, "debt_equity": 1.8, "sector": "Havacılık"},
        "GARAN": {"revenue_b": 8.9,  "net_income_b": 3.2, "pe": 4.8,  "pb": 0.9, "ps": 0.7,  "roe": 19.2, "debt_equity": 5.2, "sector": "Bankacılık"},
        "EREGL": {"revenue_b": 6.1,  "net_income_b": 0.9, "pe": 7.4,  "pb": 1.3, "ps": 1.1,  "roe": 17.6, "debt_equity": 0.4, "sector": "Çelik"},
        "SISE":  {"revenue_b": 4.8,  "net_income_b": 0.7, "pe": 8.9,  "pb": 1.5, "ps": 1.8,  "roe": 16.8, "debt_equity": 0.6, "sector": "Cam"},
        "ASELS": {"revenue_b": 3.2,  "net_income_b": 0.5, "pe": 14.2, "pb": 3.1, "ps": 3.9,  "roe": 21.4, "debt_equity": 0.3, "sector": "Savunma"},
        "AAPL":  {"revenue_b": 394.0,"net_income_b": 100.0,"pe": 28.4,"pb": 45.2,"ps": 7.1,  "roe": 160.1,"debt_equity": 1.8,"sector": "Teknoloji"},
        "MSFT":  {"revenue_b": 212.0,"net_income_b": 72.0, "pe": 34.1,"pb": 12.4,"ps": 11.5, "roe": 38.2, "debt_equity": 0.3,"sector": "Teknoloji"},
        "NVDA":  {"revenue_b": 60.9, "net_income_b": 29.8, "pe": 58.2,"pb": 22.1,"ps": 19.8, "roe": 91.3, "debt_equity": 0.4,"sector": "Yarı İletken"},
        "BTC-USD":{"revenue_b": None,"net_income_b": None, "pe": None, "pb": None,"ps": None, "roe": None, "debt_equity": None,"sector": "Kripto"},
        "ETH-USD":{"revenue_b": None,"net_income_b": None, "pe": None, "pb": None,"ps": None, "roe": None, "debt_equity": None,"sector": "Kripto"},
    }

    base = _BASE.get(symbol, {"revenue_b": 5.0, "net_income_b": 0.8, "pe": 12.0, "pb": 2.0, "ps": 2.0, "roe": 15.0, "debt_equity": 0.5, "sector": "Diğer"})

    if base["revenue_b"] is None:
        return {"symbol": symbol, "available": False, "reason": "Kripto varlıklar için bilanço verisi mevcut değildir."}

    # Generate 4-quarter revenue/earnings trend
    rev = base["revenue_b"]
    ni = base["net_income_b"]
    quarters = []
    for i in range(4, 0, -1):
        growth = random.uniform(0.03, 0.12)
        beat = random.choice([True, True, False])
        q_rev = round(rev / 4 * (1 - growth * i * 0.1), 2)
        q_ni = round(ni / 4 * (1 - growth * i * 0.1), 2)
        est_ni = round(q_ni * (0.95 if beat else 1.05), 2)
        quarters.append({
            "quarter": f"Q{5-i} 2025",
            "revenue_b": q_rev,
            "net_income_b": q_ni,
            "eps_actual": round(q_ni * 1e9 / 5e9, 2),
            "eps_estimate": round(est_ni * 1e9 / 5e9, 2),
            "beat": beat,
            "revenue_growth_yoy": round(growth * 100, 1),
            "net_margin_pct": round(q_ni / q_rev * 100, 1) if q_rev else 0,
        })

    # Sector peer comparison
    sector_avg_pe = {"Teknoloji": 32.0, "Bankacılık": 6.0, "Havacılık": 9.0, "Çelik": 8.0, "Cam": 10.0, "Savunma": 18.0, "Yarı İletken": 50.0, "Kripto": None, "Diğer": 15.0}
    avg_pe = sector_avg_pe.get(base["sector"], 15.0)
    pe_vs_sector = "ucuz" if (base["pe"] and avg_pe and base["pe"] < avg_pe * 0.85) else ("pahalı" if (base["pe"] and avg_pe and base["pe"] > avg_pe * 1.15) else "uygun")

    return {
        "symbol": symbol,
        "available": True,
        "sector": base["sector"],
        "valuation": {
            "pe": base["pe"],
            "pb": base["pb"],
            "ps": base["ps"],
            "roe_pct": base["roe"],
            "debt_equity": base["debt_equity"],
            "sector_avg_pe": avg_pe,
            "pe_vs_sector": pe_vs_sector,
        },
        "annual": {
            "revenue_b": base["revenue_b"],
            "net_income_b": base["net_income_b"],
            "net_margin_pct": round(base["net_income_b"] / base["revenue_b"] * 100, 1),
        },
        "quarters": quarters,
        "insights": [
            f"{'Son çeyrekte kazanç beklentiyi aştı' if quarters[-1]['beat'] else 'Son çeyrekte kazanç beklentinin altında kaldı'}",
            f"Net marj: %{quarters[-1]['net_margin_pct']} — {'güçlü' if quarters[-1]['net_margin_pct'] > 20 else ('orta' if quarters[-1]['net_margin_pct'] > 10 else 'düşük')}",
            f"F/K oranı {base['pe']:.1f}x — sektör ortalaması {avg_pe:.1f}x ile karşılaştırıldığında {pe_vs_sector}",
            f"ROE %{base['roe']:.1f} — sermaye verimliliği {'yüksek' if base['roe'] > 20 else 'orta'}",
        ],
    }


# ── Claude Prompt Analyzer ─────────────────────────────────────────────────────

class PromptRequest(BaseModel):
    prompt_type: str   # wall_street | kazanc | teknik | giris | risk_harita | bear_bull | sektor

PROMPT_TYPES = {
    "wall_street":   "Wall Street Analist Raporu",
    "kazanc":        "Kazanç & Temel Analiz",
    "teknik":        "Kapsamlı Teknik Görünüm",
    "giris":         "Giriş Zamanlaması",
    "risk_harita":   "Risk Haritası",
    "bear_bull":     "Bear vs Bull Case",
    "sektor":        "Sektör Karşılaştırması",
    "beklenti":      "Piyasa Ne Fiyatlamış?",
    "nakit_kalite":  "Nakit & Kâr Kalitesi",
    "kazanc_kalite": "Kazanç Sürdürülebilirliği",
}


def _build_context(symbol: str) -> Optional[dict]:
    """All technical + fundamental data for a symbol."""
    df = get_ohlcv(symbol, days=200)
    if df is None or df.empty:
        return None
    info   = get_symbol_info(symbol) or {}
    ind    = build_indicators(df)
    sc     = build_scenarios(df)
    rsk    = calc_risk(df)
    conf   = ind["confluence"]
    price  = float(df["close"].iloc[-1])
    name   = info.get("name", symbol)

    return {
        "symbol": symbol, "name": name, "price": price,
        "change_pct": float(info.get("change_pct", 0)),
        "rsi":   float(ind["rsi"]),
        "macd_bull": bool(ind["macd"] > ind["macd_signal"]),
        "ema20": float(ind["ema20"]),
        "ema50": float(ind["ema50"]),
        "ema200": float(ind["ema200"]),
        "adx": float(ind.get("adx", 25)),
        "bb_upper": float(ind.get("bb_upper", price * 1.05)),
        "bb_lower": float(ind.get("bb_lower", price * 0.95)),
        "confluence_score": conf["score"],
        "bull_count": conf["bull_count"],
        "bear_count": conf["bear_count"],
        "top_signals": [s for s in conf["signals"] if s["signal"] != "neutral"][:4],
        "bull_target":  float(sc["scenarios"]["bull"]["target"]),
        "base_target":  float(sc["scenarios"]["base"]["target"]),
        "bear_target":  float(sc["scenarios"]["bear"]["target"]),
        "bull_prob": float(sc["scenarios"]["bull"]["probability"]),
        "bear_prob": float(sc["scenarios"]["bear"]["probability"]),
        "uncertainty": float(sc["uncertainty_index"]) / 100.0,  # normalize to 0-1
        "stop_loss": float(rsk["stop_loss"]),
        "target1":   float(rsk["target1"]),
        "target2":   float(rsk["target2"]),
        "rr_t1":     float(rsk["rr_ratio_t1"]),
        "atr":       float(rsk["atr"]),
    }


def _build_prompt(ctx: dict, prompt_type: str) -> str:
    s = ctx
    signals_text = "\n".join(
        f"  - {sg['label']}: {'YUKSELIS' if sg['signal'] == 'bull' else 'DUSUS'} ({sg['note']})"
        for sg in s["top_signals"]
    ) or "  - Belirgin sinyal yok"

    base = f"""Hisse: {s['symbol']} ({s['name']})
Fiyat: {s['price']:.4f} ({'+' if s['change_pct'] >= 0 else ''}{s['change_pct']:.2f}%)
RSI: {s['rsi']:.1f} | MACD: {'Yükseliş' if s['macd_bull'] else 'Düşüş'} | ADX: {s['adx']:.1f}
EMA20: {s['ema20']:.4f} | EMA50: {s['ema50']:.4f} | EMA200: {s['ema200']:.4f}
Uyum Skoru: {s['confluence_score']}/100 ({s['bull_count']} yükseliş, {s['bear_count']} düşüş sinyali)
Senaryo Bandı: Boğa {s['bull_target']:.4f} (%{s['bull_prob']*100:.0f}) | Baz {s['base_target']:.4f} | Ayı {s['bear_target']:.4f} (%{s['bear_prob']*100:.0f})
Stop: {s['stop_loss']:.4f} | H1: {s['target1']:.4f} (R/R {s['rr_t1']:.1f}x) | H2: {s['target2']:.4f}
ATR: {s['atr']:.4f} | Belirsizlik: {s['uncertainty']*100:.0f}/100
Sinyaller:
{signals_text}"""

    prompts = {
        "wall_street": f"""Sen deneyimli bir Wall Street analistinin rolündesin. Aşağıdaki verileri kullanarak {s['symbol']} için profesyonel bir analist raporu yaz.

{base}

Rapor formatı:
**DERECELENDİRME:** [AL / TUT / SAT] — Fiyat Hedefi: [12 aylık hedef]

**ÖZET:** (2-3 cümle — yatırım tezi)

**GÜÇLü YÖNLER:**
• [3 madde]

**RİSKLER:**
• [3 madde]

**TEKNİK GÖRÜNÜM:** (2 cümle)

**SONUÇ:** (1 cümle kesin karar)

Türkçe yaz. Somut fiyat seviyeleri kullan. Yatırım tavsiyesi olmadığını son satırda belirt.""",

        "kazanc": f"""Sen temel analiz uzmanısın. {s['symbol']} için mevcut değerleme ve kazanç analizini yap.

{base}

Analiz formatı:
**MEVCUT DEĞERLEME:**
Fiyat {s['price']:.4f} seviyesinden, teknik göstergeler ve fiyat hareketine göre değerlemeyi yorumla.

**KAZANÇ KALİTESİ:**
• Trend analizi (momentum güçlü mü zayıf mı?)
• Büyüme sürekliliği
• Marj baskısı riski

**KATALIZÖRLER:**
• Yukarı yönlü: neler tetikleyebilir?
• Aşağı yönlü: neler bozabilir?

**ÖZET GÖRÜŞ:** (2 cümle)

Türkçe, profesyonel tonda yaz. Yatırım tavsiyesi değildir.""",

        "teknik": f"""Sen teknik analist olarak {s['symbol']} için Bloomberg Terminal kalitesinde teknik analiz yaz.

{base}

Format:
**TREND ANALİZİ:**
• Kısa vade (EMA20 bazlı): [durum]
• Orta vade (EMA50 bazlı): [durum]
• Uzun vade (EMA200 bazlı): [durum]

**MOMENTUM:**
RSI {s['rsi']:.1f} ve MACD durumunu yorumla. Uyum skorunu (varsa) değerlendir.

**KRİTİK SEVİYELER:**
• Destek: [hesapla]
• Direnç: [hesapla]
• Stop: {s['stop_loss']:.4f}

**SENARYO:**
• Boğa: {s['bull_target']:.4f} (neler gerekir?)
• Ayı: {s['bear_target']:.4f} (neler tetikler?)

**İZLENECEK GÖSTERGELER:** (2-3 madde)

Türkçe yaz. Somut seviyeler kullan.""",

        "giris": f"""Sen giriş noktası uzmanısın. {s['symbol']} için ideal giriş stratejisi belirle.

{base}

Format:
**MEVCUT POZİSYON DURUMU:**
Şu an [erken/geç/uygun] giriş bölgesinde mi? Neden?

**GİRİŞ SEÇENEKLERİ:**
1. Agresif giriş: [fiyat seviyesi ve koşul]
2. Konservatif giriş: [fiyat seviyesi ve koşul]
3. Pullback girişi: [hangi seviyeye çekilirse?]

**ONAY KRİTERLERİ:**
• Girişi doğrulayan sinyal: [ne görülmeli?]
• İptal koşulu: [ne olursa bekleme?]

**POZİSYON YÖNETİMİ:**
• Stop: {s['stop_loss']:.4f}
• 1. Hedef: {s['target1']:.4f}
• 2. Hedef: {s['target2']:.4f}
• R/R oranı: {s['rr_t1']:.1f}x

Türkçe yaz. Yatırım tavsiyesi değildir.""",

        "risk_harita": f"""Sen risk yöneticisi olarak {s['symbol']} için kapsamlı risk haritası çıkar.

{base}

Format:
**TEKNİK RİSKLER:**
• [RSI, MACD ve pozisyona göre 3 teknik risk maddesi]

**POZİSYON RİSKİ:**
• Stop-loss: {s['stop_loss']:.4f} (giriş fiyatından ne kadar uzak?)
• Maksimum kayıp senaryosu: {s['bear_target']:.4f}
• Belirsizlik endeksi: {s['uncertainty']*100:.0f}/100

**PIYASA RİSKİ:**
• ATR {s['atr']:.4f} günlük hareket — volatilite değerlendirmesi
• BB pozisyonu ve squeeze riski

**RİSK AZALTMA ÖNERİLERİ:**
• [3 madde]

**RİSK/ÖDÜL KARARI:** (1 cümle)

Türkçe yaz. Yatırım tavsiyesi değildir.""",

        "bear_bull": f"""Sen senaryo analistinin rolündesin. {s['symbol']} için bear ve bull case'i detaylı karşılaştır.

{base}

Format:
**BULL CASE — Hedef: {s['bull_target']:.4f} (%{s['bull_prob']*100:.0f} olasılık)**
Koşullar:
• [3 katalizör]
Zaman çerçevesi: [kaç haftada?]

**BASE CASE — Hedef: {s['base_target']:.4f}**
• Neden bu en olası senaryo?

**BEAR CASE — Hedef: {s['bear_target']:.4f} (%{s['bear_prob']*100:.0f} olasılık)**
Tetikleyiciler:
• [3 risk faktörü]

**OLASI DÖNÜM NOKTALARI:**
• Bull → Bear geçişi için hangi seviye kırılmalı?
• Bear → Bull geçişi için ne görülmeli?

**POZİSYONLANMA ÖNERİSİ:** (1-2 cümle)

Türkçe yaz. Yatırım tavsiyesi değildir.""",

        "sektor": f"""Sen sektör analisti olarak {s['symbol']}'yi sektörü içinde konumlandır.

{base}

Format:
**SEKTÖRDEK KONUM:**
{s['symbol']}'nin teknik gücünü sektör/piyasa ortalamasıyla karşılaştır.

**GÖRECELİ GÜÇ:**
• Sektöre göre momentum: [güçlü/zayıf/nötr]
• Uyum skoru ({s['confluence_score']}/100) sektör içinde nasıl?

**YAPISAL AVANTAJLAR:**
• [2 madde]

**KIRMIZI BAYRAKLAR:**
• [2 madde]

**SEKTÖR ROTASYON GÖRÜŞÜ:**
Bu hisseye sektör rotasyonu açısından nasıl yaklaşılmalı?

**ÖZET:** (2 cümle)

Türkçe yaz. Yatırım tavsiyesi değildir.""",

        "beklenti": f"""Sen piyasa beklentisi analistinin rolündesin. {s['symbol']} için fiyata gömülü beklentileri çöz.

{base}

Bir hisse senedi fiyatı, piyasanın geleceğe dair beklentilerini yansıtır. Bu analizde şu soruyu cevapla:
"Bu fiyat seviyesi hangi varsayımları fiyatlıyor?"

Format:
**FİYATIN İÇERDİĞİ BEKLENTILER:**
Fiyat {s['price']:.4f} seviyesi ve teknik göstergeler göz önüne alındığında:
• Büyüme beklentisi: [piyasa ne kadar büyüme varsayıyor?]
• Momentum beklentisi: RSI {s['rsi']:.1f} ve uyum skoru {s['confluence_score']}/100 — piyasa ne söylüyor?
• Risk iştahı: Belirsizlik {s['uncertainty']*100:.0f}/100 seviyesi ne anlama geliyor?

**BU BEKLENTILER GERÇEKÇİ Mİ?**
• Boğa hedefi {s['bull_target']:.4f} için ne gerekiyor?
• Mevcut teknik tablo bu hedefleri destekliyor mu?
• Hangi beklenti abartılmış olabilir?

**FIYAT-BEKLENTI UYUMU:**
• [UCUZ / ADİL / PAHALI] — gerekçesi nedir?
• Kataliz olmazsa ne olur?

**YATIRIMCI İÇİN SONUÇ:** (2 cümle — beklentilere göre risk/fırsat dengesi)

Türkçe yaz. Gerçekçi ve analitik ol. Yatırım tavsiyesi değildir.""",

        "nakit_kalite": f"""Sen finansal kalite analistinin rolündesin. {s['symbol']} için nakit akışı kalitesini değerlendir.

{base}

Önemli prensip: Net kâr bir muhasebe görüşüdür. Nakit bir gerçektir. Bu analizde şirketi nakit üretme kapasitesi açısından incele.

Format:
**NAKIT AKIŞI KALİTESİ:**
Mevcut teknik veriler ışığında:
• Fiyat momentum ve trend kalitesi: EMA20 {s['ema20']:.4f} — EMA200 {s['ema200']:.4f} farkı ne anlam taşıyor?
• Volatilite & nakit riski: ATR {s['atr']:.4f} — günlük salınım ne kadar büyük?
• Sürdürülebilirlik: Uyum skoru {s['confluence_score']}/100 ile momentum ne kadar güvenilir?

**BORÇ & NAKİT DENGESİ RİSKİ:**
• Stop {s['stop_loss']:.4f} kırılırsa ne anlam taşır?
• Düşüş senaryosu {s['bear_target']:.4f} — nakit baskısı altında ne olur?
• Belirsizlik {s['uncertainty']*100:.0f}/100 — kriz senaryosunda dayanıklılık?

**GERÇEK DEĞER vs DEFTER DEĞERI:**
• {s['price']:.4f} fiyatı, teknik göstergelere göre adil mi?
• RSI {s['rsi']:.1f}: Gerçek bir değerleme var mı yoksa algı mı?

**SONUÇ — NAKİT KALİTESİ NOTU:** [A/B/C/D] — gerekçesiyle birlikte

Türkçe yaz. Analitik ve dürüst ol. Yatırım tavsiyesi değildir.""",

        "kazanc_kalite": f"""Sen kazanç kalitesi analistinin rolündesin. {s['symbol']} için kazanç sürdürülebilirliğini analiz et.

{base}

Önemli prensip: Herkes gelir açıklayabilir. Asıl soru şu: Bu kazançlar tekrarlıyor mu, kalıcı mı, yoksa tek seferlik mi?

Format:
**KAZANÇ KALİTESİ TESTI:**
• Momentum kalıcılığı: MACD {'pozitif — trend devam ediyor' if s['macd_bull'] else 'negatif — momentum zayıflıyor'}. Bu geçici mi, yapısal mı?
• Trend derinliği: Fiyat EMA20/50/200 {'üstünde' if s['price'] > s['ema200'] else 'altında'} — uzun vadeli kazanç trendi güçlü mü?
• Uyum kalitesi: {s['bull_count']} yükseliş / {s['bear_count']} düşüş sinyali — sinyaller tutarlı mı?

**TEK SEFERLİK vs SÜREKLİ KAZANÇ:**
• Hangi teknik göstergeler kalıcı güç işaret ediyor?
• Hangileri geçici bir ralli olduğuna işaret ediyor?
• RSI {s['rsi']:.1f} ve ADX {s['adx']:.1f}: Trend mi yoksa gürültü mü?

**REKABET AVANTAJI (MOAT) DEĞERLENDİRMESİ:**
• Uyum skoru {s['confluence_score']}/100: Piyasanın bu hisseye güveni var mı?
• Bull hedef {s['bull_target']:.4f} gerçekçi mi, yoksa hikâye mi?
• "Anlatamadığın hendek, hendek değildir" — bu şirketin avantajı açıklanabilir mi?

**KAZANÇ SÜRDÜRÜLEBİLİRLİK SKORU:** [1-10] — kısa açıklamayla

**YATIRIMCI UYARISI:** (1 cümle — en büyük risk faktörü)

Türkçe yaz. Eleştirel ve nesnel ol. Yatırım tavsiyesi değildir.""",
    }

    return prompts.get(prompt_type, prompts["wall_street"])


def _claude_prompt_analyze(ctx: dict, prompt_type: str) -> Optional[str]:
    """Call Claude API if key available, else return None."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        prompt = _build_prompt(ctx, prompt_type)
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=700,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception:
        return None


def _template_response(ctx: dict, prompt_type: str) -> str:
    """Rich template fallback when Claude API key not set."""
    s = ctx
    up = s["change_pct"] >= 0
    trend = "yükseliş" if s["price"] > s["ema200"] else "düşüş"
    momentum = "pozitif" if s["macd_bull"] else "negatif"
    rsi_comment = ("aşırı satım" if s["rsi"] < 30 else "aşırı alım" if s["rsi"] > 70 else "nötr")
    score_label = ("güçlü" if s["confluence_score"] >= 65 else "orta" if s["confluence_score"] >= 45 else "zayıf")

    if prompt_type == "wall_street":
        rating = "AL" if s["confluence_score"] >= 60 and s["macd_bull"] else ("SAT" if s["confluence_score"] < 40 else "TUT")
        return (
            f"**DERECELENDİRME: {rating}** — Fiyat Hedefi: {s['target2']:.4f}\n\n"
            f"**ÖZET:** {s['symbol']} {s['price']:.4f} seviyesinde işlem görüyor. "
            f"Uyum skoru {s['confluence_score']}/100 ile {score_label} momentum gösteriyor. "
            f"Uzun vadeli trend {'yukarı' if trend == 'yükseliş' else 'aşağı'} yönlü.\n\n"
            f"**GÜÇLÜ YÖNLER:**\n"
            f"• RSI {s['rsi']:.1f} — {rsi_comment} bölgesinde\n"
            f"• MACD {momentum} momentum sinyali\n"
            f"• Uyum skoru: {s['bull_count']} yükseliş / {s['bear_count']} düşüş sinyali\n\n"
            f"**RİSKLER:**\n"
            f"• Stop-loss seviyesi {s['stop_loss']:.4f} kırılırsa pozisyon tehlikede\n"
            f"• Belirsizlik endeksi {s['uncertainty']*100:.0f}/100\n"
            f"• {s['bear_target']:.4f} fiyatına kadar aşağı baskı riski mevcut\n\n"
            f"**TEKNİK GÖRÜNÜM:** Fiyat EMA200 ({s['ema200']:.4f}) {'üstünde — uzun vadeli boğa' if s['price'] > s['ema200'] else 'altında — uzun vadeli ayı'}. "
            f"Stop {s['stop_loss']:.4f} ile {s['rr_t1']:.1f}x R/R sunuyor.\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "teknik":
        return (
            f"**TREND ANALİZİ:**\n"
            f"• Kısa vade (EMA20 {s['ema20']:.4f}): Fiyat {'üstünde — pozitif' if s['price'] > s['ema20'] else 'altında — negatif'}\n"
            f"• Orta vade (EMA50 {s['ema50']:.4f}): Fiyat {'üstünde — pozitif' if s['price'] > s['ema50'] else 'altında — negatif'}\n"
            f"• Uzun vade (EMA200 {s['ema200']:.4f}): Fiyat {'üstünde — boğa trendi' if s['price'] > s['ema200'] else 'altında — ayı trendi'}\n\n"
            f"**MOMENTUM:**\n"
            f"RSI {s['rsi']:.1f} {rsi_comment} bölgesinde. MACD {momentum} sinyal veriyor. "
            f"Uyum skoru {s['confluence_score']}/100.\n\n"
            f"**KRİTİK SEVİYELER:**\n"
            f"• Destek: {s['stop_loss']:.4f} — {s['ema20']:.4f}\n"
            f"• Direnç: {s['target1']:.4f} — {s['target2']:.4f}\n"
            f"• Stop: {s['stop_loss']:.4f}\n\n"
            f"**SENARYO:**\n"
            f"• Boğa: {s['bull_target']:.4f} (%{s['bull_prob']*100:.0f} olasılık)\n"
            f"• Ayı: {s['bear_target']:.4f} (%{s['bear_prob']*100:.0f} olasılık)\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "giris":
        return (
            f"**MEVCUT POZİSYON DURUMU:**\n"
            f"Fiyat {s['price']:.4f} — {'momentum destekli, dikkatli giriş' if s['macd_bull'] and s['rsi'] < 65 else 'yüksek RSI, pullback beklenebilir' if s['rsi'] > 70 else 'nötr bölge, tetikleyici bekle'}\n\n"
            f"**GİRİŞ SEÇENEKLERİ:**\n"
            f"1. Agresif giriş: {s['price']:.4f} civarı (mevcut fiyat) — MACD onayıyla\n"
            f"2. Konservatif giriş: {s['ema20']:.4f} (EMA20 desteği) — pullback durumunda\n"
            f"3. Kırılım girişi: {s['target1']:.4f} üzeri kapanış — momentum onayıyla\n\n"
            f"**ONAY KRİTERLERİ:**\n"
            f"• Hacim artışı + MACD kesişimi\n"
            f"• RSI 50 üzeri tutunma\n\n"
            f"**POZİSYON YÖNETİMİ:**\n"
            f"• Stop: {s['stop_loss']:.4f}\n"
            f"• H1: {s['target1']:.4f} | H2: {s['target2']:.4f}\n"
            f"• R/R: {s['rr_t1']:.1f}x\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "risk_harita":
        return (
            f"**TEKNİK RİSKLER:**\n"
            f"• RSI {s['rsi']:.1f} — {'aşırı alım, geri çekilme riski' if s['rsi'] > 70 else 'stop altında sürüklenme riski' if s['rsi'] < 35 else 'nötr, izlemeye devam'}\n"
            f"• MACD {'negatif momentum' if not s['macd_bull'] else 'pozitif ancak dönüş izlenmeli'}\n"
            f"• Uyum skoru {s['confluence_score']}/100 — {score_label} sinyal\n\n"
            f"**POZİSYON RİSKİ:**\n"
            f"• Stop-loss: {s['stop_loss']:.4f}\n"
            f"• Maks. kayıp hedefi: {s['bear_target']:.4f}\n"
            f"• Belirsizlik: {s['uncertainty']*100:.0f}/100\n\n"
            f"**PIYASA RİSKİ:**\n"
            f"• ATR {s['atr']:.4f} — günlük max hareket beklentisi\n"
            f"• Yüksek belirsizlik döneminde pozisyon küçültülmeli\n\n"
            f"**RİSK/ÖDÜL KARARI:** Stop {s['stop_loss']:.4f} ile H1 hedefi {s['target1']:.4f} arasında {s['rr_t1']:.1f}x R/R mevcut.\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "bear_bull":
        return (
            f"**BULL CASE — Hedef: {s['bull_target']:.4f} (%{s['bull_prob']*100:.0f} olasılık)**\n"
            f"Koşullar:\n"
            f"• MACD pozitif kesişim devam ediyor\n"
            f"• RSI 50-65 bandında kalıyor\n"
            f"• EMA20 destek tutuyor\n"
            f"Zaman: 4-8 hafta\n\n"
            f"**BASE CASE — Hedef: {s['base_target']:.4f}**\n"
            f"Mevcut uyum skoru ({s['confluence_score']}/100) ve belirsizlik ({s['uncertainty']*100:.0f}/100) göz önüne alındığında en olası senaryo.\n\n"
            f"**BEAR CASE — Hedef: {s['bear_target']:.4f} (%{s['bear_prob']*100:.0f} olasılık)**\n"
            f"Tetikleyiciler:\n"
            f"• Stop {s['stop_loss']:.4f} kırılması\n"
            f"• RSI 30 altına inerek trend kırılması\n"
            f"• EMA200 ({s['ema200']:.4f}) kaybı\n\n"
            f"**POZİSYONLANMA:** Bull olasılığı daha yüksek, ancak stop disiplini kritik.\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "kazanc":
        return (
            f"**MEVCUT DEĞERLEME:**\n"
            f"Fiyat {s['price']:.4f} — EMA200 {s['ema200']:.4f} {'üstünde' if s['price'] > s['ema200'] else 'altında'}. "
            f"Teknik momentum {'güçlü' if s['confluence_score'] >= 60 else 'zayıf'}.\n\n"
            f"**KAZANÇ KALİTESİ:**\n"
            f"• Trend: {'Yükseliş momentum korunuyor' if s['macd_bull'] else 'Düşüş baskısı hakim'}\n"
            f"• Büyüme sürekliliği: Uyum skoru {s['bull_count']} boğa / {s['bear_count']} ayı sinyali\n"
            f"• ATR {s['atr']:.4f} — volatilite {'yüksek' if s['atr'] > s['price'] * 0.03 else 'normal'}\n\n"
            f"**KATALIZÖRLER:**\n"
            f"• Yukarı: EMA20 ({s['ema20']:.4f}) üstünde kapanış korunması\n"
            f"• Aşağı: Stop {s['stop_loss']:.4f} kırılması, MACD dönüşü\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "sektor":
        return (
            f"**SEKTÖRDEK KONUM:**\n"
            f"{s['symbol']} — Uyum skoru {s['confluence_score']}/100, RSI {s['rsi']:.1f}.\n\n"
            f"**GÖRECELİ GÜÇ:**\n"
            f"• Sektöre göre momentum: {'güçlü' if s['macd_bull'] and s['rsi'] > 50 else 'zayıf'}\n"
            f"• Uyum skoru {s['confluence_score']}/100 — sektör ortalamasıyla karşılaştır\n\n"
            f"**YAPISAL AVANTAJLAR:**\n"
            f"• {'EMA200 üstünde — yapısal güç korunuyor' if s['price'] > s['ema200'] else 'EMA200 altında — yapısal kırılım'}\n"
            f"• ATR {s['atr']:.4f} likidite göstergesi\n\n"
            f"**KIRMIZI BAYRAKLAR:**\n"
            f"• Belirsizlik endeksi {s['uncertainty']*100:.0f}/100\n"
            f"• RSI {rsi_comment} bölgesinde\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "beklenti":
        pahali = s['price'] > s['ema200'] and s['rsi'] > 60
        ucuz   = s['price'] < s['ema50'] and s['rsi'] < 45
        deger  = "PAHALI" if pahali else ("UCUZ" if ucuz else "ADİL DEĞERLİ")
        return (
            f"**FİYATIN İÇERDİĞİ BEKLENTILER:**\n"
            f"• Büyüme beklentisi: Uyum skoru {s['confluence_score']}/100 — piyasa {'agresif büyüme' if s['confluence_score'] >= 65 else 'ılımlı büyüme' if s['confluence_score'] >= 45 else 'daralma'} fiyatlıyor\n"
            f"• Momentum: RSI {s['rsi']:.1f} — piyasa {'güçlü devam' if s['rsi'] > 60 else 'yavaşlama' if s['rsi'] < 45 else 'nötr'} bekliyor\n"
            f"• Risk iştahı: Belirsizlik {s['uncertainty']*100:.0f}/100 — {'yüksek belirsizlik fiyatlanmış' if s['uncertainty'] > 0.5 else 'düşük risk algısı hakim'}\n\n"
            f"**BU BEKLENTILER GERÇEKÇİ Mİ?**\n"
            f"• Boğa hedefi {s['bull_target']:.4f} için: {'EMA trendleri destekliyor' if s['price'] > s['ema50'] else 'EMA trendleri desteklemiyor, zorlu'}\n"
            f"• MACD {'pozitif — momentum bu hedefi mümkün kılıyor' if s['macd_bull'] else 'negatif — beklentiler fazla iyimser olabilir'}\n"
            f"• Belirsizlik {s['uncertainty']*100:.0f}/100 olduğunda boğa hedefleri abartılı riski taşır\n\n"
            f"**FIYAT-BEKLENTI UYUMU:** {deger}\n"
            f"{'Fiyat iyimser beklentileri zaten içeriyor, negatif sürpriz riski var' if pahali else 'Fiyat düşük beklentileri yansıtıyor, olumlu sürpriz potansiyeli mevcut' if ucuz else 'Fiyat makul beklentilerle uyumlu görünüyor'}\n\n"
            f"**YATIRIMCI İÇİN SONUÇ:** {s['symbol']} {deger} bölgesinde. "
            f"Stop {s['stop_loss']:.4f} disipliniyle risk yönetimi kritik.\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    elif prompt_type == "nakit_kalite":
        atr_pct  = s['atr'] / s['price'] * 100
        vol_risk = "yüksek" if atr_pct > 3 else ("orta" if atr_pct > 1.5 else "düşük")
        quality  = "A" if s['confluence_score'] >= 65 and s['price'] > s['ema200'] else \
                   "B" if s['confluence_score'] >= 50 else \
                   "C" if s['confluence_score'] >= 35 else "D"
        return (
            f"**NAKIT AKIŞI KALİTESİ:**\n"
            f"• Trend kalitesi: Fiyat EMA200 {'üstünde — güçlü yapısal pozisyon' if s['price'] > s['ema200'] else 'altında — yapısal kırılım riski'}\n"
            f"• EMA farkı: {((s['price']/s['ema200'])-1)*100:+.1f}% — {'uygun bant' if abs((s['price']/s['ema200'])-1) < 0.15 else 'aşırı açılma dikkat'}\n"
            f"• Volatilite: ATR {s['atr']:.4f} (fiyatın %{atr_pct:.1f}'i) — {vol_risk} risk\n"
            f"• Momentum güvenilirliği: Uyum skoru {s['confluence_score']}/100 — {score_label}\n\n"
            f"**BORÇ & NAKİT DENGESİ RİSKİ:**\n"
            f"• Stop {s['stop_loss']:.4f} kırılması: Teknik destek kaybı, satış baskısı artabilir\n"
            f"• Düşüş senaryosu {s['bear_target']:.4f}: %{((s['bear_target']/s['price'])-1)*100:.1f} kayıp potansiyeli\n"
            f"• Belirsizlik {s['uncertainty']*100:.0f}/100 — {'kriz dayanıklılığı zayıf' if s['uncertainty'] > 0.6 else 'orta düzey dayanıklılık' if s['uncertainty'] > 0.35 else 'güçlü dayanıklılık'}\n\n"
            f"**GERÇEK DEĞER ANALİZİ:**\n"
            f"• RSI {s['rsi']:.1f}: {'Değerleme abartılmış olabilir' if s['rsi'] > 70 else 'Değerleme çekici' if s['rsi'] < 35 else 'Adil değerleme bölgesi'}\n"
            f"• {s['bull_count']} yükseliş / {s['bear_count']} düşüş sinyali — piyasa görüşü {'pozitif' if s['bull_count'] > s['bear_count'] else 'negatif'}\n\n"
            f"**NAKİT KALİTESİ NOTU: {quality}** — "
            f"{'Güçlü nakit kalitesi, trend ve momentum uyumlu' if quality == 'A' else 'Orta kalite, dikkatli takip gerekli' if quality == 'B' else 'Zayıf, risk artmış durumda' if quality == 'C' else 'Kritik, yüksek risk bölgesi'}\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )

    else:  # kazanc_kalite
        moat = "güçlü" if s['confluence_score'] >= 65 and s['adx'] > 25 else \
               "orta"  if s['confluence_score'] >= 45 else "zayıf"
        sure = min(10, max(1, round(s['confluence_score'] / 10)))
        return (
            f"**KAZANÇ KALİTESİ TESTI:**\n"
            f"• Momentum kalıcılığı: MACD {'pozitif — trend devam ediyor, yapısal güç' if s['macd_bull'] else 'negatif — momentum zayıflıyor, geçici mi?'}\n"
            f"• Trend derinliği: ADX {s['adx']:.1f} — {'güçlü trend, kazançlar kalıcı' if s['adx'] > 25 else 'zayıf trend, kazançlar kırılgan'}\n"
            f"• Sinyal tutarlılığı: {s['bull_count']} yükseliş / {s['bear_count']} düşüş — {'tutarlı pozitif' if s['bull_count'] >= s['bear_count']*2 else 'karışık sinyaller' if s['bull_count'] > s['bear_count'] else 'negatif baskı'}\n\n"
            f"**TEK SEFERLİK vs SÜREKLİ KAZANÇ:**\n"
            f"• {'EMA200 üstündeki fiyat uzun vadeli kazanç gücünü yansıtıyor' if s['price'] > s['ema200'] else 'EMA200 altı fiyat yapısal sorun işareti — kazançlar kalıcı değil olabilir'}\n"
            f"• RSI {s['rsi']:.1f} + ADX {s['adx']:.1f}: {'Trendin arkasında gerçek güç var' if s['rsi'] > 50 and s['adx'] > 25 else 'Trend zayıf veya aşırı alım — dikkat'}\n\n"
            f"**REKABET AVANTAJI (MOAT):** {moat.upper()}\n"
            f"• Uyum skoru {s['confluence_score']}/100 — piyasanın güven seviyesi {score_label}\n"
            f"• Bull hedefi {s['bull_target']:.4f}: {'Gerçekçi ve desteklenen' if s['macd_bull'] and s['price'] > s['ema50'] else 'Zorlu, katalizör gerektirir'}\n\n"
            f"**KAZANÇ SÜRDÜRÜLEBİLİRLİK SKORU: {sure}/10**\n\n"
            f"**YATIRIMCI UYARISI:** {'Stop ' + str(s['stop_loss']) + ' kırılması kazanç hikayesini bozar — sıkı stop disiplini şart.' if s['uncertainty'] > 0.4 else 'Mevcut momentum korunduğu sürece sürdürülebilir görünüm.'}\n\n"
            f"*Bu analiz yatırım tavsiyesi değildir.*"
        )


@router.post("/{symbol}/claude-analyze")
def claude_analyze(symbol: str, body: PromptRequest):
    symbol = _require_symbol(symbol)
    if body.prompt_type not in PROMPT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown prompt_type: {body.prompt_type}")

    ctx = _build_context(symbol)
    if ctx is None:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    # Try Claude first, fall back to template
    claude_text = _claude_prompt_analyze(ctx, body.prompt_type)
    is_claude = claude_text is not None
    content = claude_text if is_claude else _template_response(ctx, body.prompt_type)

    return {
        "symbol": symbol,
        "prompt_type": body.prompt_type,
        "prompt_label": PROMPT_TYPES[body.prompt_type],
        "is_claude": is_claude,
        "content": content,
    }


@router.get("/prompt-types")
def get_prompt_types():
    return [{"id": k, "label": v} for k, v in PROMPT_TYPES.items()]


# ── Pine Script Generator ──────────────────────────────────────────────────────
class PineScriptRequest(BaseModel):
    description: str          # Kullanıcının doğal dil stratejisi
    symbol: Optional[str] = None


PINE_TEMPLATE = '''//@version=5
strategy("{title}", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// ── Göstergeler ────────────────────────────────────────────────────────────────
rsi = ta.rsi(close, 14)
[macdLine, signalLine, _] = ta.macd(close, 12, 26, 9)
ema20 = ta.ema(close, 20)
ema50 = ta.ema(close, 50)

// ── Giriş Koşulları ────────────────────────────────────────────────────────────
longCondition  = rsi < 35 and ta.crossover(macdLine, signalLine) and close > ema50
shortCondition = rsi > 65 and ta.crossunder(macdLine, signalLine) and close < ema50

// ── İşlemler ───────────────────────────────────────────────────────────────────
if longCondition
    strategy.entry("Long", strategy.long)

if shortCondition
    strategy.close("Long")

// ── Görselleştirme ─────────────────────────────────────────────────────────────
plot(ema20, color=color.blue,   title="EMA 20")
plot(ema50, color=color.orange, title="EMA 50")
plotshape(longCondition,  style=shape.triangleup,   location=location.belowbar, color=color.green, size=size.small)
plotshape(shortCondition, style=shape.triangledown, location=location.abovebar, color=color.red,   size=size.small)

// ── Risk Yönetimi ──────────────────────────────────────────────────────────────
strategy.exit("Exit Long", "Long", loss=close * 0.05, profit=close * 0.10)
'''


def _pine_template_fallback(req: PineScriptRequest) -> str:
    title = f"{req.symbol or 'Analysight'} Stratejisi"
    return PINE_TEMPLATE.replace("{title}", title)


def _pine_claude(req: PineScriptRequest) -> Optional[str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
    except Exception:
        return None

    symbol_ctx = f" ({req.symbol} için optimize et)" if req.symbol else ""

    prompt = f"""Sen bir TradingView Pine Script v5 uzmanısın{symbol_ctx}.

Kullanıcı stratejisi: "{req.description}"

Kurallar:
- Pine Script v5 sözdizimi kullan (//@version=5)
- strategy() ile başla, overlay=true ekle
- Türkçe yorum satırları ekle (// ile)
- RSI, MACD, EMA gibi göstergeleri ta.* ile kullan
- Giriş (strategy.entry) ve çıkış (strategy.close veya strategy.exit) koşullarını yaz
- Stop loss ve take profit ekle (strategy.exit ile)
- Grafik görselleştirmesi ekle (plot, plotshape)
- Sadece çalışabilir Pine Script kodu yaz — açıklama metni yok
- Kod 50-100 satır arasında olsun

Sadece kod bloğu döndür, başka metin yok."""

    try:
        msg = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        code = msg.content[0].text.strip()
        # Kod bloğu işareti varsa temizle
        if code.startswith("```"):
            lines = code.split("\n")
            code = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        return code
    except Exception:
        return None


@router.post("/{symbol}/pine-script")
def generate_pine_script(symbol: str, body: PineScriptRequest):
    """Doğal dil stratejisi → Pine Script v5 kodu."""
    body.symbol = symbol.upper()

    claude_code = _pine_claude(body)
    is_claude = claude_code is not None
    code = claude_code or _pine_template_fallback(body)

    return {
        "symbol": body.symbol,
        "description": body.description,
        "is_claude": is_claude,
        "code": code,
        "instructions": (
            "1. TradingView'ı açın\n"
            "2. Grafik üzerinde 'Pine Editor' sekmesine tıklayın\n"
            "3. Bu kodu yapıştırın\n"
            "4. 'Add to chart' butonuna tıklayın\n"
            "5. Strateji testçisi sekmesinden geçmiş performansı görün"
        ),
    }


@router.post("/pine-script")
def generate_pine_script_generic(body: PineScriptRequest):
    """Sembol olmadan genel Pine Script üretici."""
    claude_code = _pine_claude(body)
    is_claude = claude_code is not None
    code = claude_code or _pine_template_fallback(body)
    return {
        "symbol": body.symbol,
        "description": body.description,
        "is_claude": is_claude,
        "code": code,
        "instructions": (
            "1. TradingView'ı açın\n"
            "2. Grafik üzerinde 'Pine Editor' sekmesine tıklayın\n"
            "3. Bu kodu yapıştırın\n"
            "4. 'Add to chart' butonuna tıklayın"
        ),
    }


# ── Chart Vision Analyzer ──────────────────────────────────────────────────────

_CHART_VISION_TEMPLATE = """Bu grafik görüntüsünü incelediğimizde bazı teknik gözlemler yapılabilir.

**Genel Görünüm**
Fiyat hareketinin yapısına bakıldığında, grafikte belirgin bir trend ya da konsolidasyon bölgesi görülmektedir. Mevcut fiyat seviyesi, önceki hareketin önemli bir noktasına yakın konumlanmış olabilir.

**Dikkat Çekici Noktalar**
- Grafikte görülen mumlar, kısa vadeli alıcı/satıcı dengesini yansıtmaktadır
- Hacim değişimleri varsa fiyat hareketinin gücü hakkında ipucu verir
- Destek ve direnç seviyeleri, olası geri dönüş noktalarını işaret eder

**Not:** Bu analiz bilgi amaçlıdır. Yatırım kararlarınızı kendi araştırmanız ve profesyonel danışmanlık ile destekleyin."""


def _vision_claude(image_b64: str, media_type: str, symbol: Optional[str] = None) -> Optional[str]:
    """Send chart image to Claude claude-3-5-sonnet for vision analysis."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        sym_ctx = f"Sembol: {symbol.upper()}. " if symbol else ""
        prompt = (
            f"{sym_ctx}Bu grafik görüntüsünü Türkçe olarak analiz et. "
            "Şunlara dikkat et:\n"
            "1. Genel fiyat trendi (yükseliş/düşüş/yatay)\n"
            "2. Önemli destek ve direnç seviyeleri\n"
            "3. Belirgin mum formasyonları (hammer, engulfing, doji vb.)\n"
            "4. Varsa indikatör sinyalleri (RSI, MACD, hacim)\n"
            "5. Kısa vadeli beklenti ve olası senaryolar\n\n"
            "Analizini açık, sade ve Türkçe yazar. Madde madde sun. "
            "Yatırım tavsiyesi verme, sadece teknik gözlemleri paylaş."
        )
        msg = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return msg.content[0].text
    except Exception:
        return None


@router.post("/chart-vision")
async def analyze_chart_image(
    image: UploadFile = File(...),
    symbol: Optional[str] = Form(None),
):
    """Accept a chart screenshot and return AI analysis via Claude Vision."""
    content = await image.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")

    media_type = image.content_type or "image/png"
    if media_type not in ("image/png", "image/jpeg", "image/webp", "image/gif"):
        media_type = "image/png"

    image_b64 = base64.standard_b64encode(content).decode("utf-8")

    analysis = _vision_claude(image_b64, media_type, symbol)
    is_claude = analysis is not None
    if not is_claude:
        analysis = _CHART_VISION_TEMPLATE

    return {
        "symbol": symbol.upper() if symbol else None,
        "is_claude": is_claude,
        "analysis": analysis,
    }
