# 云端 API 快速启动指南

## 🚀 5 分钟快速启动（使用云端 API）

### 前提条件
- 已安装 Docker（用于启动 Milvus）
- 已获取阿里通义千问 API Key 和 Cohere API Key

### 步骤 1：获取 API Key

**阿里通义千问（用于 Embedding 和 LLM）**
1. 访问：https://dashscope.console.aliyun.com/apiKey
2. 创建 API Key
3. 复制 API Key

**Cohere（用于 Reranker）**
1. 访问：https://dashboard.cohere.com/api-keys
2. 创建 API Key
3. 复制 API Key

### 步骤 2：配置 .env

编辑项目根目录的 `.env` 文件：

```bash
# Milvus Configuration
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Embedding - 阿里通义千问
QWEN_EMBEDDING_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
QWEN_EMBEDDING_API_KEY=你的_dashscope_api_key
QWEN_EMBEDDING_MODEL=text-embedding-v3

# Reranker - Cohere
QWEN_RERANKER_URL=https://api.cohere.ai/v1/rerank
QWEN_RERANKER_API_KEY=你的_cohere_api_key
QWEN_RERANKER_MODEL=rerank-v3.5

# LLM - 阿里通义千问
LLM_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_API_KEY=你的_dashscope_api_key
LLM_MODEL=qwen-plus

# Application Configuration
INDEX_NAME=resume_index
COLLECTION_NAME=resumes

# FastAPI Configuration
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 步骤 3：启动 Milvus

```bash
# 使用 Docker 启动 Milvus
docker run -d --name milvus \
  -p 19530:19530 \
  -p 9091:9091 \
  milvusdb/milvus:latest
```

等待 30 秒让 Milvus 完全启动。

### 步骤 4：启动 FastAPI 应用

```bash
# 进入后端目录
cd backend

# 激活虚拟环境（如果使用 uv）
source .venv/bin/activate

# 启动应用
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

或使用启动脚本：
```bash
./start-backend.sh
```

### 步骤 5：启动前端

```bash
# 在新终端中
cd frontend

# 安装依赖（首次运行）
npm install

# 启动开发服务器
npm run dev
```

### 步骤 6：验证服务

```bash
# 检查 Milvus
curl http://localhost:19530/healthz

# 检查 FastAPI
curl http://localhost:8000/api/health

# 打开浏览器访问 API 文档
open http://localhost:8000/docs

# 打开前端应用
open http://localhost:5173
```

## ✅ 完成！

系统已成功启动，现在可以开始使用 AI 简历筛选功能。

## 🔧 常见问题

### 1. API Key 无效
- 检查 API Key 是否正确复制
- 确认 API Key 已激活
- 检查 API Key 是否有足够的配额

### 2. Milvus 启动失败
```bash
# 检查 Milvus 容器状态
docker ps | grep milvus

# 查看 Milvus 日志
docker logs milvus

# 重启 Milvus
docker restart milvus
```

### 3. 端口占用
```bash
# 检查端口占用
lsof -i :19530
lsof -i :8000

# 杀死占用进程
kill -9 <PID>
```

### 4. 前端无法连接后端
- 检查 CORS 配置
- 确认后端服务正常运行
- 检查防火墙设置

## 📊 成本估算

使用云端 API 的预估成本（基于常见用量）：

| 服务 | 模型 | 单价 | 1000 次请求成本 |
|------|------|------|-----------------|
| Embedding | text-embedding-v3 | ¥0.0007/千tokens | ¥0.1-0.5 |
| Reranker | rerank-v3.5 | ¥1/千次 | ¥1 |
| LLM | qwen-plus | ¥0.004/千tokens | ¥4-10 |

**月度成本估算**（假设每天处理 100 份简历）：约 ¥30-100

## 🔄 切换到本地部署

如果想切换到本地部署（需要 GPU），参考 `SERVICES_SETUP.md` 中的"模式 1：全本地部署"部分。

## 📚 更多信息

- 详细服务配置：`SERVICES_SETUP.md`
- API 文档：http://localhost:8000/docs
- 项目说明：`README.md`
