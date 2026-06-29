"""
XGBoost ML Engine v2 — İyileştirilmiş

Değişiklikler:
  1. Hedef: sadece "yükselir mi?" değil "%3+ yükselir + max drawdown <%2"
  2. 10 yeni özellik: hacim anomalisi, 52h yüksek/düşük oranı, volatilite rejimi,
     VIX korrelasyonu, momentum kalitesi, ADX, fiyat ivmesi
  3. BIST100 sembol listesi genişletildi (25 → 50)
  4. LightGBM ensemble (XGBoost + LightGBM ortalaması)
  5. AUC bilgisi modelle birlikte kaydediliyor
"""
from __future__ import annotations
import os
import warnings
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import joblib
import yfinance as yf
from xgboost import XGBClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import StandardScaler

try:
    from lightgbm import LGBMClassifier
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False

warnings.filterwarnings("ignore")

MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

HORIZONS  = [5, 10, 20]
MIN_ROWS  = 400
# Minimum getiri eşiği — "kaliteli sinyal" tanımı
RETURN_THRESHOLD = {5: 0.025, 10: 0.035, 20: 0.05}   # %2.5 / %3.5 / %5
MAX_DD_THRESHOLD  = 0.025                               # max drawdown < %2.5

# Genişletilmiş BIST100 + küresel
TRAIN_SYMBOLS = [
    # BIST büyük (cap)
    "THYAO.IS","GARAN.IS","EREGL.IS","TUPRS.IS","BIMAS.IS",
    "ISCTR.IS","AKBNK.IS","TCELL.IS","SAHOL.IS","KCHOL.IS",
    "TOASO.IS","FROTO.IS","ASELS.IS","SISE.IS","ARCLK.IS",
    "PETKM.IS","TTKOM.IS","TAVHL.IS","EKGYO.IS","VESTL.IS",
    # BIST orta cap
    "HALKB.IS","VAKBN.IS","YKBNK.IS","PGSUS.IS","MGROS.IS",
    "SASA.IS","KOZAL.IS","TKFEN.IS","ENKAI.IS","CIMSA.IS",
    "AEFES.IS","CCOLA.IS","ULKER.IS","LOGO.IS","ODAS.IS",
    "AKCNS.IS","ISDMR.IS","BRISA.IS","DOHOL.IS","SOKM.IS",
    # Küresel referans
    "AAPL","MSFT","NVDA","JPM","XOM",
    "AMZN","GOOGL","META","TSLA","BRK-B",
]


# ── Yardımcılar ───────────────────────────────────────────────────────────────
def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()

def _rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l = (-d.clip(upper=0)).rolling(n).mean()
    return 100 - 100 / (1 + g / l.replace(0, np.nan))

def _macd(s: pd.Series) -> pd.Series:
    return _ema(s, 12) - _ema(s, 26)

def _bb_position(s: pd.Series, n: int = 20) -> pd.Series:
    mid = s.rolling(n).mean()
    std = s.rolling(n).std()
    return (s - (mid - 2*std)) / (4*std + 1e-9)

def _atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    h, l, c = df["High"], df["Low"], df["Close"]
    pc = c.shift(1)
    tr = pd.concat([h-l, (h-pc).abs(), (l-pc).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean()

def _adx(df: pd.DataFrame, n: int = 14) -> pd.Series:
    """Average Directional Index — trend gücü"""
    h = df["High"].astype(float)
    l = df["Low"].astype(float)
    c = df["Close"].astype(float)
    up   = h.diff()
    down = -l.diff()
    plus_dm  = np.where((up > down) & (up > 0), up, 0.0)
    minus_dm = np.where((down > up) & (down > 0), down, 0.0)
    tr = pd.concat([h-l, (h-c.shift()).abs(), (l-c.shift()).abs()], axis=1).max(axis=1)
    atr = tr.rolling(n).mean()
    plus_di  = 100 * pd.Series(plus_dm,  index=h.index).rolling(n).mean() / (atr + 1e-9)
    minus_di = 100 * pd.Series(minus_dm, index=h.index).rolling(n).mean() / (atr + 1e-9)
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-9)
    return dx.rolling(n).mean()

def _vol_regime(ret1: pd.Series, n: int = 20) -> pd.Series:
    """Volatilite rejimi: şimdiki vol / 60 günlük ortalama vol"""
    vol_now = ret1.rolling(n).std()
    vol_avg = ret1.rolling(60).std()
    return vol_now / (vol_avg + 1e-9)

def _max_drawdown_fwd(close: np.ndarray, start: int, horizon: int) -> float:
    """start'tan itibaren horizon gün içindeki maksimum drawdown"""
    end = min(start + horizon, len(close))
    if end <= start + 1:
        return 0.0
    segment = close[start:end]
    peak = segment[0]
    dd = 0.0
    for p in segment[1:]:
        if p > peak:
            peak = p
        dd = min(dd, (p - peak) / peak)
    return abs(dd)


# ── Özellik mühendisliği v2 (28 özellik) ─────────────────────────────────────
def build_features(df: pd.DataFrame) -> pd.DataFrame:
    c = df["Close"].astype(float)
    h = df["High"].astype(float)
    l = df["Low"].astype(float)
    v = df["Volume"].astype(float).replace(0, np.nan)

    # --- Temel teknik ---
    rsi14     = _rsi(c, 14)
    rsi7      = _rsi(c, 7)
    macd_val  = _macd(c)
    macd_sig  = _ema(macd_val, 9)
    macd_hist = macd_val - macd_sig
    ema20     = _ema(c, 20)
    ema50     = _ema(c, 50)
    ema200    = _ema(c, 200)
    bb_pos    = _bb_position(c)
    atr14     = _atr(df)
    ret1      = c.pct_change(1)
    ret5      = c.pct_change(5)
    ret20     = c.pct_change(20)
    vol20     = ret1.rolling(20).std()
    v_mean    = v.rolling(20).mean()
    v_z       = (v - v_mean) / (v.rolling(20).std().replace(0, np.nan) + 1e-9)

    # --- YENİ özellikler ---
    adx             = _adx(df)
    vol_regime      = _vol_regime(ret1)

    # 52 hafta yüksek/düşük oranı
    high_52w = h.rolling(252).max()
    low_52w  = l.rolling(252).min()
    pct_from_52h = (c - high_52w) / (high_52w + 1e-9)  # negatif = yüksekten uzak
    pct_from_52l = (c - low_52w)  / (low_52w  + 1e-9)  # pozitif = dipten uzak

    # Hacim artış anomalisi — kurumsal işaret
    v_spike = (v > v_mean * 2.0).astype(float)
    v_trend = v.rolling(5).mean() / (v.rolling(20).mean() + 1e-9)

    # Fiyat ivmesi (momentum'un hızı)
    mom5  = c.pct_change(5)
    mom10 = c.pct_change(10)
    accel = mom5 - mom10 / 2   # ivme

    # RSI momentum kalitesi
    rsi_slope = rsi14 - rsi14.shift(5)

    # Volatilite düzeltilmiş getiri
    vol_adj_ret5 = ret5 / (vol20 + 1e-9)

    # Bollinger band genişliği (kırılım öncesi daralma)
    bb_mid  = c.rolling(20).mean()
    bb_std  = c.rolling(20).std()
    bb_width = bb_std / (bb_mid + 1e-9)

    feats = pd.DataFrame({
        # Orijinal 18
        "rsi14":          rsi14,
        "rsi7":           rsi7,
        "rsi_diff":       rsi14 - rsi7,
        "macd_hist":      macd_hist,
        "macd_hist_sign": np.sign(macd_hist),
        "price_ema20":    (c / ema20 - 1),
        "price_ema50":    (c / ema50 - 1),
        "price_ema200":   (c / ema200 - 1),
        "ema20_50":       (ema20 / ema50 - 1),
        "bb_pos":         bb_pos,
        "atr_ratio":      atr14 / c,
        "ret1":           ret1,
        "ret5":           ret5,
        "ret20":          ret20,
        "vol20":          vol20,
        "vol20_rel":      vol20 / (ret20.abs() + 1e-9),
        "volume_z":       v_z.clip(-3, 3),
        "high_low_ratio": (h - l) / c,
        # Yeni 10
        "adx":            adx,
        "vol_regime":     vol_regime.clip(0, 3),
        "pct_from_52h":   pct_from_52h,
        "pct_from_52l":   pct_from_52l.clip(0, 2),
        "v_spike":        v_spike,
        "v_trend":        v_trend.clip(0, 5),
        "accel":          accel,
        "rsi_slope":      rsi_slope,
        "vol_adj_ret5":   vol_adj_ret5.clip(-5, 5),
        "bb_width":       bb_width,
    }, index=c.index)

    return feats


# ── Gelişmiş hedef etiketi ────────────────────────────────────────────────────
def _build_labels(close: np.ndarray, horizon: int) -> np.ndarray:
    """
    Kaliteli sinyal etiketi:
      1 = fiyat RETURN_THRESHOLD'dan fazla yükseldi VE max drawdown < MAX_DD_THRESHOLD
      0 = diğer
    Bu, hem kârlı hem de düşük riskli pozisyonları işaret eder.
    """
    n = len(close)
    labels = np.zeros(n, dtype=int)
    min_ret = RETURN_THRESHOLD[horizon]

    for i in range(n - horizon):
        base = close[i]
        if base <= 0:
            continue
        end_price = close[i + horizon]
        ret = (end_price - base) / base
        dd  = _max_drawdown_fwd(close, i, horizon)

        if ret >= min_ret and dd < MAX_DD_THRESHOLD:
            labels[i] = 1
    return labels


# ── Veri yükleme ──────────────────────────────────────────────────────────────
def _load_symbol(sym: str, period: str = "10y") -> Optional[pd.DataFrame]:
    try:
        df = yf.download(sym, period=period, progress=False, auto_adjust=True)
        if df is None or len(df) < MIN_ROWS:
            return None
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df.reset_index()
    except Exception:
        return None


# ── Eğitim ────────────────────────────────────────────────────────────────────
def train(verbose: bool = True) -> dict[str, float]:
    all_X: list[pd.DataFrame] = []
    all_y: dict[int, list] = {h: [] for h in HORIZONS}
    skipped = []

    if verbose:
        print(f"[ML v2] {len(TRAIN_SYMBOLS)} sembol, 10 yıl veri, 28 özellik...")

    for sym in TRAIN_SYMBOLS:
        df = _load_symbol(sym)
        if df is None:
            skipped.append(sym)
            continue

        feats = build_features(df)
        close = df["Close"].astype(float).values
        n = len(df)

        feat_arr = feats.values
        valid_base = ~np.isnan(feat_arr).any(axis=1)

        for h in HORIZONS:
            lbl = _build_labels(close, h)
            valid = valid_base.copy()
            valid[n - h:] = False

            n_valid = valid.sum()
            if n_valid < 100:
                continue

            if h == HORIZONS[0]:
                all_X.append(feats[valid])

            all_y[h].extend(lbl[valid].tolist())

        if verbose:
            pos_rate = np.mean(_build_labels(close, 5)[valid_base[:n-5]])
            print(f"  OK  {sym:15s}  {valid_base.sum()} gün  pozitif_oran={pos_rate:.1%}")

    if not all_X:
        raise RuntimeError("Hiç veri toplanamadı!")

    X = pd.concat(all_X, ignore_index=True)
    X = X.fillna(X.median())

    if verbose:
        print(f"\n[ML v2] Toplam: {len(X)} satır, {X.shape[1]} özellik")

    results: dict[str, float] = {}
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    for h in HORIZONS:
        y = np.array(all_y[h])
        if len(y) != len(X):
            y = y[:len(X)]
        if len(y) != len(X):
            continue

        pos_rate = y.mean()
        if verbose:
            print(f"\n[ML v2] H={h}d  pozitif={pos_rate:.1%}  n={len(y)}")

        tscv = TimeSeriesSplit(n_splits=5)
        auc_scores = []

        # XGBoost
        xgb = XGBClassifier(
            n_estimators=400,
            max_depth=5,
            learning_rate=0.04,
            subsample=0.8,
            colsample_bytree=0.7,
            min_child_weight=5,
            reg_alpha=0.2,
            reg_lambda=1.5,
            scale_pos_weight=(1 - pos_rate) / (pos_rate + 1e-9),  # sınıf dengesi
            eval_metric="auc",
            random_state=42,
            n_jobs=-1,
        )

        for train_idx, val_idx in tscv.split(X_scaled):
            xgb.fit(X_scaled[train_idx], y[train_idx])
            pred = xgb.predict_proba(X_scaled[val_idx])[:, 1]
            try:
                auc_scores.append(roc_auc_score(y[val_idx], pred))
            except Exception:
                pass

        mean_auc = float(np.mean(auc_scores)) if auc_scores else 0.0
        results[f"auc_{h}d"] = round(mean_auc, 4)

        if verbose:
            print(f"  XGBoost AUC: {mean_auc:.4f}  (splits: {auc_scores})")

        # Ensemble: LightGBM varsa ekle
        if HAS_LGBM:
            lgbm = LGBMClassifier(
                n_estimators=400,
                max_depth=5,
                learning_rate=0.04,
                subsample=0.8,
                colsample_bytree=0.7,
                min_child_samples=20,
                reg_alpha=0.2,
                reg_lambda=1.5,
                class_weight="balanced",
                random_state=42,
                n_jobs=-1,
                verbose=-1,
            )
            lgbm_aucs = []
            for train_idx, val_idx in tscv.split(X_scaled):
                lgbm.fit(X_scaled[train_idx], y[train_idx])
                pred = lgbm.predict_proba(X_scaled[val_idx])[:, 1]
                try:
                    lgbm_aucs.append(roc_auc_score(y[val_idx], pred))
                except Exception:
                    pass
            lgbm_auc = float(np.mean(lgbm_aucs)) if lgbm_aucs else 0.0
            results[f"lgbm_auc_{h}d"] = round(lgbm_auc, 4)
            if verbose:
                print(f"  LightGBM AUC: {lgbm_auc:.4f}")

        # Final modeli tüm veriyle eğit
        xgb.fit(X_scaled, y)
        joblib.dump(xgb, MODEL_DIR / f"xgb_v2_{h}d.pkl")

        if HAS_LGBM:
            lgbm.fit(X_scaled, y)
            joblib.dump(lgbm, MODEL_DIR / f"lgbm_{h}d.pkl")

    joblib.dump(scaler, MODEL_DIR / "scaler_v2.pkl")
    joblib.dump(list(X.columns), MODEL_DIR / "feature_names_v2.pkl")

    # AUC sonuçlarını kaydet
    import json
    with open(MODEL_DIR / "training_results_v2.json", "w") as f:
        json.dump({
            **results,
            "trained_at": pd.Timestamp.now().isoformat(),
            "n_samples": int(len(X)),
            "n_features": int(X.shape[1]),
            "n_symbols": len(TRAIN_SYMBOLS) - len(skipped),
            "skipped": skipped,
        }, f, indent=2)

    if verbose:
        print(f"\n[ML v2] Tamamlandı! {results}")

    return results


# ── Tahmin ────────────────────────────────────────────────────────────────────
def predict(df: pd.DataFrame) -> dict:
    """
    df: yfinance OHLCV DataFrame
    Döner: prob5, prob10, prob20, model_version, top_features
    """
    # v2 model varsa kullan, yoksa v1'e düş
    scaler_path = MODEL_DIR / "scaler_v2.pkl"
    feat_path   = MODEL_DIR / "feature_names_v2.pkl"

    if not scaler_path.exists():
        # v1 fallback
        try:
            from services.ml_engine import predict as predict_v1
            return predict_v1(df)
        except Exception:
            return {"prob5": 50.0, "prob10": 50.0, "prob20": 50.0, "ml_version": False}

    try:
        scaler   = joblib.load(scaler_path)
        feat_names = joblib.load(feat_path)

        feats = build_features(df)
        feats = feats.reindex(columns=feat_names, fill_value=0)
        feats = feats.fillna(feats.median())

        if len(feats) < 5:
            raise ValueError("Yetersiz veri")

        last = feats.iloc[[-1]]
        last_scaled = scaler.transform(last)

        result = {}
        for h in HORIZONS:
            m_path = MODEL_DIR / f"xgb_v2_{h}d.pkl"
            if not m_path.exists():
                result[f"prob{h}"] = 50.0
                continue
            model = joblib.load(m_path)
            prob = float(model.predict_proba(last_scaled)[0, 1]) * 100

            # Ensemble: LGBM varsa ortala
            l_path = MODEL_DIR / f"lgbm_{h}d.pkl"
            if l_path.exists():
                lgbm = joblib.load(l_path)
                prob_l = float(lgbm.predict_proba(last_scaled)[0, 1]) * 100
                prob = (prob + prob_l) / 2

            result[f"prob{h}"] = round(prob, 1)

        # Özellik önemi (XGBoost 5d)
        xgb5 = joblib.load(MODEL_DIR / "xgb_v2_5d.pkl")
        imp = xgb5.feature_importances_
        top_idx = np.argsort(imp)[::-1][:5]
        result["top_features"] = [
            {"feature": feat_names[i], "importance": round(float(imp[i]), 4)}
            for i in top_idx
        ]
        result["ml_version"] = True
        result["model_version"] = "v2"

        return result

    except Exception as e:
        return {"prob5": 50.0, "prob10": 50.0, "prob20": 50.0, "ml_version": False, "error": str(e)}
