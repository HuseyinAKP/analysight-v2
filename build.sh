#!/bin/bash
set -e
cd "$(dirname "$0")/apps/web"
# Vercel'de NODE_ENV=production olabilir, devDeps dahil edilmeli
NODE_ENV=development npm install
npm run build
