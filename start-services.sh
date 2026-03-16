#!/bin/bash
# Start All AI Services for Resume Screening System

set -e

echo "🚀 Starting AI Resume Screening System Services..."
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $EMBEDDING_PID 2>/dev/null
    kill $RERANKER_PID 2>/dev/null
    kill $LLM_PID 2>/dev/null
    kill $API_PID 2>/dev/null
    # Optional: Stop Milvus if managed by docker
    # docker stop milvus 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Check if services are already running
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  Port $port ($service) is already in use"
        echo "   Please stop the existing service or change the port in .env"
        read -p "Continue anyway? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

check_port 8010 "Embedding"
check_port 8001 "Reranker"
check_port 8002 "LLM"
check_port 8000 "FastAPI"
check_port 19530 "Milvus"

# 1. Check Milvus
echo "1️⃣  Checking Milvus (localhost:19530)..."
if curl -s http://localhost:19530/healthz > /dev/null 2>&1; then
    echo "   ✅ Milvus is running"
else
    echo "   ⚠️  Milvus is not running!"
    echo "   Please start Milvus first:"
    echo "   docker run -d --name milvus -p 19530:19530 milvusdb/milvus:latest"
    echo ""
    read -p "Continue anyway? (y/N): " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
sleep 2

# 2. Start Embedding Model
echo "2️⃣  Starting Embedding Model (port 8010)..."
echo "   Note: This service is expected to be running externally"
echo "   Configure QWEN_EMBEDDING_URL in .env if different"
sleep 1

# 3. Start Reranker Model
echo "3️⃣  Starting Reranker Model (port 8001)..."
echo "   Note: This service is expected to be running externally"
echo "   Configure QWEN_RERANKER_URL in .env if different"
sleep 1

# 4. Start LLM
echo "4️⃣  Starting LLM (port 8002)..."
echo "   Note: This service is expected to be running externally"
echo "   Configure LLM_URL in .env if different"
sleep 1

# 5. Start FastAPI Application
echo "5️⃣  Starting FastAPI Application (port 8000)..."
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!
cd ..

# Wait for FastAPI to start
echo "   Waiting for FastAPI to start..."
sleep 5

# Check if FastAPI is running
if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "   ✅ FastAPI is running"
else
    echo "   ❌ FastAPI failed to start"
    echo "   Check logs above for errors"
    cleanup
    exit 1
fi

echo ""
echo "✅ Services Status:"
echo ""
echo "   Milvus:        http://localhost:19530"
echo "   Embedding:     http://localhost:8010"
echo "   Reranker:      http://localhost:8001"
echo "   LLM:           http://localhost:8002"
echo "   FastAPI:       http://localhost:8000"
echo ""
echo "📚 API Documentation:"
echo "   http://localhost:8000/docs"
echo ""
echo "🌐 Frontend (if running):"
echo "   http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for all background processes
wait
