# 系统服务启动指南

## 📋 部署模式选择

AI 简历筛选系统支持两种部署模式：

### 模式 1：全本地部署（需要 GPU）
所有服务在本地运行，包括：
- Milvus（向量数据库）
- Qwen3-Embedding（本地模型）
- Qwen3-reranker（本地模型）
- DeepSeek/Qwen LLM（本地模型）
- FastAPI 应用

### 模式 2：云端 API（推荐）
使用云端 API 替代本地模型，只需启动：
- Milvus（向量数据库）
- FastAPI 应用
- Embedding/Reranker/LLM 使用云服务

---

## 📋 需要启动的服务列表

### 全本地部署模式（需要启动 5 个服务）

| 服务 | 端口 | 配置项 | 必需 GPU |
|------|--------|---------|----------|
| Milvus（向量数据库） | 19530 | `MILVUS_PORT` | ❌ |
| Qwen3-Embedding | 8010 | `QWEN_EMBEDDING_URL` | ✅ |
| Qwen3-reranker | 8001 | `QWEN_RERANKER_URL` | ✅ |
| DeepSeek/Qwen LLM | 8002 | `LLM_URL` | ✅ |
| FastAPI 应用 | 8000 | `FASTAPI_PORT` | ❌ |

### 云端 API 模式（推荐，只需启动 2 个服务）

| 服务 | 端口 | 配置项 | 说明 |
|------|--------|---------|------|
| Milvus（向量数据库） | 19530 | `MILVUS_PORT` | 必需 |
| FastAPI 应用 | 8000 | `FASTAPI_PORT` | 必需 |
| Embedding | - | QWEN_EMBEDDING_URL | 使用阿里通义千问云 API |
| Reranker | - | QWEN_RERANKER_URL | 使用 Cohere 云 API |
| LLM | - | LLM_URL | 使用阿里通义千问云 API |

## 🚀 模式 2：云端 API 配置（推荐）

### 步骤 1：获取 API Key

#### 1.1 阿里通义千问 API（用于 Embedding 和 LLM）
```bash
# 访问：https://dashscope.console.aliyun.com/apiKey
# 创建 API Key
```

#### 1.2 Cohere API（用于 Reranker）
```bash
# 访问：https://dashboard.cohere.com/api-keys
# 创建 API Key
```

### 步骤 2：配置 .env 文件

```bash
# Milvus Configuration（仍需本地部署）
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Embedding - 阿里通义千问
QWEN_EMBEDDING_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
QWEN_EMBEDDING_API_KEY=your_dashscope_api_key_here
QWEN_EMBEDDING_MODEL=text-embedding-v3

# Reranker - Cohere
QWEN_RERANKER_URL=https://api.cohere.ai/v1/rerank
QWEN_RERANKER_API_KEY=your_cohere_api_key_here
QWEN_RERANKER_MODEL=rerank-v3.5

# LLM - 阿里通义千问
LLM_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_API_KEY=your_dashscope_api_key_here
LLM_MODEL=qwen-plus
```

### 步骤 3：启动服务

```bash
# 只需启动 Milvus 和 FastAPI
./start-all.sh
```

---

## 🚀 模式 1：全本地部署（需要 GPU）

### 1. 启动 Milvus（向量数据库）

**使用 Docker（推荐）：**
```bash
# 使用 Docker Compose
cd /path/to/milvus
docker-compose up -d

# 或使用单个容器
docker run -d --name milvus \
  -p 19530:19530 \
  -p 9091:9091 \
  milvusdb/milvus:latest
```

**使用本地安装：**
```bash
# 启动 Milvus
cd /path/to/milvus
./bin/start.sh

# 或使用 systemd
sudo systemctl start milvus
```

**验证：**
```bash
curl http://localhost:19530/healthz
# 或
telnet localhost 19530
```

### 2. 启动 Qwen3-Embedding 模型

**使用 vLLM（推荐）：**
```bash
# 使用 vLLM 部署
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --port 8010 \
  --host 0.0.0.0
```

**使用本地服务：**
```bash
# 启动嵌入模型服务
cd /path/to/embedding-server
python server.py --port 8010
```

**验证：**
```bash
curl -X POST http://localhost:8010/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-embedding",
    "input": "test text"
  }'
```

### 3. 启动 Qwen3-reranker 模型

**使用 vLLM：**
```bash
python -m vllm.entrypoints.openai.rerank_api_server \
  --model BAAI/bge-reranker-v2-m3 \
  --port 8001 \
  --host 0.0.0.0
```

**使用本地服务：**
```bash
cd /path/to/reranker-server
python server.py --port 8001
```

**验证：**
```bash
curl -X POST http://localhost:8001/v1/rerank \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen-reranker",
    "query": "job description",
    "documents": ["resume 1", "resume 2"],
    "top_k": 3
  }'
```

### 4. 启动 LLM 模型

**使用 vLLM：**
```bash
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8002 \
  --host 0.0.0.0
```

**使用 DeepSeek API（云服务）：**
无需本地启动，只需配置 API Key：
```bash
# .env 中配置
LLM_URL=https://api.deepseek.com/v1/chat/completions
LLM_API_KEY=your_actual_api_key
```

**验证：**
```bash
curl -X POST http://localhost:8002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 5. 启动 FastAPI 应用

```bash
# 方式1：使用启动脚本
./start-backend.sh

# 方式2：使用 uv
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 方式3：使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**验证：**
```bash
# 健康检查
curl http://localhost:8000/api/health

# API 文档
open http://localhost:8000/docs
```

---

## 🌐 其他云端 API 选项

### Embedding 服务选项

| 提供商 | API 端点 | 模型名称 |
|--------|----------|----------|
| 阿里通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings` | `text-embedding-v3` |
| OpenAI | `https://api.openai.com/v1/embeddings` | `text-embedding-3-small` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/embeddings` | `embedding-2` |

### Reranker 服务选项

| 提供商 | API 端点 | 模型名称 |
|--------|----------|----------|
| Cohere | `https://api.cohere.ai/v1/rerank` | `rerank-v3.5` |
| Jina AI | `https://api.jina.ai/v1/rerank` | `jina-reranker-v2-base-multilingual` |

### LLM 服务选项

| 提供商 | API 端点 | 模型名称 |
|--------|----------|----------|
| 阿里通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | `qwen-plus` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `gpt-4o-mini` |

## 🎯 一键启动脚本（推荐）

创建 `start-services.sh`：

```bash
#!/bin/bash
set -e

echo "🚀 Starting all AI services..."
echo ""

# 1. Start Milvus
echo "1️⃣  Starting Milvus..."
docker-compose -f milvus/docker-compose.yml up -d &
sleep 5

# 2. Start Embedding Model
echo "2️⃣  Starting Embedding Model..."
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --port 8010 --host 0.0.0.0 &
EMBEDDING_PID=$!
sleep 5

# 3. Start Reranker
echo "3️⃣  Starting Reranker..."
python -m vllm.entrypoints.openai.rerank_api_server \
  --model BAAI/bge-reranker-v2-m3 \
  --port 8001 --host 0.0.0.0 &
RERANKER_PID=$!
sleep 5

# 4. Start LLM
echo "4️⃣  Starting LLM..."
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8002 --host 0.0.0.0 &
LLM_PID=$!
sleep 5

# 5. Start FastAPI
echo "5️⃣  Starting FastAPI Application..."
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "Services:"
echo "  Milvus:        http://localhost:19530"
echo "  Embedding:     http://localhost:8010"
echo "  Reranker:      http://localhost:8001"
echo "  LLM:           http://localhost:8002"
echo "  FastAPI:       http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping all services..."
    kill $EMBEDDING_PID 2>/dev/null
    kill $RERANKER_PID 2>/dev/null
    kill $LLM_PID 2>/dev/null
    kill $API_PID 2>/dev/null
    docker-compose -f milvus/docker-compose.yml down
    echo "✅ All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
```

使用：
```bash
chmod +x start-services.sh
./start-services.sh
```

## 📊 服务状态检查

### 检查所有服务
```bash
# Milvus
curl http://localhost:19530/healthz

# Embedding
curl -X POST http://localhost:8010/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen", "input": "test"}'

# Reranker
curl -X POST http://localhost:8001/v1/rerank \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen", "query": "test", "documents": []}'

# LLM
curl -X POST http://localhost:8002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen", "messages": []}'

# FastAPI
curl http://localhost:8000/api/health
```

## ⚠️ 常见问题

### 1. 端口占用
```bash
# 检查端口占用
lsof -i :8000
lsof -i :8010
lsof -i :8001
lsof -i :8002
lsof -i :19530

# 杀死占用端口的进程
kill -9 <PID>
```

### 2. 模型服务启动失败
- 检查 GPU 可用性：`nvidia-smi`
- 检查内存：`free -h`
- 检查磁盘空间：`df -h`
- 降低模型大小或批次大小

### 3. Milvus 连接失败
```bash
# 检查 Milvus 容器
docker ps | grep milvus

# 查看日志
docker logs milvus

# 重启 Milvus
docker-compose restart
```

### 4. 依赖缺失
```bash
# 安装 vLLM
pip install vllm

# 安装 pymilvus
pip install pymilvus
```

## 🎬 完整启动流程

```bash
# 1. 启动 Milvus（需要 10-30 秒）
docker-compose -f milvus/docker-compose.yml up -d
# 等待 Milvus 就绪...
curl http://localhost:19530/healthz

# 2. 启动模型服务（并行）
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-0.5B-Instruct \
  --port 8010 --host 0.0.0.0 &

python -m vllm.entrypoints.openai.rerank_api_server \
  --model BAAI/bge-reranker-v2-m3 \
  --port 8001 --host 0.0.0.0 &

python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --port 8002 --host 0.0.0.0 &

# 3. 等待模型加载（根据模型大小，需要 1-5 分钟）
sleep 60

# 4. 启动 FastAPI 应用
./start-backend.sh
```

---

## 📊 部署模式对比

| 特性 | 全本地部署 | 云端 API |
|------|-----------|----------|
| 启动服务数 | 5 个 | 2 个 |
| GPU 需求 | 必需 | 不需要 |
| 启动时间 | 5-10 分钟 | 1-2 分钟 |
| 成本 | 无 API 费用 | API 按量付费 |
| 性能 | 取决于硬件 | 取决于网络 |
| 数据隐私 | 完全本地 | 数据上传云端 |
| 推荐场景 | 开发/内网环境 | 生产/个人开发 |

---

**总结**：
- **云端 API 模式**：推荐用于快速开发、个人项目、不需要 GPU 的场景
- **全本地部署模式**：适合有 GPU 资源、对数据隐私要求高的场景

选择云端 API 模式，只需启动 Milvus 和 FastAPI，无需部署本地模型服务。
