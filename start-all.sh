#!/bin/bash
# Start Both Backend, Celery and Frontend

echo "🚀 Starting AI Resume Screening System..."
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $BACKEND_PID 2>/dev/null
    kill $CELERY_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Start Backend
echo "📡 Starting Backend..."
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 3

# Start Celery Worker
echo "🔄 Starting Celery Worker..."
cd backend
uv run celery -A app.tasks worker --loglevel=info --logfile=../logs/celery.log &
CELERY_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo "   Backend: http://localhost:8000"
echo "   Frontend: http://localhost:5173"
echo "   API Docs: http://localhost:8000/docs"
echo "   Celery Worker: Running (logs: logs/celery.log)"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
