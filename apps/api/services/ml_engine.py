"""
XGBoost ML Engine — Analysight

Çoklu sembol geçmişini tarar, 18 teknik özellik çıkarır ve
3 ayrı ufuk (5g/10g/20g) için bağımsız XGBoost sınıflayıcı eğitir.

Kullanım:
  train()  → modelleri ./models/ klasörüne kaydeder
  predict(df) → {'prob5': 0.64, 'prob10': 0.58, 'prob20': 0.51, ...}
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
from sklearn.metrics import roc_auc_score, accuracy_score
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ── Yapılandırma ───────────────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent.parent / "models"
MODEL_DIR.mkdir(exist_ok=True)

HORIZONS   = [5, 10, 20]      # tahmin ufukları (gün)
MIN_ROWS   = 300               # sembol başına minimum gün

# Eğitim seti — BIST + küresel endeksler
TRAIN_SYMBOLS = [
    # BIST büyük şirketler
    "THYAO.IS", "GARAN.IS", "EREGL.IS", "TUPRS.IS", "BIMAS.IS",
    "ISCTR.IS", "AKBNK.IS", "TCELL.IS", "SAHOL.IS", "KCHOL.IS",
    "TOASO.IS", "FROTO.IS", "ASELS.IS", "SISE.IS", "ARCLK.IS",
    "PETKM.IS", "TTKOM.IS", "TAVHL.IS", "EKGYO.IS", "VESTL.IS",
    # Küresel referans — kalıp transferi için
    "AAPL", "MSFT", "NVDA", "JPM", "XOM",
]

# ── Özellik mühendisliği ───────────────────────────────────────────────────────
def _ema(s: pd.Series, n: int) -> pd.Series:
    return s.ewm(span=n, adjust=False).mean()

def _rsi(s: pd.Series, n: int = 14) -> pd.Series:
    d = s.diff()
    g = d.clip(lower=0).rolling(n).mean()
    l = (-d.clip(upper=0)).rolling(n).mean()
    rs = g / l.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _macd(s: pd.Series) -> pd.Series:
    return _ema(s, 12) - _ema(s, 26)

def _bb_position(s: pd.Series, n: int = 20) -> pd.Series:
    mid = s.rolling(n).mean()
    std = s.rolling(n).std()
    upper = mid + 2 * std
    lower = mid - 2 * std
    return (s - lower) / (upper - lower + 1e-9)

def _atr(df: pd.DataFrame, n: int = 14) -> pd.Series:
    h, l, c = df["High"], df["Low"], df["Close"]
    pc = c.shift(1)
    tr = pd.concat([h - l, (h - pc).abs(), (l - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(n).mean()

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    18 özellik içeren DataFrame döner.
    Satır sayısı: orijinal df ile aynı (NaN satırları sonradan temizlenir).
    """
    c = df["Close"].astype(float)
    h = df["High"].astype(float)
    l = df["Low"].astype(float)
    v = df["Volume"].astype(float).replace(0, np.nan)

    rsi14     = _rsi(c, 14)
    rsi7      = _rsi(c, 7)
    macd_val  = _macd(c)
    macd_sig  = _ema(macd_val, 9)
    macd_hist = macd_val - macd_sig

    ema20  = _ema(c, 20)
    ema50  = _ema(c, 50)
    ema200 = _ema(c, 200)

    bb_pos = _bb_position(c)
    atr14  = _atr(df)

    ret1  = c.pct_change(1)
    ret5  = c.pct_change(5)
    ret20 = c.pct_change(20)
    vol20 = ret1.rolling(20).std()

    v_mean = v.rolling(20).mean()
    v_z    = (v - v_mean) / (v.rolling(20).std().replace(0, np.nan) + 1e-9)

    feats = pd.DataFrame({
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
    }, index=c.index)

    return feats

# ── Veri yükleme ───────────────────────────────────────────────────────────────
def _load_symbol(sym: str, period: str = "5y") -> Optional[pd.DataFrame]:
    try:
        df = yf.download(sym, period=period, progress=False, auto_adjust=True)
        if df is None or len(df) < MIN_ROWS:
            return None
        # Multi-level kolon düzelt
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        return df.reset_index()
    except Exception:
        return None

# ── Eğitim ────────────────────────────────────────────────────────────────────
def train(verbose: bool = True) -> dict[str, float]:
    """
    Tüm TRAIN_SYMBOLS'ü indirir, özellik + etiket oluşturur,
    her ufuk için XGBoost eğitir ve model dosyalarını kaydeder.

    Döner: {f"auc_{h}d": float, ...}
    """
    all_X: list[pd.DataFrame] = []
    all_y: dict[int, list] = {h: [] for h in HORIZONS}

    if verbose:
        print(f"[ML] {len(TRAIN_SYMBOLS)} sembol taranıyor...")

    for sym in TRAIN_SYMBOLS:
        df = _load_symbol(sym)
        if df is None:
            if verbose:
                print(f"  SKIP {sym}")
            continue

        feats = build_features(df)

        close = df["Close"].astype(float).values
        n = len(df)

        labels: dict[int, np.ndarray] = {}
        for h in HORIZONS:
            future_ret = np.full(n, np.nan)
            for i in range(n - h):
                base = close[i]
                if base > 0:
                    future_ret[i] = (close[i + h] - base) / base
            labels[h] = future_ret

        # Geçerli satırları al
        feat_arr = feats.values
        valid_mask = ~np.isnan(feat_arr).any(axis=1)
        valid_mask &= ~np.isnan(labels[HORIZONS[0]])

        n_valid = valid_mask.sum()
        if n_valid < 100:
            continue

        all_X.append(feats[valid_mask])
        for h in HORIZONS:
            lbl = labels[h][valid_mask]
            all_y[h].extend((lbl > 0).astype(int).tolist())

        if verbose:
            print(f"  OK  {sym:15s}  {n_valid} gün")

    if not all_X:
        raise RuntimeError("Hiç veri toplanamadı!")

    X = pd.concat(all_X, ignore_index=True)

    # NaN temizle
    X = X.fillna(X.median())

    results: dict[str, float] = {}
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    for h in HORIZONS:
        y = np.array(all_y[h])
        if len(y) != len(X):
            continue

        # TimeSeriesSplit ile cross-val
        tscv = TimeSeriesSplit(n_splits=3)
        auc_scores: list[float] = []

        model = XGBClassifier(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )

        for train_idx, val_idx in tscv.split(X_scaled):
            model.fit(X_scaled[train_idx], y[train_idx])
            y_pred = model.predict_proba(X_scaled[val_idx])[:, 1]
            try:
                auc = roc_auc_score(y[val_idx], y_pred)
                auc_scores.append(auc)
            except Exception:
                pass

        # Tüm veriyle son eğitim
        model.fit(X_scaled, y)

        auc_mean = round(float(np.mean(auc_scores)), 4) if auc_scores else 0.0
        results[f"auc_{h}d"] = auc_mean

        joblib.dump(model, MODEL_DIR / f"xgb_{h}d.pkl")
        if verbose:
            print(f"  [h={h:2d}g] AUC={auc_mean:.4f}  N={len(y)}")

    joblib.dump(scaler, MODEL_DIR / "scaler.pkl")
    joblib.dump(list(X.columns), MODEL_DIR / "feature_names.pkl")

    if verbose:
        print(f"[ML] Modeller kaydedildi → {MODEL_DIR}/")

    return results

# ── Tahmin ────────────────────────────────────────────────────────────────────
_model_cache: dict = {}

def _load_models() -> bool:
    global _model_cache
    required = ["scaler", "feature_names"] + [f"xgb_{h}d" for h in HORIZONS]
    for name in required:
        path = MODEL_DIR / f"{name}.pkl"
        if not path.exists():
            return False
        _model_cache[name] = joblib.load(path)
    return True

def predict(df: pd.DataFrame) -> dict:
    """
    Son günün özelliklerini kullanarak 5/10/20 günlük yükseliş olasılığı döner.
    Model yoksa None döner (fallback: heuristik sigmoid).
    """
    if not _model_cache:
        if not _load_models():
            return {}   # model henüz eğitilmemiş

    feats = build_features(df)
    last_row = feats.iloc[-1:].copy()

    expected_cols = _model_cache["feature_names"]
    last_row = last_row.reindex(columns=expected_cols, fill_value=0)
    last_row = last_row.fillna(0)

    X_scaled = _model_cache["scaler"].transform(last_row.values)

    results = {}
    for h in HORIZONS:
        key = f"xgb_{h}d"
        if key in _model_cache:
            prob = float(_model_cache[key].predict_proba(X_scaled)[0][1])
            results[f"prob{h}"] = round(prob * 100, 1)

    # Feature importance (top 5)
    if "xgb_5d" in _model_cache:
        imp = _model_cache["xgb_5d"].feature_importances_
        top5_idx = np.argsort(imp)[::-1][:5]
        results["top_features"] = [
            {"feature": expected_cols[i], "importance": round(float(imp[i]), 4)}
            for i in top5_idx
        ]

    return results

def models_exist() -> bool:
    return all((MODEL_DIR / f"xgb_{h}d.pkl").exists() for h in HORIZONS)

def model_info() -> dict:
    if not models_exist():
        return {"trained": False}
    import datetime
    mtimes = [(MODEL_DIR / f"xgb_{h}d.pkl").stat().st_mtime for h in HORIZONS]
    trained_at = datetime.datetime.fromtimestamp(max(mtimes)).strftime("%Y-%m-%d %H:%M")
    return {
        "trained": True,
        "trained_at": trained_at,
        "horizons": HORIZONS,
        "model_dir": str(MODEL_DIR),
    }
