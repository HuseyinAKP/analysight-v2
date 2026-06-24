#!/bin/bash
# Analysight — FastAPI backend başlatıcı
cd "$(dirname "$0")/apps/api"
echo "🚀 Analysight API başlatılıyor → http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
