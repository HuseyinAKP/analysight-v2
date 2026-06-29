"""
Track A — Tarihsel Olay Veritabanı

1. yfinance'dan hisse IPO'sundan bugüne fiyat verisi çek
2. Günlük %±3 üstü hareketleri tespit et (kırılım günleri)
3. Her kırılım için GDELT API'den o güne ait haberleri çek
4. KAP açıklamalarını da ekle
5. SQLite'a kaydet: events.db

GDELT 2.0 DOC API — tamamen ücretsiz, kayıt gerektirmez.
"""
from __future__ import annotations
import sqlite3
import json
import time
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf

DB_PATH   = Path(__file__).parent.parent / "data" / "events.db"
DB_PATH.parent.mkdir(exist_ok=True)

BREAKOUT_THRESHOLD = 0.03   # %3 günlük hareket = kırılım
GDELT_DELAY        = 0.5    # saniye — rate limit


# ── Veritabanı şeması ─────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS price_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    date        TEXT NOT NULL,
    close       REAL,
    change_pct  REAL NOT NULL,
    direction   TEXT NOT NULL,   -- 'up' / 'down'
    volume_z    REAL,            -- hacim z-score (anomali mi?)
    created_at  TEXT DEFAULT (datetime('now')),
    UNIQUE(symbol, date)
);

CREATE TABLE IF NOT EXISTS event_news (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER REFERENCES price_events(id),
    symbol      TEXT NOT NULL,
    date        TEXT NOT NULL,
    source      TEXT NOT NULL,   -- 'gdelt' / 'kap' / 'yfinance'
    title       TEXT NOT NULL,
    url         TEXT,
    sentiment   REAL,            -- GDELT tone (-10..+10)
    themes      TEXT,            -- JSON array
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_embeddings (
    event_id    INTEGER PRIMARY KEY REFERENCES price_events(id),
    embedding   BLOB NOT NULL,   -- numpy float32 array
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_symbol ON price_events(symbol);
CREATE INDEX IF NOT EXISTS idx_events_date   ON price_events(date);
CREATE INDEX IF NOT EXISTS idx_news_event    ON event_news(event_id);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


# ── Fiyat kırılımlarını bul ───────────────────────────────────────────────────
def detect_breakouts(symbol: str, period: str = "max") -> pd.DataFrame:
    """IPO'dan bugüne kırılım günleri."""
    yf_sym = f"{symbol}.IS" if "." not in symbol and len(symbol) <= 6 else symbol
    try:
        df = yf.download(yf_sym, period=period, progress=False, auto_adjust=True)
        if df is None or len(df) < 30:
            return pd.DataFrame()
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
    except Exception:
        return pd.DataFrame()

    df = df.reset_index()
    df["change_pct"] = df["Close"].pct_change()

    # Hacim z-score
    v = df["Volume"].astype(float).replace(0, np.nan)
    df["volume_z"] = (v - v.rolling(20).mean()) / (v.rolling(20).std() + 1e-9)

    breakouts = df[df["change_pct"].abs() >= BREAKOUT_THRESHOLD].copy()
    breakouts["direction"] = np.where(breakouts["change_pct"] > 0, "up", "down")
    breakouts["symbol"]    = symbol

    date_col = "Date" if "Date" in breakouts.columns else "Datetime"
    breakouts["date_str"] = pd.to_datetime(breakouts[date_col]).dt.strftime("%Y-%m-%d")

    return breakouts[["symbol", "date_str", "Close", "change_pct", "direction", "volume_z"]].rename(
        columns={"Close": "close", "date_str": "date"}
    )


# ── GDELT API ─────────────────────────────────────────────────────────────────
def _gdelt_fetch(query: str, date: str, max_records: int = 10) -> list[dict]:
    """
    GDELT 2.0 DOC API — belirli bir tarih için haber çek.
    https://api.gdeltproject.org/api/v2/doc/doc
    """
    # GDELT tarih aralığı: o gün ±1 gün
    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        start = (dt - timedelta(days=1)).strftime("%Y%m%d%H%M%S")
        end   = (dt + timedelta(days=1)).strftime("%Y%m%d%H%M%S")
    except Exception:
        return []

    params = {
        "query":      query,
        "mode":       "artlist",
        "maxrecords": str(max_records),
        "startdatetime": start,
        "enddatetime":   end,
        "format":     "json",
        "sort":       "tonedesc",   # en güçlü tonlu haberler önce
    }
    url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode(params)

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Analysight/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw = json.loads(resp.read().decode())
        articles = raw.get("articles", [])
        result = []
        for a in articles:
            result.append({
                "title":    a.get("title", ""),
                "url":      a.get("url", ""),
                "sentiment": float(a.get("tone", {}).get("score", 0)) if isinstance(a.get("tone"), dict) else 0.0,
                "themes":   a.get("themes", []),
                "source":   "gdelt",
            })
        return result
    except Exception:
        return []


def _gdelt_query_for_symbol(symbol: str) -> str:
    """Sembol için GDELT arama terimi."""
    symbol_map = {
        "THYAO": "Turkish Airlines THY",
        "GARAN": "Garanti Bank BBVA Turkey",
        "EREGL": "Eregli Demir Celik steel Turkey",
        "TUPRS": "Tupras refinery Turkey",
        "BIMAS": "BIM Turkey retail",
        "ISCTR": "Isbank Turkey",
        "AKBNK": "Akbank Turkey",
        "TCELL": "Turkcell Turkey telecom",
        "SAHOL": "Sabanci Holding Turkey",
        "KCHOL": "Koc Holding Turkey",
        "TOASO": "Tofas Turkey automotive",
        "FROTO": "Ford Otosan Turkey automotive",
        "ASELS": "Aselsan Turkey defense",
        "SISE":  "Sisecam Turkey glass",
        "PETKM": "Petkim Turkey petrochemical",
    }
    name = symbol_map.get(symbol.upper(), f"{symbol} Turkey stock market")
    return name


# ── Olay haberleri çek ve DB'ye yaz ──────────────────────────────────────────
def build_event_database(
    symbol: str,
    verbose: bool = True,
    max_events: int = 200,
) -> dict:
    """
    Bir sembol için tam olay veritabanını oluştur veya güncelle.
    Sadece DB'de olmayan olayları çeker (incremental).
    """
    conn    = get_db()
    query   = _gdelt_query_for_symbol(symbol)
    breaks  = detect_breakouts(symbol)

    if breaks.empty:
        conn.close()
        return {"symbol": symbol, "error": "Fiyat verisi bulunamadı"}

    # Sadece en güçlü hareketler (max_events limit)
    breaks = breaks.reindex(breaks["change_pct"].abs().sort_values(ascending=False).index)
    breaks = breaks.head(max_events)

    inserted_events = 0
    inserted_news   = 0
    skipped         = 0

    for _, row in breaks.iterrows():
        date   = str(row["date"])[:10]
        change = float(row["change_pct"])
        direc  = str(row["direction"])
        close  = float(row["close"]) if not pd.isna(row["close"]) else None
        vol_z  = float(row["volume_z"]) if not pd.isna(row["volume_z"]) else None

        # DB'de var mı?
        existing = conn.execute(
            "SELECT id FROM price_events WHERE symbol=? AND date=?", (symbol, date)
        ).fetchone()

        if existing:
            event_id = existing["id"]
            skipped += 1
        else:
            cur = conn.execute(
                """INSERT INTO price_events (symbol, date, close, change_pct, direction, volume_z)
                   VALUES (?,?,?,?,?,?)""",
                (symbol, date, close, change, direc, vol_z),
            )
            event_id = cur.lastrowid
            inserted_events += 1
            conn.commit()

        # Haber sayısı kontrol
        news_count = conn.execute(
            "SELECT COUNT(*) as c FROM event_news WHERE event_id=?", (event_id,)
        ).fetchone()["c"]

        if news_count > 0:
            continue  # Zaten haberler var

        # GDELT çek
        time.sleep(GDELT_DELAY)
        articles = _gdelt_fetch(query, date, max_records=8)

        for art in articles:
            conn.execute(
                """INSERT OR IGNORE INTO event_news
                   (event_id, symbol, date, source, title, url, sentiment, themes)
                   VALUES (?,?,?,?,?,?,?,?)""",
                (
                    event_id, symbol, date,
                    art["source"], art["title"], art["url"],
                    art["sentiment"], json.dumps(art["themes"]),
                ),
            )
            inserted_news += 1

        conn.commit()

        if verbose and inserted_events % 10 == 0 and inserted_events > 0:
            print(f"  {symbol}: {inserted_events} olay, {inserted_news} haber kaydedildi...")

    conn.close()

    return {
        "symbol":          symbol,
        "total_breakouts": len(breaks),
        "inserted_events": inserted_events,
        "inserted_news":   inserted_news,
        "skipped":         skipped,
    }


# ── Olay sorgulama ────────────────────────────────────────────────────────────
def get_events_for_symbol(symbol: str, limit: int = 50, direction: Optional[str] = None) -> list[dict]:
    """Sembol için kayıtlı olayları döner."""
    conn = get_db()
    q = "SELECT * FROM price_events WHERE symbol=?"
    args = [symbol]
    if direction:
        q += " AND direction=?"
        args.append(direction)
    q += " ORDER BY ABS(change_pct) DESC LIMIT ?"
    args.append(limit)

    rows = conn.execute(q, args).fetchall()
    result = []
    for r in rows:
        event = dict(r)
        news = conn.execute(
            "SELECT * FROM event_news WHERE event_id=? ORDER BY ABS(sentiment) DESC LIMIT 5",
            (r["id"],),
        ).fetchall()
        event["news"] = [dict(n) for n in news]
        result.append(event)

    conn.close()
    return result


def get_event_stats() -> dict:
    """Genel DB istatistikleri."""
    conn = get_db()
    symbols = conn.execute("SELECT DISTINCT symbol FROM price_events").fetchall()
    total_events = conn.execute("SELECT COUNT(*) as c FROM price_events").fetchone()["c"]
    total_news   = conn.execute("SELECT COUNT(*) as c FROM event_news").fetchone()["c"]
    embedded     = conn.execute("SELECT COUNT(*) as c FROM event_embeddings").fetchone()["c"]
    conn.close()
    return {
        "symbols":      [r["symbol"] for r in symbols],
        "total_events": total_events,
        "total_news":   total_news,
        "embedded":     embedded,
    }
