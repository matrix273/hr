#!/bin/bash
# Start Backend Server

echo "🚀 Starting Backend Server..."

cd "$(dirname "$0")"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please configure .env with your actual values."
fi

# Set PYTHONPATH（使用相对路径）
export PYTHONPATH="$PWD/backend:$PYTHONPATH"

# Kill existing backend process
EXISTING_PID=$(lsof -ti:8000 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
    echo "🛑 Killing existing backend process (PID: $EXISTING_PID)..."
    kill -9 $EXISTING_PID 2>/dev/null
    sleep 1
fi

# Start FastAPI server（4 workers）
echo "📡 Starting FastAPI on http://localhost:8000"
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
