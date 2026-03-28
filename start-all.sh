#!/bin/bash

# 启动所有服务：FastAPI, Celery（云端版本，无需启动本地AI服务）

echo "=================================="
echo "🚀 启动 AI 简历筛选系统（云端版本）"
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

# 云端版本，无需停止本地AI服务

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
echo "📡 启动服务顺序（云端版本）："
echo "=================================="
echo "1. Celery Worker"
echo "2. FastAPI Backend"
echo "=================================="
echo ""
echo "💡 云端AI服务："
echo "   - Embedding: 阿里通义千问"
echo "   - Reranker:  阿里通义千问"
echo "   - LLM:       阿里通义千问"
echo "=================================="
echo ""

# 1. 启动Celery Worker
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

# 2. 启动FastAPI Backend
echo "⚡ 启动FastAPI Backend..."
cd backend
if [ "$USE_UV" = true ]; then
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 > ../logs/fastapi.log 2>&1 &
else
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4 > ../logs/fastapi.log 2>&1 &
fi
BACKEND_PID=$!
echo "✅ FastAPI Backend已启动 (PID: $BACKEND_PID)"
cd ..

# 等待FastAPI启动
sleep 5

echo ""
echo "=================================="
echo "✅ 所有服务启动完成！（云端版本）"
echo "=================================="
echo ""
echo "📊 服务状态："
echo "   FastAPI:     http://localhost:8000"
echo "   API文档:     http://localhost:8000/docs"
echo "   Celery:      运行中 (日志: logs/celery.log)"
echo ""
echo "☁️  云端AI服务："
echo "   - Embedding: 阿里通义千问（云端）"
echo "   - Reranker:  阿里通义千问（云端）"
echo "   - LLM:       阿里通义千问（云端）"
echo ""
echo "📝 日志文件："
echo "   FastAPI:     logs/fastapi.log"
echo "   Celery:      logs/celery.log"
echo ""
echo "💡 提示："
echo "   - 按 Ctrl+C 停止所有服务"
echo "   - 使用 'tail -f logs/{service}.log' 查看服务日志"
echo "   - AI服务已切换到云端，无需本地模型部署"
echo "=================================="
echo ""

# 保持脚本运行
wait
