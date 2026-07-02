import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import symbols, analysis, risk, insights, scanner as scanner_router, tools as tools_router, news as news_router, macro as macro_router, briefing as briefing_router, research as research_router, calendar as calendar_router, portfolio_ai as portfolio_ai_router, watchlist as watchlist_router, kap as kap_router, heatmap as heatmap_router, backtest as backtest_router, correlation as correlation_router, commodity as commodity_router, hei as hei_router, ml as ml_router, portfolio as portfolio_router, events as events_router, ipo as ipo_router, funds as funds_router

# Load .env file if present (for local dev — ANTHROPIC_API_KEY, X_BEARER_TOKEN etc.)
_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    with open(_env_file) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                os.environ.setdefault(_key.strip(), _val.strip().strip('"').strip("'"))

app = FastAPI(title="Analysight API", version="0.1.0")

_FRONTEND_URL = os.getenv("FRONTEND_URL", "")
_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
if _FRONTEND_URL:
    _CORS_ORIGINS.append(_FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(symbols.router, prefix="/api/symbols", tags=["symbols"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(risk.router, prefix="/api/risk", tags=["risk"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(scanner_router.router, prefix="/api", tags=["scanner"])
app.include_router(tools_router.router, prefix="/api", tags=["tools"])
app.include_router(news_router.router, prefix="/api", tags=["news"])
app.include_router(macro_router.router, prefix="/api", tags=["macro"])
app.include_router(briefing_router.router, prefix="/api", tags=["briefing"])
app.include_router(research_router.router, prefix="/api/research", tags=["research"])
app.include_router(calendar_router.router, prefix="/api", tags=["calendar"])
app.include_router(portfolio_ai_router.router, prefix="/api/portfolio-ai", tags=["portfolio-ai"])
app.include_router(watchlist_router.router, prefix="/api/watchlist", tags=["watchlist"])
app.include_router(kap_router.router, prefix="/api/kap", tags=["kap"])
app.include_router(heatmap_router.router, prefix="/api", tags=["heatmap"])
app.include_router(backtest_router.router, tags=["backtest"])
app.include_router(correlation_router.router, tags=["correlation"])
app.include_router(commodity_router.router, prefix="/api/commodity", tags=["b2b-commodity"])
app.include_router(hei_router.router, prefix="/api/hei", tags=["hei"])
app.include_router(ml_router.router, prefix="/api/ml", tags=["ml"])
app.include_router(portfolio_router.router, prefix="/api/portfolio", tags=["portfolio"])
app.include_router(ipo_router.router, prefix="/api/ipo", tags=["ipo"])
app.include_router(funds_router.router, prefix="/api/funds", tags=["funds"])
app.include_router(funds_router.router, prefix="/api/funds", tags=["funds"])
try:
    app.include_router(events_router.router, prefix="/api/events", tags=["events"])
    print("[startup] events router OK")
except Exception as _e:
    print(f"[startup] events router FAILED: {_e}")


@app.on_event("startup")
def _auto_train_on_startup():
    """
    Railway her deploy'da ephemeral filesystem başlatır — modeller kaybolur.
    Startup'ta model yoksa arka planda eğitim başlatılır.
    """
    from services.ml_engine import models_exist
    from routers.ml import _run_training
    import threading
    if not models_exist():
        t = threading.Thread(target=_run_training, daemon=True)
        t.start()


@app.get("/")
def root():
    return {"status": "ok", "service": "analysight-api"}


@app.get("/api/status")
def api_status():
    """API durumu ve aktif entegrasyonları döner."""
    return {
        "status": "ok",
        "service": "analysight-api",
        "integrations": {
            "claude_ai": bool(os.getenv("ANTHROPIC_API_KEY")),
            "twitter_x": bool(os.getenv("X_BEARER_TOKEN")),
            "telegram": bool(os.getenv("TELEGRAM_BOT_TOKEN")),
        },
    }
