"""Celery Loguru 日志集成配置"""

import logging
import sys
from pathlib import Path
from loguru import logger
from typing import Optional


class CeleryLoguruHandler(logging.Handler):
    """将 Celery 的 logging 重定向到 Loguru"""
    
    def emit(self, record):
        try:
            level = logger.level(record.levelname).name if hasattr(logger.level(record.levelname), 'name') else record.levelname
        except ValueError:
            level = record.levelno
        
        # 找到调用者
        frame = logging.currentframe()
        depth = 2
        while frame and frame.f_code.co_filename.find("logging") != -1:
            frame = frame.f_back
            depth += 1
        
        # 记录日志
        logger.opt(depth=depth, exception=record.exc_info).log(
            level,
            record.getMessage()
        )


def setup_celery_logging():
    """配置 Celery 使用 Loguru 日志"""
    
    # 移除所有现有的日志处理器
    celery_logger = logging.getLogger("celery")
    celery_logger.handlers = []
    
    # 添加 Loguru 处理器
    handler = CeleryLoguruHandler()
    handler.setLevel(logging.WARNING)  # 只记录 WARNING 及以上级别的 Celery 内部日志
    
    formatter = logging.Formatter('%(message)s')
    handler.setFormatter(formatter)
    
    celery_logger.addHandler(handler)
    celery_logger.propagate = False  # 防止传播到根日志
    
    # 配置其他相关日志器
    for logger_name in ["celery", "celery.app.trace", "celery.worker"]:
        log = logging.getLogger(logger_name)
        log.handlers = []
        log.addHandler(handler)
        log.propagate = False
    
    logger.info("Celery Loguru 日志配置完成")


def get_celery_logger(name: Optional[str] = None):
    """获取 Celery 专用的日志记录器
    
    Args:
        name: 日志记录器名称
    
    Returns:
        Loguru logger 实例
    """
    from app.utils.logger import get_logger
    return get_logger(name or "celery")


# 自动配置
setup_celery_logging()

__all__ = ["setup_celery_logging", "get_celery_logger", "CeleryLoguruHandler"]