#!/usr/bin/env bash
# Development: FastAPI (port 8000) + Vite dev server (port 5173)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶  Starting FastAPI backend on :8000"
cd "$ROOT/backend"
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACK_PID=$!

echo "▶  Starting Vite frontend on :5173"
cd "$ROOT/frontend"
npm run dev &
FRONT_PID=$!

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT INT TERM
wait
