import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import symbols, analysis, risk, insights, scanner as scanner_router, tools as tools_router, news as news_router, macro as macro_router, briefing as briefing_router, research as research_router, calendar as calendar_router, portfolio_ai as portfolio_ai_router, watchlist as watchlist_router, kap as kap_router, heatmap as heatmap_router

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
