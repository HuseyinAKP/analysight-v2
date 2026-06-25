"""
Akıllı Tarayıcı: Tüm sembolleri filtre kombinasyonlarına göre tarar.
Her sembol için tam analiz yapılır ve skor hesaplanır.

BistScaN ilhamıyla Türkçe tarama modelleri eklendi:
- Ucuz Kalmış Hisseler
- Momentum Bombası
- Akıllı Para
- Golden Cross
- Kırılım Avcısı
- Temettü Adayı
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import numpy as np
from .real_data import get_ohlcv, list_symbols
from .technical_analysis import build_indicators, calc_rsi, calc_ema, calc_atr
from .scenario_engine import build_scenarios
from .market_structure import calc_adx, calc_stochastic

# ML engine — opsiyonel import (model henüz eğitilmediyse graceful degrade)
try:
    from .ml_engine import predict as _ml_predict, models_exist as _models_exist
    _ML_AVAILABLE = True
except Exception:
    _ML_AVAILABLE = False
    def _ml_predict(df): return {}
    def _models_exist(): return False


@dataclass
class ScanFilter:
    label: str = ""
    emoji: str = ""
    description: str = ""
    # RSI
    rsi_min: Optional[float] = None
    rsi_max: Optional[float] = None
    # MACD
    macd_bullish: Optional[bool] = None
    # Trend
    price_above_ema20: Optional[bool] = None
    price_above_ema50: Optional[bool] = None
    price_above_ema200: Optional[bool] = None
    # ADX
    adx_min: Optional[float] = None
    # Bollinger
    bb_position: Optional[str] = None     # "near_lower" | "near_upper" | "middle"
    # Uncertainty
    uncertainty_max: Optional[float] = None
    # Bull scenario probability
    bull_prob_min: Optional[float] = None
    # Stochastic
    stoch_signal: Optional[str] = None    # "Al" | "Sat" | "Bekle"
    # Confluence score
    confluence_min: Optional[int] = None
    # ML probability (XGBoost 5 günlük yükseliş olasılığı)
    ml_prob_min: Optional[float] = None   # örn. 60.0 → XGBoost >%60
    ml_prob_max: Optional[float] = None
    # Markets
    markets: list[str] = field(default_factory=list)


PRESET_FILTERS: dict[str, ScanFilter] = {
    # ── Türkçe BistScaN tarzı presetler ─────────────────────────────────────
    "ucuz_kalmis": ScanFilter(
        emoji="",
        label="Ucuz Kalmış Hisseler",
        description="RSI aşırı satımda ama MACD toparlanma sinyali veriyor",
        rsi_min=0, rsi_max=35,
        macd_bullish=True,
        uncertainty_max=65,
    ),
    "momentum_bombasi": ScanFilter(
        emoji="",
        label="Momentum Bombası",
        description="Güçlü trend + yüksek ADX + hacim artışı + MACD yükseliş",
        rsi_min=50, rsi_max=72,
        macd_bullish=True,
        price_above_ema20=True,
        price_above_ema50=True,
        adx_min=25,
    ),
    "akilli_para": ScanFilter(
        emoji="",
        label="Akıllı Para",
        description="Confluence skoru yüksek, birden fazla gösterge hizalı",
        confluence_min=65,
        macd_bullish=True,
        adx_min=18,
    ),
    "golden_cross": ScanFilter(
        emoji="",
        label="Golden Cross",
        description="EMA20 ile EMA50 kesişimi — uzun vadeli yükseliş sinyali",
        price_above_ema20=True,
        price_above_ema50=True,
        price_above_ema200=True,
        rsi_min=40,
        adx_min=15,
    ),
    "kirilim_avcisi": ScanFilter(
        emoji="",
        label="Kırılım Avcısı",
        description="Bollinger üst bandına yakın + güçlü momentum",
        bb_position="near_upper",
        rsi_min=55,
        macd_bullish=True,
        adx_min=20,
    ),
    "dip_avi": ScanFilter(
        emoji="",
        label="Dip Avcısı",
        description="Alt Bollinger + aşırı satım + stokastik al sinyali",
        bb_position="near_lower",
        rsi_max=38,
        stoch_signal="Al",
    ),
    # ── XGBoost ML Presetler ─────────────────────────────────────────────────
    "ml_guclu_yukselis": ScanFilter(
        emoji="🤖",
        label="ML Güçlü Yükseliş",
        description="XGBoost modeli 5 günlük yükseliş olasılığını %62+ görüyor",
        ml_prob_min=62.0,
    ),
    "ml_teknik_uyum": ScanFilter(
        emoji="🧠",
        label="ML + Teknik Uyum",
        description="XGBoost yükseliş sinyali + teknik göstergeler hizalı",
        ml_prob_min=58.0,
        macd_bullish=True,
        price_above_ema50=True,
    ),
    "ml_dip_firsati": ScanFilter(
        emoji="🎯",
        label="ML Dip Fırsatı",
        description="Aşırı satım bölgesinde fakat ML toparlanma bekliyor",
        ml_prob_min=55.0,
        rsi_max=40,
        bb_position="near_lower",
    ),
    "ml_momentum": ScanFilter(
        emoji="⚡",
        label="ML Momentum",
        description="ML güçlü + ADX trend teyidi + MACD yükseliş",
        ml_prob_min=60.0,
        adx_min=22,
        macd_bullish=True,
    ),
    # ── Klasik presetler ─────────────────────────────────────────────────────
    "oversold_bullish": ScanFilter(
        emoji="",
        label="Aşırı Satım + Toparlanma",
        description="RSI < 35 ve MACD yükseliş sinyali",
        rsi_min=0, rsi_max=35,
        macd_bullish=True,
        uncertainty_max=60,
    ),
    "trend_pullback": ScanFilter(
        emoji="",
        label="Trend İçi Geri Çekilme",
        description="Uzun vadeli trend yukarı, kısa vadeli geri çekilme",
        price_above_ema50=True,
        rsi_min=30, rsi_max=50,
        macd_bullish=True,
    ),
    "bb_lower_touch": ScanFilter(
        emoji="",
        label="Alt Bollinger Bandı",
        description="Fiyat alt banda yakın, aşırı satım bölgesi",
        bb_position="near_lower",
        rsi_max=40,
    ),
}

# Preset groups for UI
PRESET_GROUPS = {
    "🤖 XGBoost ML Sinyalleri": ["ml_guclu_yukselis", "ml_teknik_uyum", "ml_dip_firsati", "ml_momentum"],
    "🇹🇷 BistScaN Modelleri": ["ucuz_kalmis", "momentum_bombasi", "akilli_para", "golden_cross", "kirilim_avcisi", "dip_avi"],
    "📊 Klasik Sinyaller": ["oversold_bullish", "trend_pullback", "bb_lower_touch"],
}


def _score_result(
    ind: dict, scenarios: dict, adx_val: float, stoch_k: float,
    ml_prob5: Optional[float] = None,
) -> float:
    """
    0-100 fırsat skoru.
    ML modeli varsa %35 ağırlık alır, yoksa sadece teknik sinyaller kullanılır.
    """
    conf_score = ind.get("confluence", {}).get("score", 50)

    if ml_prob5 is not None:
        # ML ağırlıklı skor: %35 ML, %40 confluence, %25 diğer teknik
        ml_component   = (ml_prob5 - 50) * 0.7 + 50   # 50 merkezli normalize
        conf_component = conf_score
        score = ml_component * 0.35 + conf_component * 0.40
    else:
        score = conf_score * 0.60

    rsi = ind["rsi"]
    if rsi <= 30:   score += 15
    elif rsi <= 40: score += 8
    elif rsi >= 70: score -= 15
    elif rsi >= 60: score -= 5

    bull_prob = scenarios["scenarios"]["bull"]["probability"]
    score += (bull_prob - 30) * 0.15

    if adx_val >= 25: score += 6
    elif adx_val < 15: score -= 4

    return round(min(max(score, 0), 100), 1)


def run_scan(filters: ScanFilter) -> list[dict]:
    results = []
    symbols = list_symbols()

    for meta in symbols:
        symbol = meta["symbol"]

        # Market filter
        if filters.markets and meta["market"] not in filters.markets:
            continue

        try:
            df = get_ohlcv(symbol, days=180)
            if df is None or df.empty:
                continue
            ind = build_indicators(df)
            sc  = build_scenarios(df)
            adx_data   = calc_adx(df)
            stoch_data = calc_stochastic(df)
        except Exception:
            continue

        rsi       = float(ind["rsi"])
        macd      = float(ind["macd"])
        macd_sig  = float(ind["macd_signal"])
        curr      = float(df["close"].iloc[-1])
        ema20     = float(ind["ema20"])
        ema50     = float(ind["ema50"])
        ema200    = float(ind["ema200"])
        bb_upper  = float(ind["bb_upper"])
        bb_lower  = float(ind["bb_lower"])
        bb_range  = bb_upper - bb_lower
        bb_pct    = float((curr - bb_lower) / bb_range * 100) if bb_range else 50.0
        uncertainty = float(sc["uncertainty_index"])
        bull_prob   = float(sc["scenarios"]["bull"]["probability"])
        adx_val     = float(adx_data["adx"])
        stoch_k     = float(stoch_data["k"])
        conf_score  = int(ind.get("confluence", {}).get("score", 50))

        # Apply filters
        if filters.rsi_min        is not None and rsi       < filters.rsi_min:        continue
        if filters.rsi_max        is not None and rsi       > filters.rsi_max:        continue
        if filters.macd_bullish   is True      and macd    <= macd_sig:               continue
        if filters.macd_bullish   is False     and macd    >= macd_sig:               continue
        if filters.price_above_ema20  is True  and curr   <= ema20:                  continue
        if filters.price_above_ema20  is False and curr   >= ema20:                  continue
        if filters.price_above_ema50  is True  and curr   <= ema50:                  continue
        if filters.price_above_ema50  is False and curr   >= ema50:                  continue
        if filters.price_above_ema200 is True  and curr   <= ema200:                 continue
        if filters.price_above_ema200 is False and curr   >= ema200:                 continue
        if filters.adx_min        is not None and adx_val  < filters.adx_min:        continue
        if filters.uncertainty_max is not None and uncertainty > filters.uncertainty_max: continue
        if filters.bull_prob_min  is not None and bull_prob < filters.bull_prob_min:  continue
        if filters.stoch_signal   is not None and stoch_data["signal"] != filters.stoch_signal: continue
        if filters.confluence_min is not None and conf_score < filters.confluence_min: continue
        if filters.bb_position == "near_lower" and bb_pct > 25: continue
        if filters.bb_position == "near_upper" and bb_pct < 75: continue
        if filters.bb_position == "middle"     and (bb_pct < 35 or bb_pct > 65): continue

        # ML tahmin — modeli df kolonları capitalize edilmiş halde bekliyor
        ml_probs: dict = {}
        if _ML_AVAILABLE and _models_exist():
            try:
                df_ml = df.copy()
                df_ml.columns = [c.capitalize() for c in df_ml.columns]
                if "Close" not in df_ml.columns and "close" in df.columns:
                    df_ml = df_ml.rename(columns={"close": "Close", "open": "Open",
                                                   "high": "High", "low": "Low",
                                                   "volume": "Volume"})
                ml_probs = _ml_predict(df_ml)
            except Exception:
                pass

        ml_prob5  = ml_probs.get("prob5")
        ml_prob10 = ml_probs.get("prob10")
        ml_prob20 = ml_probs.get("prob20")

        # ML filtresi uygula
        if filters.ml_prob_min is not None:
            if ml_prob5 is None or ml_prob5 < filters.ml_prob_min:
                continue
        if filters.ml_prob_max is not None:
            if ml_prob5 is None or ml_prob5 > filters.ml_prob_max:
                continue

        score = _score_result(ind, sc, adx_val, stoch_k, ml_prob5)
        prev_close = float(df["close"].iloc[-2]) if len(df) >= 2 else curr
        change_pct = (curr - prev_close) / prev_close * 100 if prev_close else 0.0

        atr = float(ind["atr"])
        results.append({
            "symbol":    symbol,
            "name":      meta["name"],
            "market":    meta["market"],
            "currency":  meta["currency"],
            "price":     round(curr, 4),
            "change_pct": round(change_pct, 2),
            "score":     score,
            "confluence_score": conf_score,
            # ML olasılıkları
            "ml_prob_5d":  ml_prob5,
            "ml_prob_10d": ml_prob10,
            "ml_prob_20d": ml_prob20,
            # Key indicators
            "rsi":          round(rsi, 1),
            "macd_bullish": bool(macd > macd_sig),
            "adx":          round(adx_val, 1),
            "adx_label":    adx_data["label"],
            "stoch_k":      round(stoch_k, 1),
            "stoch_signal": stoch_data["signal"],
            "bb_pct":       round(bb_pct, 1),
            "uncertainty":  int(uncertainty),
            "bull_prob":    int(bull_prob),
            "bear_prob":    int(sc["scenarios"]["bear"]["probability"]),
            "ema_trend":    "above" if curr > ema200 else "below",
            # Risk levels
            "stop_loss":  round(curr - atr * 1.5, 4),
            "target1":    round(curr + atr * 2.0, 4),
            "rr_ratio":   round(2.0 / 1.5, 2),
        })

    return sorted(results, key=lambda x: x["score"], reverse=True)
