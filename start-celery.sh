#!/bin/bash
# 启动 Celery Worker

cd "$(dirname "$0")"

# 设置 PYTHONPATH
export PYTHONPATH="/Users/matrix273/PycharmProjects/hr/backend"

echo "启动 Celery Worker..."
uv run celery -A app.tasks worker --loglevel=info --concurrency=4
