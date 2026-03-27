#!/bin/bash

# 启动所有服务：FastAPI, Celery, Reranker, Embedding

echo "=================================="
echo "🚀 启动 AI 简历筛选系统"
echo "=================================="

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止所有服务..."

    # 停止后端服务
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ 后端服务已停止"
    fi

    # 停止Celery服务
    if [ -n "$CELERY_PID" ]; then
        kill $CELERY_PID 2>/dev/null
        echo "✅ Celery服务已停止"
    fi

    # 停止Reranker服务
    if [ -n "$RERANKER_PID" ]; then
        kill $RERANKER_PID 2>/dev/null
        echo "✅ Reranker服务已停止"
    fi

    # 停止Embedding服务
    if [ -n "$EMBEDDING_PID" ]; then
        kill $EMBEDDING_PID 2>/dev/null
        echo "✅ Embedding服务已停止"
    fi

    echo "✅ 所有服务已停止"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 检查 uv 命令
if command -v uv &> /dev/null; then
    echo "✅ 检测到 uv，使用 uv 运行"
    USE_UV=true
else
    echo "⚠️  未检测到 uv，使用传统方式激活虚拟环境"
    USE_UV=false
fi

# 检查虚拟环境（非 uv 模式）
if [ "$USE_UV" = false ]; then
    if [ -d ".venv" ]; then
        echo "✅ 激活虚拟环境"
        source .venv/bin/activate
    else
        echo "❌ 未找到虚拟环境，请先创建：uv venv"
        exit 1
    fi
fi

# 确保日志目录存在
mkdir -p logs

echo ""
echo "=================================="
echo "📡 启动服务顺序："
echo "=================================="
echo "1. Embedding服务"
echo "2. Reranker服务"
echo "3. Celery Worker"
echo "4. FastAPI Backend"
echo "=================================="
echo ""

# 1. 启动Embedding服务
echo "🔤 启动Embedding服务..."
if [ "$USE_UV" = true ]; then
    uv run python backend/start-embedding.py --host 0.0.0.0 --port 8010 > logs/embedding.log 2>&1 &
else
    python backend/start-embedding.py --host 0.0.0.0 --port 8010 > logs/embedding.log 2>&1 &
fi
EMBEDDING_PID=$!
echo "✅ Embedding服务已启动 (PID: $EMBEDDING_PID)"

# 等待Embedding服务启动
sleep 5

# 2. 启动Reranker服务
echo "🔄 启动Reranker服务..."
if [ "$USE_UV" = true ]; then
    uv run python backend/start-reranker.py --host 0.0.0.0 --port 8001 > logs/reranker.log 2>&1 &
else
    python backend/start-reranker.py --host 0.0.0.0 --port 8001 > logs/reranker.log 2>&1 &
fi
RERANKER_PID=$!
echo "✅ Reranker服务已启动 (PID: $RERANKER_PID)"

# 等待Reranker服务启动
sleep 5

# 3. 启动Celery Worker
echo "📋 启动Celery Worker..."
cd backend
if [ "$USE_UV" = true ]; then
    uv run celery -A app.celery_app worker --loglevel=info > ../logs/celery.log 2>&1 &
else
    celery -A app.celery_app worker --loglevel=info > ../logs/celery.log 2>&1 &
fi
CELERY_PID=$!
echo "✅ Celery Worker已启动 (PID: $CELERY_PID)"
cd ..

# 等待Celery启动
sleep 3

# 4. 启动FastAPI Backend
echo "⚡ 启动FastAPI Backend..."
cd backend
if [ "$USE_UV" = true ]; then
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../logs/fastapi.log 2>&1 &
else
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > ../logs/fastapi.log 2>&1 &
fi
BACKEND_PID=$!
echo "✅ FastAPI Backend已启动 (PID: $BACKEND_PID)"
cd ..

# 等待FastAPI启动
sleep 5

echo ""
echo "=================================="
echo "✅ 所有服务启动完成！"
echo "=================================="
echo ""
echo "📊 服务状态："
echo "   FastAPI:     http://localhost:8000"
echo "   API文档:     http://localhost:8000/docs"
echo "   Embedding:   http://localhost:8010"
echo "   Reranker:    http://localhost:8001"
echo "   Celery:      运行中 (日志: logs/celery.log)"
echo ""
echo "📝 日志文件："
echo "   FastAPI:     logs/fastapi.log"
echo "   Embedding:   logs/embedding.log"
echo "   Reranker:    logs/reranker.log"
echo "   Celery:      logs/celery.log"
echo ""
echo "💡 提示："
echo "   - 按 Ctrl+C 停止所有服务"
echo "   - 使用 'tail -f logs/{service}.log' 查看服务日志"
echo "=================================="
echo ""

# 保持脚本运行
wait
