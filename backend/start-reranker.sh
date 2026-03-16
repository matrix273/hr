#!/bin/bash
# 启动 Qwen3-Reranker-0.6B 服务

set -e

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 配置
PORT=${RERANKER_PORT:-8001}
HOST=${RERANKER_HOST:-0.0.0.0}

echo "🚀 启动 Qwen3-Reranker-0.6B 服务..."
echo ""
echo "📋 配置信息:"
echo "   端口: $PORT"
echo "   主机: $HOST"
echo "   项目目录: $PROJECT_DIR"
echo ""

# 切换到项目根目录
cd "$PROJECT_DIR"

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 未安装，请先安装 Python3"
    exit 1
fi

# 检查虚拟环境
if [ ! -d "$PROJECT_DIR/.venv" ]; then
    echo "⚠️  uv 虚拟环境不存在，请先创建虚拟环境"
    echo "   运行: uv venv"
    exit 1
fi

# 检查 uv 命令
if command -v uv &> /dev/null; then
    echo "✅ 检测到 uv，使用 uv 运行"
    USE_UV=true
else
    echo "⚠️  未检测到 uv，使用传统方式激活虚拟环境"
    USE_UV=false
fi

# 激活虚拟环境（如果不使用 uv）
if [ "$USE_UV" = false ]; then
    if [ -f "$PROJECT_DIR/.venv/bin/activate" ]; then
        source "$PROJECT_DIR/.venv/bin/activate"
    elif [ -f "$PROJECT_DIR/.venv/Scripts/activate" ]; then
        source "$PROJECT_DIR/.venv/Scripts/activate"
    else
        echo "❌ 无法找到虚拟环境激活脚本"
        exit 1
    fi
fi

# 检查依赖
echo "📦 检查依赖..."
if [ "$USE_UV" = true ]; then
    uv pip list | grep -q "transformers" || (echo "❌ 缺少 transformers 依赖" && exit 1)
    uv pip list | grep -q "fastapi" || (echo "❌ 缺少 fastapi 依赖" && exit 1)
    uv pip list | grep -q "torch" || (echo "❌ 缺少 torch 依赖" && exit 1)
else
    pip list | grep -q "transformers" || (echo "❌ 缺少 transformers 依赖" && exit 1)
    pip list | grep -q "fastapi" || (echo "❌ 缺少 fastapi 依赖" && exit 1)
    pip list | grep -q "torch" || (echo "❌ 缺少 torch 依赖" && exit 1)
fi

echo "✅ 依赖检查完成"
echo ""

# 检查 GPU（可选）
if command -v nvidia-smi &> /dev/null; then
    echo "🎮 检测到 GPU:"
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader | head -1
    echo ""
fi

# 启动服务
echo "🚀 启动服务..."
if [ "$USE_UV" = true ]; then
    uv run python backend/start-reranker.py --host $HOST --port $PORT
else
    python backend/start-reranker.py --host $HOST --port $PORT
fi
