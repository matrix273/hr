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

# Start FastAPI server（4 workers）
echo "📡 Starting FastAPI on http://localhost:8000"
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
