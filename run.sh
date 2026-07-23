#!/usr/bin/env bash
# Production: build React → copy to backend/static/ → run single FastAPI server
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶  Building React frontend…"
cd "$ROOT/frontend"
npm install --silent
npm run build          # outputs to ../backend/static/

echo "▶  Starting server on :8000"
cd "$ROOT/backend"
uvicorn main:app --host 0.0.0.0 --port 8000
