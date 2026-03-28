#!/bin/bash
# 启动 Celery Worker

cd "$(dirname "$0")"

# 激活虚拟环境
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
    echo "✅ 虚拟环境已激活"
elif [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    echo "✅ 虚拟环境已激活"
else
    echo "⚠️  未找到虚拟环境，使用系统Python"
fi

# 设置 PYTHONPATH
export PYTHONPATH="$PWD/backend:$PYTHONPATH"

echo "🚀 启动 Celery Worker..."
cd backend
if command -v uv &> /dev/null; then
    uv run celery -A app.celery_app worker --loglevel=info --concurrency=4
else
    celery -A app.celery_app worker --loglevel=info --concurrency=4
fi
