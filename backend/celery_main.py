"""Celery 主应用入口"""

import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# 添加 backend 目录到 Python 路径
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from app.celery_app import celery_app
from app.utils.logger import setup_logger

# 初始化日志
setup_logger(log_level="INFO", log_file="logs/celery.log")

# 导入 Celery 日志配置
from app.utils.celery_logger import setup_celery_logging

if __name__ == '__main__':
    # 配置 Celery 使用 Loguru
    setup_celery_logging()
    celery_app.start()
