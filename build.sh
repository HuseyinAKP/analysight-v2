#!/bin/bash
set -e
cd "$(dirname "$0")/apps/web"
npm install
npm run build
