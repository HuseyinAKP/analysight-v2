#!/bin/bash
# Analysight — Next.js frontend başlatıcı
cd "$(dirname "$0")"
echo "🌐 Analysight Web başlatılıyor → http://localhost:3000"
node_modules/.bin/next dev --port 3000 apps/web
