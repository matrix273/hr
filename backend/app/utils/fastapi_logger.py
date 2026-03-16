"""FastAPI 日志集成"""

import time
from typing import Callable
from fastapi import Request, Response
from fastapi.routing import APIRoute
from loguru import logger
from .logger import setup_logger


def setup_fastapi_logger(
    log_file: str = "logs/app.log",
    log_level: str = "INFO",
    enable_json: bool = False
) -> None:
    """
    为 FastAPI 应用配置日志
    
    Args:
        log_file: 日志文件路径
        log_level: 日志级别
        enable_json: 是否启用 JSON 格式
    """
    setup_logger(
        log_level=log_level,
        log_file=log_file,
        enable_console=True,
        enable_json=enable_json
    )


class LoggingRoute(APIRoute):
    """自定义路由类，记录请求和响应日志"""
    
    def get_route_handler(self) -> Callable:
        original_route_handler = super().get_route_handler()
        
        async def custom_route_handler(request: Request) -> Response:
            # 记录请求开始
            start_time = time.time()
            
            logger.info(
                f"Request started",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "query_params": str(request.query_params),
                    "client": f"{request.client.host}:{request.client.port}" if request.client else None
                }
            )
            
            # 执行请求
            response: Response = await original_route_handler(request)
            
            # 计算耗时
            process_time = time.time() - start_time
            
            # 记录请求完成
            logger.info(
                f"Request completed",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time": f"{process_time:.3f}s"
                }
            )
            
            # 添加处理时间到响应头
            response.headers["X-Process-Time"] = str(process_time)
            
            return response
        
        return custom_route_handler


async def log_request_response(request: Request, call_next: Callable):
    """
    中间件：记录请求和响应
    
    Args:
        request: FastAPI 请求对象
        call_next: 下一个中间件或路由处理器
    
    Returns:
        FastAPI 响应对象
    """
    start_time = time.time()
    
    # 记录请求
    logger.info(
        f"{request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params),
            "client": f"{request.client.host}:{request.client.port}" if request.client else None
        }
    )
    
    # 处理请求
    response = await call_next(request)
    
    # 计算耗时
    process_time = time.time() - start_time
    
    # 记录响应
    logger.info(
        f"Response {response.status_code} ({process_time:.3f}s)",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "process_time": f"{process_time:.3f}s"
        }
    )
    
    # 添加处理时间到响应头
    response.headers["X-Process-Time"] = str(process_time)
    
    return response


def log_exception(request: Request, exc: Exception) -> None:
    """
    记录异常
    
    Args:
        request: FastAPI 请求对象
        exc: 异常对象
    """
    logger.error(
        f"Request failed: {exc}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "exception_type": type(exc).__name__,
            "exception_message": str(exc)
        },
        exc_info=True
    )


__all__ = [
    "setup_fastapi_logger",
    "LoggingRoute",
    "log_request_response",
    "log_exception"
]
