"""Celery 主应用入口"""

import sys
from pathlib import Path

# 添加 backend 目录到 Python 路径
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.celery_app import celery_app

if __name__ == '__main__':
    celery_app.start()
