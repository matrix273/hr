# Celery 异步任务配置说明

## 概述

项目已经集成 Celery 消息队列，用于异步处理简历上传后的 embedding 操作，避免阻塞用户请求。

## 架构

```
用户上传简历 -> FastAPI 接收请求 -> 保存到数据库 -> 提交 Celery 任务 -> 立即返回响应
                                                              ↓
                                                    Celery Worker 异步处理
                                                              ↓
                                                    生成 embedding 并存储到 Milvus
```

## 组件

### 1. Redis (消息代理)
- 用于 Celery 的消息队列
- 存储 Celery 任务结果
- 端口: 6379

### 2. Celery Worker
- 处理异步任务
- 并发数: 4 个 worker
- 当前任务: `process_resume_embedding` - 处理简历 embedding

### 3. FastAPI
- 提交任务到 Celery
- 不等待任务完成，立即返回响应

## 启动服务

### 方式一：分别启动（推荐开发环境）

1. **启动 Redis**
   ```bash
   docker compose up -d redis
   ```
   或者如果 Redis 已经在运行：
   ```bash
   docker ps | grep redis
   ```

2. **启动 Celery Worker**
   ```bash
   ./start-celery.sh
   ```

3. **启动 FastAPI 后端**
   ```bash
   ./start-backend.sh
   ```

### 方式二：使用 Docker Compose（生产环境）

修改 `docker-compose.yml` 添加 Celery 服务：

```yaml
celery:
  build: .
  command: celery -A app.celery_app worker --loglevel=info --concurrency=4
  volumes:
    - ./backend:/app/backend
  environment:
    - CELERY_BROKER_URL=redis://redis:6379/0
    - CELERY_RESULT_BACKEND=redis://redis:6379/0
  depends_on:
    - redis
```

启动所有服务：
```bash
docker compose up -d
```

## 任务说明

### process_resume_embedding

异步处理简历 embedding 任务：

- **参数**: `resume_id` (str), `resume_text` (str)
- **功能**: 将简历文本转换为 embedding 并存储到 Milvus
- **超时**: 30 分钟
- **重试**: 默认重试 3 次

## 监控

### 查看 Celery Worker 状态

```bash
# 查看进程
ps aux | grep celery

# 查看日志
tail -f /tmp/celery.log
```

### 查看 Redis 状态

```bash
# 连接到 Redis
docker exec -it hr-redis redis-cli

# 查看队列长度
LLEN celery

# 查看任务结果
KEYS celery-task-meta-*
```

## 性能优化

### 调整 Worker 并发数

编辑 `start-celery.sh`，修改 `--concurrency` 参数：

```bash
celery -A app.celery_app worker --loglevel=info --concurrency=8
```

### 调整任务超时

编辑 `backend/app/celery_app.py`：

```python
celery_app.conf.update(
    task_time_limit=60 * 60,  # 60 分钟
    task_soft_time_limit=55 * 60,  # 55 分钟
)
```

## 故障排查

### Worker 未启动

1. 检查 Redis 是否运行：
   ```bash
   docker ps | grep redis
   ```

2. 检查日志：
   ```bash
   tail -f /tmp/celery.log
   ```

3. 检查端口是否被占用：
   ```bash
   lsof -i :6379
   ```

### 任务堆积

1. 查看队列长度：
   ```bash
   docker exec -it hr-redis redis-cli LLEN celery
   ```

2. 增加 worker 并发数
3. 检查 embedding 服务是否正常运行

### 任务失败

1. 查看任务日志
2. 检查 embedding API 是否可访问
3. 检查 Milvus 连接是否正常

## 配置说明

环境变量（`.env`）：

```env
# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Celery 配置
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

## 注意事项

1. **生产环境**：建议使用 Docker Compose 管理所有服务
2. **监控**：建议集成 Flower 监控 Celery 任务
3. **持久化**：Redis 数据需要持久化存储
4. **安全性**：生产环境需要配置 Redis 密码
