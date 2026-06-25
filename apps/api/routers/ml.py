"""
ML Router — eğitim tetikleme ve model durumu.

GET  /api/ml/info     → model bilgisi (eğitildi mi, ne zaman, AUC)
POST /api/ml/train    → eğitimi başlatır (Railway'de ilk deploy sonrası çağrılır)
"""
from __future__ import annotations
import threading
from fastapi import APIRouter, HTTPException, BackgroundTasks

from services.ml_engine import train, model_info, models_exist

router = APIRouter()

_training_lock = threading.Lock()
_training_state: dict = {"running": False, "last_result": None, "error": None}


@router.get("/info")
def ml_info():
    """Model durumu: eğitildi mi, ne zaman, hangi ufuklar."""
    info = model_info()
    info["training_in_progress"] = _training_state["running"]
    info["last_result"]  = _training_state["last_result"]
    info["last_error"]   = _training_state["error"]
    return info


def _run_training():
    global _training_state
    _training_state["running"] = True
    _training_state["error"]   = None
    try:
        results = train(verbose=True)
        _training_state["last_result"] = results
    except Exception as e:
        _training_state["error"] = str(e)
    finally:
        _training_state["running"] = False


@router.post("/train")
def start_training(background_tasks: BackgroundTasks):
    """
    Arka planda eğitim başlatır (~3-5 dakika sürer).
    İkinci çağrıda 'zaten çalışıyor' döner.
    """
    if _training_state["running"]:
        return {"status": "already_running", "message": "Eğitim zaten devam ediyor."}

    background_tasks.add_task(_run_training)
    return {
        "status": "started",
        "message": "Eğitim başladı. /api/ml/info ile durumu takip edin.",
    }


@router.post("/train/sync")
def start_training_sync():
    """
    Senkron eğitim (lokal test için). Railway'de timeout riski var.
    """
    if _training_state["running"]:
        raise HTTPException(status_code=409, detail="Eğitim zaten devam ediyor.")
    _run_training()
    return {
        "status": "completed",
        "result": _training_state["last_result"],
        "error": _training_state["error"],
    }
