"""日志配置模块"""

import sys
from pathlib import Path
from loguru import logger
from typing import Optional


def setup_logger(
    log_level: str = "INFO",
    log_file: Optional[str] = None,
    log_rotation: str = "10 MB",
    log_retention: str = "7 days",
    log_format: Optional[str] = None,
    enable_console: bool = True,
    enable_json: bool = False
) -> None:
    """
    配置 Loguru 日志
    
    Args:
        log_level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: 日志文件路径，为 None 则不写入文件
        log_rotation: 日志轮转策略 (如 "10 MB", "1 day")
        log_retention: 日志保留时间 (如 "7 days", "1 month")
        log_format: 自定义日志格式，为 None 则使用默认格式
        enable_console: 是否启用控制台输出
        enable_json: 是否启用 JSON 格式输出
    """
    # 移除默认的处理器
    logger.remove()
    
    # 默认日志格式
    if log_format is None:
        if enable_json:
            log_format = None  # 使用 JSON 默认格式
        else:
            log_format = (
                "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
                "<level>{level: <8}</level> | "
                "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "
                "<level>{message}</level>"
            )
    
    # 控制台输出
    if enable_console:
        logger.add(
            sys.stderr,
            format=log_format,
            level=log_level,
            colorize=not enable_json,
            serialize=enable_json,
            backtrace=True,
            diagnose=True
        )
    
    # 文件输出
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 普通日志文件
        logger.add(
            log_file,
            format=log_format,
            level=log_level,
            rotation=log_rotation,
            retention=log_retention,
            compression="zip",
            encoding="utf-8",
            colorize=not enable_json,
            serialize=enable_json,
            backtrace=True,
            diagnose=True
        )
        
        # 错误日志文件（单独记录）
        error_log_file = str(log_path).replace(".log", "_error.log")
        logger.add(
            error_log_file,
            format=log_format,
            level="ERROR",
            rotation=log_rotation,
            retention=log_retention,
            compression="zip",
            encoding="utf-8",
            colorize=not enable_json,
            serialize=enable_json,
            backtrace=True,
            diagnose=True
        )
    
    logger.info("Logger initialized")


def get_logger(name: Optional[str] = None):
    """
    获取日志记录器
    
    Args:
        name: 日志记录器名称，为 None 则使用调用者的 __name__
    
    Returns:
        Loguru logger 实例
    """
    if name is None:
        import inspect
        frame = inspect.currentframe().f_back
        name = frame.f_globals.get('__name__')
    return logger.bind(name=name)


# 默认日志记录器
__all__ = ["logger", "setup_logger", "get_logger"]
