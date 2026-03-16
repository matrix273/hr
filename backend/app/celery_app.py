"""Celery 应用配置"""

from celery import Celery
import sys
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

# 创建 Celery 应用
celery_app = Celery(
    "hr_app",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.tasks"]
)

# Celery 配置
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 分钟超时
    task_soft_time_limit=25 * 60,  # 25 分钟软超时
    worker_prefetch_multiplier=1,  # 每个 worker 只预取一个任务
    worker_concurrency=4,  # 并发数
)
