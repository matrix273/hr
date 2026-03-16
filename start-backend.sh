#!/bin/bash
# Start Backend Server

echo "🚀 Starting Backend Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please configure .env with your actual values."
fi

# Set PYTHONPATH
export PYTHONPATH="/Users/matrix273/PycharmProjects/hr/backend"

# Start FastAPI server
echo "📡 Starting FastAPI on http://localhost:8000"
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
