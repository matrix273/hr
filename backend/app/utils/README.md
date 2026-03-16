# 日志模块使用指南

## 模块说明

基于 Loguru 的日志模块，支持 FastAPI 集成和通用日志记录。

## 快速开始

### 1. 基础使用

```python
from app.utils.logger import logger, setup_logger, get_logger

# 初始化日志
setup_logger(
    log_level="INFO",
    log_file="logs/app.log",
    log_rotation="10 MB",
    log_retention="7 days"
)

# 使用日志
logger.info("这是一条信息")
logger.debug("调试信息")
logger.warning("警告信息")
logger.error("错误信息")
```

### 2. 在其他模块中使用

```python
from app.utils import get_logger

# 获取命名日志记录器
log = get_logger(__name__)

log.info("模块初始化")
log.error("发生错误")
```

### 3. FastAPI 集成

```python
from fastapi import FastAPI
from app.utils.fastapi_logger import setup_fastapi_logger

app = FastAPI()

# 初始化日志
setup_fastapi_logger(log_file="logs/api.log")
```

### 4. 自定义日志格式

```python
from app.utils.logger import setup_logger

setup_logger(
    log_level="DEBUG",
    log_file="logs/app.log",
    log_format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}"
)
```

### 5. JSON 格式输出（适用于日志收集系统）

```python
from app.utils.logger import setup_logger

setup_logger(
    log_level="INFO",
    log_file="logs/app.log",
    enable_json=True
)
```

### 6. 在业务代码中使用

```python
from app.utils import get_logger

log = get_logger(__name__)

class ResumeService:
    def __init__(self):
        log.info("ResumeService initialized")
    
    def process_resume(self, resume_id: str, text: str):
        log.info(f"Processing resume {resume_id}, length: {len(text)}")
        
        try:
            # 业务逻辑
            result = self._analyze(text)
            log.info(f"Resume {resume_id} processed successfully")
            return result
        except Exception as e:
            log.error(f"Failed to process resume {resume_id}: {e}", exc_info=True)
            raise
```

## 配置参数

### setup_logger()

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| log_level | str | "INFO" | 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| log_file | str | None | 日志文件路径 |
| log_rotation | str | "10 MB" | 日志轮转策略 |
| log_retention | str | "7 days" | 日志保留时间 |
| log_format | str | None | 自定义日志格式 |
| enable_console | bool | True | 是否启用控制台输出 |
| enable_json | bool | False | 是否启用 JSON 格式 |

### setup_fastapi_logger()

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| log_file | str | "logs/app.log" | 日志文件路径 |
| log_level | str | "INFO" | 日志级别 |
| enable_json | bool | False | 是否启用 JSON 格式 |

## 日志输出示例

### 控制台输出（彩色）

```
2025-03-16 14:30:15.123 | INFO     | app.main:root:52 | Root endpoint called
2025-03-16 14:30:15.456 | INFO     | app.services.resume:process:25 | Processing resume 123
```

### 文件输出

普通日志：`logs/app.log`
错误日志：`logs/app_error.log`

## 日志轮转和保留

- 日志文件大小超过 10 MB 时自动轮转
- 轮转后的日志文件自动压缩为 .zip 格式
- 保留最近 7 天的日志文件

## 注意事项

1. 日志目录会自动创建
2. 错误日志单独存储在 `_error.log` 文件中
3. 开发环境建议使用 INFO 级别，生产环境建议使用 WARNING 或 ERROR 级别
4. 日志文件已添加到 `.gitignore`，不会提交到版本控制
