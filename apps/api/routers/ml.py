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
_training_v2_state: dict = {"running": False, "last_result": None, "error": None}


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
    """Senkron eğitim (lokal test için). Railway'de timeout riski var."""
    if _training_state["running"]:
        raise HTTPException(status_code=409, detail="Eğitim zaten devam ediyor.")
    _run_training()
    return {
        "status": "completed",
        "result": _training_state["last_result"],
        "error": _training_state["error"],
    }


def _run_training_v2():
    global _training_v2_state
    _training_v2_state["running"] = True
    _training_v2_state["error"]   = None
    try:
        from services.ml_engine_v2 import train as train_v2
        results = train_v2(verbose=True)
        _training_v2_state["last_result"] = results
    except Exception as e:
        _training_v2_state["error"] = str(e)
    finally:
        _training_v2_state["running"] = False


@router.post("/train/v2")
def start_training_v2(background_tasks: BackgroundTasks):
    """
    v2 model eğitimi: 50 sembol, 28 özellik, gelişmiş hedef.
    ~10-20 dakika sürer. /api/ml/info/v2 ile takip edin.
    """
    if _training_v2_state["running"]:
        return {"status": "already_running", "message": "v2 eğitim zaten devam ediyor."}

    background_tasks.add_task(_run_training_v2)
    return {
        "status": "started",
        "message": "v2 eğitim başladı. /api/ml/info/v2 ile takip edin.",
    }


@router.get("/info/v2")
def ml_info_v2():
    """v2 model durumu ve AUC sonuçları."""
    import json
    from pathlib import Path
    results_path = Path(__file__).parent.parent / "models" / "training_results_v2.json"
    saved = {}
    if results_path.exists():
        try:
            saved = json.loads(results_path.read_text())
        except Exception:
            pass
    return {
        "training_in_progress": _training_v2_state["running"],
        "last_result":  _training_v2_state["last_result"] or saved,
        "last_error":   _training_v2_state["error"],
        "model_version": "v2",
    }
