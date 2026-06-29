"""
Track B — Olay Benzerlik Motoru (Embedding + Cosine Similarity)

1. sentence-transformers ile metin → 384 boyutlu vektör
2. Tarihsel olayları vektörleştir, SQLite'a kaydet
3. Güncel haber geldiğinde en benzer geçmiş olayları bul
4. O olaylardan sonra fiyat ne yaptı → forecast

Model: paraphrase-multilingual-MiniLM-L12-v2
  - Türkçe dahil 50+ dil
  - 384 boyut
  - ~120MB, GPU gerektirmez
  - Ücretsiz (HuggingFace)
"""
from __future__ import annotations
import json
import sqlite3
import struct
from pathlib import Path
from typing import Optional

import numpy as np

# Lazy import — ilk kullanımda yükle
_model = None
_model_name = "paraphrase-multilingual-MiniLM-L12-v2"

DB_PATH = Path(__file__).parent.parent / "data" / "events.db"


def _get_model():
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
        except ImportError:
            raise RuntimeError(
                "sentence-transformers kurulu değil. "
                "Railway'de requirements.txt'e eklenmeli: sentence-transformers>=2.2.0"
            )
    return _model


def _get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── Embedding yardımcıları ────────────────────────────────────────────────────
def _embed_text(text: str) -> np.ndarray:
    """Tek metin → float32 vektör."""
    model = _get_model()
    return model.encode(text, convert_to_numpy=True).astype(np.float32)


def _embed_texts(texts: list[str]) -> np.ndarray:
    """Metin listesi → vektör matrisi."""
    model = _get_model()
    return model.encode(texts, convert_to_numpy=True, batch_size=32).astype(np.float32)


def _to_blob(arr: np.ndarray) -> bytes:
    return arr.astype(np.float32).tobytes()


def _from_blob(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ── Olayları vektörleştir ─────────────────────────────────────────────────────
def embed_events(symbol: Optional[str] = None, verbose: bool = True) -> dict:
    """
    DB'deki event_news'leri okur, her olay için birleşik metin oluşturur,
    embedding hesaplar ve event_embeddings tablosuna yazar.

    Birleşik metin = tüm haberlerin başlıkları + GDELT temaları
    """
    conn = _get_db()

    q = """
        SELECT pe.id, pe.symbol, pe.date, pe.change_pct, pe.direction,
               GROUP_CONCAT(en.title, ' | ') as titles,
               GROUP_CONCAT(en.themes, ' ') as themes_raw
        FROM price_events pe
        LEFT JOIN event_news en ON en.event_id = pe.id
        WHERE pe.id NOT IN (SELECT event_id FROM event_embeddings)
    """
    args = []
    if symbol:
        q += " AND pe.symbol = ?"
        args.append(symbol)
    q += " GROUP BY pe.id ORDER BY ABS(pe.change_pct) DESC"

    rows = conn.execute(q, args).fetchall()

    if not rows:
        conn.close()
        return {"embedded": 0, "message": "Yeni gömülecek olay yok"}

    if verbose:
        print(f"[Embed] {len(rows)} olay vektörleştiriliyor...")

    texts = []
    row_ids = []
    for r in rows:
        titles = r["titles"] or ""
        themes = r["themes_raw"] or ""
        # Temalardaki JSON array'leri düzelt
        try:
            theme_list = []
            for t in themes.split(" "):
                t = t.strip()
                if t.startswith("["):
                    theme_list.extend(json.loads(t))
                elif t:
                    theme_list.append(t)
            themes_str = " ".join(theme_list[:20])
        except Exception:
            themes_str = themes[:200]

        combined = f"{r['direction']} {abs(r['change_pct'])*100:.1f}% | {titles[:500]} | {themes_str[:200]}"
        texts.append(combined)
        row_ids.append(r["id"])

    # Batch embedding
    embeddings = _embed_texts(texts)

    for eid, emb in zip(row_ids, embeddings):
        conn.execute(
            "INSERT OR REPLACE INTO event_embeddings (event_id, embedding) VALUES (?,?)",
            (eid, _to_blob(emb)),
        )

    conn.commit()
    conn.close()

    if verbose:
        print(f"[Embed] {len(row_ids)} olay vektörleştirildi.")

    return {"embedded": len(row_ids)}


# ── Benzerlik arama ───────────────────────────────────────────────────────────
def find_similar_events(
    query_text: str,
    symbol: Optional[str] = None,
    top_k: int = 5,
    min_similarity: float = 0.35,
) -> list[dict]:
    """
    Güncel haber metnini geçmiş olaylarla karşılaştır.
    En benzer top_k olayı döner + o olaylardan sonra fiyat ne yaptı.
    """
    conn = _get_db()

    # Tüm embedding'leri yükle
    q = """
        SELECT ee.event_id, ee.embedding,
               pe.symbol, pe.date, pe.change_pct, pe.direction, pe.close, pe.volume_z
        FROM event_embeddings ee
        JOIN price_events pe ON pe.id = ee.event_id
    """
    args = []
    if symbol:
        q += " WHERE pe.symbol = ?"
        args.append(symbol)

    rows = conn.execute(q, args).fetchall()
    if not rows:
        conn.close()
        return []

    # Query vektörü
    query_emb = _embed_text(query_text)

    # Tüm event embedding'leri
    event_embs = np.stack([_from_blob(r["embedding"]) for r in rows])
    event_ids  = [r["event_id"] for r in rows]

    # Cosine similarity (batch)
    norms = np.linalg.norm(event_embs, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1e-9, norms)
    normed = event_embs / norms
    q_norm = query_emb / (np.linalg.norm(query_emb) + 1e-9)
    sims = normed @ q_norm

    # Top-K
    top_idx = np.argsort(sims)[::-1][:top_k * 2]

    results = []
    for idx in top_idx:
        sim = float(sims[idx])
        if sim < min_similarity:
            continue
        r = rows[idx]
        eid = r["event_id"]

        # Haberler
        news = conn.execute(
            """SELECT title, url, sentiment, themes, source
               FROM event_news WHERE event_id=?
               ORDER BY ABS(sentiment) DESC LIMIT 5""",
            (eid,),
        ).fetchall()

        results.append({
            "event_id":   eid,
            "symbol":     r["symbol"],
            "date":       r["date"],
            "change_pct": round(float(r["change_pct"]) * 100, 2),
            "direction":  r["direction"],
            "similarity": round(sim, 3),
            "volume_anomaly": round(float(r["volume_z"]), 2) if r["volume_z"] else None,
            "news": [
                {
                    "title":     n["title"],
                    "url":       n["url"],
                    "sentiment": n["sentiment"],
                    "themes":    json.loads(n["themes"]) if n["themes"] else [],
                    "source":    n["source"],
                }
                for n in news
            ],
        })
        if len(results) >= top_k:
            break

    conn.close()
    return results


# ── Tahmin üret ───────────────────────────────────────────────────────────────
def generate_forecast(
    query_text: str,
    symbol: Optional[str] = None,
    top_k: int = 5,
) -> dict:
    """
    Güncel haberlere göre tarihsel analoji tahmini.

    Döner:
      - similar_events: benzer geçmiş olaylar
      - forecast_direction: 'up' / 'down' / 'uncertain'
      - forecast_magnitude: tahmini hareket büyüklüğü (%)
      - confidence: 0-100
      - reasoning: neden bu tahmini yapıyoruz
    """
    similars = find_similar_events(query_text, symbol=symbol, top_k=top_k)

    if not similars:
        return {
            "similar_events":      [],
            "forecast_direction":  "uncertain",
            "forecast_magnitude":  0.0,
            "confidence":          0,
            "reasoning":           "Benzer tarihsel olay bulunamadı.",
        }

    # Ağırlıklı oy: similarity * change_pct
    up_score   = 0.0
    down_score = 0.0
    magnitudes = []

    for ev in similars:
        w = ev["similarity"]
        mag = abs(ev["change_pct"])
        if ev["direction"] == "up":
            up_score += w
        else:
            down_score += w
        magnitudes.append(mag * w)

    total_score = up_score + down_score + 1e-9
    up_pct   = up_score / total_score * 100
    down_pct = down_score / total_score * 100

    avg_magnitude = sum(magnitudes) / sum(ev["similarity"] for ev in similars)

    if up_pct > 60:
        direction = "up"
        confidence = int(min(up_pct, 95))
    elif down_pct > 60:
        direction = "down"
        confidence = int(min(down_pct, 95))
    else:
        direction = "uncertain"
        confidence = int(max(up_pct, down_pct))

    # Açıklama
    top_ev = similars[0]
    reasoning = (
        f"En benzer olay: {top_ev['symbol']} {top_ev['date']} "
        f"({top_ev['change_pct']:+.1f}%, benzerlik: {top_ev['similarity']:.0%}). "
        f"{len(similars)} tarihsel analoji: %{up_pct:.0f} yükseliş / %{down_pct:.0f} düşüş. "
        f"Tahmini hareket büyüklüğü: ±{avg_magnitude:.1f}%."
    )

    return {
        "similar_events":     similars,
        "forecast_direction":  direction,
        "forecast_magnitude":  round(avg_magnitude, 2),
        "up_probability":      round(up_pct, 1),
        "down_probability":    round(down_pct, 1),
        "confidence":          confidence,
        "reasoning":           reasoning,
    }
