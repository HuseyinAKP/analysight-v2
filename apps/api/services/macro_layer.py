"""
HEI Makro Katman

Verilen tarih için küresel ve Türkiye makro anlık görüntüsünü döner.
Tüm veri yfinance üzerinden çekilir — API key gerekmez.

Makro değişkenler:
  usdtry      USD/TRY kuru
  bist_pct    BIST100 o gün değişimi (%)
  vix         Korku endeksi
  us10y       ABD 10 yıllık tahvil faizi
  gold_pct    Altın 30g değişimi (%)
  oil_pct     Ham petrol 30g değişimi (%)
"""
from __future__ import annotations
import time
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd
import yfinance as yf

_CACHE_TTL = 86400   # 24 saat
_cache: dict[str, tuple[float, dict]] = {}

_TICKERS = {
    "usdtry":  "TRYUSD=X",     # TRY/USD (1/kur için ters çevireceğiz)
    "bist":    "XU100.IS",
    "vix":     "^VIX",
    "us10y":   "^TNX",
    "gold":    "GC=F",
    "oil":     "CL=F",
}

def _close_series(df: pd.DataFrame) -> pd.Series:
    """yfinance multi-level sütun sorununu çözer."""
    close = df["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
    return close.astype(float)

def _fetch_value(ticker_sym: str, date_str: str, window: int = 5) -> Optional[float]:
    """
    Verilen tarih etrafında en yakın kapanış değerini döner.
    """
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        start = (dt - timedelta(days=window)).strftime("%Y-%m-%d")
        end   = (dt + timedelta(days=window + 1)).strftime("%Y-%m-%d")
        df = yf.download(ticker_sym, start=start, end=end, progress=False, auto_adjust=True)
        if df is None or df.empty:
            return None
        df.index = pd.to_datetime(df.index)
        close = _close_series(df)
        target = pd.Timestamp(dt)
        deltas = pd.Series((df.index - target).map(abs), index=df.index)
        idx = int(deltas.argmin())
        return round(float(close.iloc[idx]), 4)
    except Exception:
        return None

def _pct_change_30d(ticker_sym: str, date_str: str) -> Optional[float]:
    """30 günlük değişim (%)."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        start = (dt - timedelta(days=40)).strftime("%Y-%m-%d")
        end   = (dt + timedelta(days=3)).strftime("%Y-%m-%d")
        df = yf.download(ticker_sym, start=start, end=end, progress=False, auto_adjust=True)
        if df is None or len(df) < 5:
            return None
        df.index = pd.to_datetime(df.index)
        close = _close_series(df)
        target = pd.Timestamp(dt)
        now_idx  = int(pd.Series((df.index - target).map(abs), index=df.index).argmin())
        past_dt  = target - timedelta(days=30)
        past_idx = int(pd.Series((df.index - past_dt).map(abs), index=df.index).argmin())
        now_close  = float(close.iloc[now_idx])
        past_close = float(close.iloc[past_idx])
        if past_close == 0:
            return None
        return round((now_close - past_close) / past_close * 100, 2)
    except Exception:
        return None

def get_macro_snapshot(date_str: str) -> dict:
    """
    Verilen tarih için makro anlık görüntüsü.
    Sonuç 24 saat önbelleğe alınır.
    """
    cache_key = f"macro:{date_str}"
    now = time.time()
    if cache_key in _cache:
        ts, data = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    # USD/TRY — yfinance TRYUSD=X döner (TRY cinsinden 1 USD)
    # Aslında USDTRY için TRY=X kullanmak gerekir
    usdtry_val = _fetch_value("TRY=X", date_str)  # TRY=X = USD/TRY
    bist_day   = _fetch_value("XU100.IS", date_str)
    vix_val    = _fetch_value("^VIX", date_str)
    us10y_val  = _fetch_value("^TNX", date_str)
    gold_pct   = _pct_change_30d("GC=F", date_str)
    oil_pct    = _pct_change_30d("CL=F", date_str)

    # BIST günlük değişim
    bist_pct = None
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        start2 = (dt - timedelta(days=5)).strftime("%Y-%m-%d")
        end2   = (dt + timedelta(days=3)).strftime("%Y-%m-%d")
        bdf = yf.download("XU100.IS", start=start2, end=end2, progress=False, auto_adjust=True)
        if bdf is not None and len(bdf) >= 2:
            bdf = bdf.sort_index()
            bdf.index = pd.to_datetime(bdf.index)
            bc = _close_series(bdf)
            target = pd.Timestamp(dt)
            pos = int(pd.Series((bdf.index - target).map(abs), index=bdf.index).argmin())
            if pos > 0:
                c_now  = float(bc.iloc[pos])
                c_prev = float(bc.iloc[pos - 1])
                if c_prev:
                    bist_pct = round((c_now - c_prev) / c_prev * 100, 2)
    except Exception:
        pass

    # USD/TRY yorumu
    usdtry_note = None
    if usdtry_val:
        if usdtry_val > 30:
            usdtry_note = "TL baskı altında"
        elif usdtry_val > 20:
            usdtry_note = "TL zayıf seyir"
        else:
            usdtry_note = "TL görece stabil"

    # VIX yorumu
    vix_note = None
    if vix_val:
        if vix_val > 30:
            vix_note = "Yüksek korku (VIX>30)"
        elif vix_val > 20:
            vix_note = "Orta volatilite"
        else:
            vix_note = "Düşük volatilite ortamı"

    result = {
        "date":         date_str,
        "usdtry":       usdtry_val,
        "usdtry_note":  usdtry_note,
        "bist_day_pct": bist_pct,
        "bist_level":   bist_day,
        "vix":          vix_val,
        "vix_note":     vix_note,
        "us10y":        us10y_val,
        "gold_30d_pct": gold_pct,
        "oil_30d_pct":  oil_pct,
    }

    _cache[cache_key] = (now, result)
    return result
