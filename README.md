# AI 简历筛选系统

基于 Qwen3-Embedding-0.6B、Milvus、Qwen3-reranker 和 DeepSeek/Qwen 的 AI 简历筛选系统，支持前后端分离架构。

## 技术栈

### 后端
- **Embedding**: Qwen3-Embedding-0.6B
- **Vector DB**: Milvus
- **Reranker**: Qwen3-reranker
- **LLM**: DeepSeek / Qwen
- **API**: FastAPI
- **Python**: >=3.12

### 前端
- **Framework**: React
- **UI**: Material-UI
- **Build Tool**: Vite
- **HTTP Client**: Axios

## 项目结构

```
hr/
├── backend/                          # 后端目录
│   ├── app/                          # Python应用包
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI应用入口
│   │   ├── config.py                 # 配置文件
│   │   ├── models/                   # 数据模型
│   │   │   ├── __init__.py
│   │   │   └── schemas.py            # Pydantic模型
│   │   ├── services/                 # 业务逻辑服务
│   │   │   ├── __init__.py
│   │   │   ├── embedding.py          # 嵌入模型服务
│   │   │   ├── vector_db.py          # 向量数据库服务
│   │   │   ├── reranker.py           # 重排序服务
│   │   │   └── llm.py                # LLM服务
│   │   └── core/                     # 核心系统
│   │       ├── __init__.py
│   │       └── system.py             # 简历筛选系统核心
│   ├── .env.example                 # 环境变量示例
│   └── example.py                   # 示例代码
├── frontend/                         # 前端目录
│   ├── public/                       # 静态资源
│   ├── src/
│   │   ├── components/               # React组件
│   │   ├── services/                 # API服务
│   │   ├── App.jsx                   # 主应用组件
│   │   ├── main.jsx                  # 应用入口
│   │   └── index.css                 # 全局样式
│   ├── package.json                  # Node依赖配置
│   ├── package-lock.json
│   └── vite.config.js               # Vite配置
├── pyproject.toml                    # Python依赖配置（根目录）
├── uv.lock                            # Python依赖锁文件
├── .env.example                      # 环境变量示例（根目录）
├── .env                               # 环境变量配置（不提交到git）
├── start-backend.sh                  # 启动后端脚本
├── start-frontend.sh                 # 启动前端脚本
├── start-all.sh                       # 启动全部服务
├── .venv/                            # Python虚拟环境
└── README.md                         # 项目文档
```

## 安装

### 后端安装
1. 克隆项目
2. 创建并激活虚拟环境（推荐使用 uv）：
   ```bash
   # 使用 uv（推荐）
   uv venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate

   # 或使用 Python venv
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. 安装依赖：
   ```bash
   uv sync
   # 或
   pip install -e .
   ```
4. 配置环境变量：
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入实际的配置值
   ```
5. 启动 Milvus 服务（确保运行在配置的主机和端口）

### 前端安装
1. 进入前端目录：
   ```bash
   cd frontend
   ```
2. 安装依赖：
   ```bash
   npm install
   ```

## 快速开始

### 方式 1：本地部署（推荐，需要 GPU）

Embedding 和 Reranker 模型本地运行，LLM 使用云端 API：

```bash
# 1. 启动 Milvus
docker compose up -d

# 2. 启动 Embedding 服务
./backend/start-embedding.sh

# 3. 启动 Reranker 服务
./backend/start-reranker.sh

# 4. 启动后端和前端
./start-all.sh
```

### 方式 2：云端 API 模式（5 分钟启动）

无需 GPU，所有服务使用云服务：

```bash
# 1. 查看 CLOUD_API_QUICKSTART.md 了解详细步骤
open CLOUD_API_QUICKSTART.md

# 2. 获取 API Key
#    - 阿里通义千问：https://dashscope.console.aliyun.com/apiKey
#    - Cohere：https://dashboard.cohere.com/api-keys

# 3. 配置 .env 文件（参考 CLOUD_API_QUICKSTART.md）

# 4. 启动服务
./start-all.sh
```

---

## 配置

在根目录的 `.env` 文件中配置以下变量（从 `.env.example` 复制并修改）：

### 部署模式选择

#### 混合模式（推荐）：本地 + 云端
Embedding 和 Reranker 本地运行，LLM 使用云端 API，兼顾性能和成本：

```bash
# Embedding - 本地服务
QWEN_EMBEDDING_URL=http://localhost:8010/v1/embeddings
QWEN_EMBEDDING_API_KEY=not_required

# Reranker - 本地服务
QWEN_RERANKER_URL=http://localhost:8001/v1/rerank
QWEN_RERANKER_API_KEY=not_required
QWEN_RERANKER_MODEL=Qwen3-Reranker-0.6B

# LLM - 云端 API（阿里通义千问）
LLM_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_API_KEY=your_dashscope_api_key_here
LLM_MODEL=qwen-plus
```

#### 纯云端模式（无需 GPU）
所有服务使用云端 API：

```bash
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

#### 纯本地模式（需要 GPU）
所有服务本地运行：

```bash
# Embedding - 本地服务
QWEN_EMBEDDING_URL=http://localhost:8010/v1/embeddings
QWEN_EMBEDDING_API_KEY=not_required

# Reranker - 本地服务
QWEN_RERANKER_URL=http://localhost:8001/v1/rerank
QWEN_RERANKER_API_KEY=not_required
QWEN_RERANKER_MODEL=Qwen3-Reranker-0.6B

# LLM - 本地服务
LLM_URL=http://localhost:8002/v1/chat/completions
LLM_API_KEY=not_required
```

### Milvus 配置
```env
MILVUS_HOST=localhost
MILVUS_PORT=19530
```


### 应用配置
```env
INDEX_NAME=resume_index
COLLECTION_NAME=resumes
```

### FastAPI 配置
```env
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
```

### CORS 配置
```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## 运行

### 启动后端

**推荐模式（本地 Embedding + Reranker，云端 LLM）**：
```bash
# 1. 启动 Milvus
docker compose up -d

# 2. 启动 Embedding 服务
./backend/start-embedding.sh

# 3. 启动 Reranker 服务
./backend/start-reranker.sh

# 4. 启动后端 API
./start-backend.sh
```

**云端 API 模式**：
```bash
# 确保 Milvus 正在运行
docker ps | grep milvus

# 启动后端
./start-backend.sh
```

**纯本地模式**：
```bash
# 1. 启动所有 AI 模型服务（参考 SERVICES_SETUP.md）
# 2. 启动后端
./start-backend.sh
```

**其他启动方式**：
```bash
# 方式2：使用 uv run
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 方式3：使用 uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

后端 API 文档将在 `http://localhost:8000/docs` 可用

### 启动前端
```bash
# 方式1：使用启动脚本（推荐）
./start-frontend.sh

# 方式2：手动启动
cd frontend
npm run dev
```

前端将在 `http://localhost:5173` 运行

### 启动全部服务（一键启动）
```bash
./start-all.sh
```

这将同时启动后端和前端，使用 `Ctrl+C` 停止所有服务。

## API 接口

### 添加简历
- **POST** `/api/resumes`
- 请求体：
  ```json
  {
    "resume_id": "resume_001",
    "resume_text": "简历全文内容..."
  }
  ```
- 响应：
  ```json
  {
    "success": true,
    "message": "Resume resume_001 added successfully"
  }
  ```

### 筛选简历
- **POST** `/api/screen`
- 请求体：
  ```json
  {
    "job_description": "职位描述...",
    "top_k": 5
  }
  ```
- 响应：
  ```json
  {
    "results": [
      {
        "resume_id": "resume_001",
        "rerank_score": 0.95,
        "llm_evaluation": "详细评估内容..."
      }
    ]
  }
  ```

### 健康检查
- **GET** `/api/health`
- 响应：
  ```json
  {
    "status": "healthy",
    "version": "0.1.0"
  }
  ```

## 系统流程

1. **嵌入生成**：使用 Qwen3-Embedding-0.6B 将简历和职位描述转换为1024维向量
2. **向量存储**：将简历向量存储到 Milvus 向量数据库
3. **相似检索**：根据职位描述向量在 Milvus 中检索最相似的简历
4. **结果重排序**：使用 Qwen3-reranker 对检索结果进行精准重排序
5. **智能评估**：使用 LLM 对重排序后的简历进行详细评估和分析

## 开发指南

### 后端开发
- 使用 FastAPI 构建高性能 REST API
- Pydantic 模型定义在 `backend/app/models/schemas.py`
- 业务逻辑在 `backend/app/services/` 目录下
- 核心系统逻辑在 `backend/app/core/system.py`

### 前端开发
- React 18 + Vite
- Material-UI 组件库
- Axios 处理 HTTP 请求
- 建议将 API 调用封装在 `frontend/src/services/` 目录

## 注意事项

### 推荐模式（本地 Embedding + Reranker，云端 LLM）
- 需要 GPU 运行 Embedding 和 Reranker（显存需求约 6-8GB）
- 需要配置 LLM 的 API Key
- 确保 Milvus 服务正常运行
- 数据不上传到 Embedding/Reranker，但会上传到 LLM

### 纯云端 API 模式
- 无需 GPU
- 确保已配置有效的 API Key
- 注意 API 调用的费用和配额限制
- 确保 Milvus 服务正常运行
- 数据会上传到云端 API，注意隐私

### 纯本地模式
- 需要足够的 GPU 资源（显存需求约 12-16GB）
- 确保所有模型服务正常运行并可访问
- 首次启动需要下载模型，时间较长
- 确保 Milvus 服务正常运行
- 数据完全本地处理，最安全

### 通用注意事项
- 根据实际部署情况调整 `.env` 文件中的配置
- 首次运行需要确保向量数据库集合已正确创建
- 前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:8000`

## 故障排查

### 后端启动失败
- 检查虚拟环境是否激活
- 检查依赖是否正确安装：`uv pip list`
- 检查 `.env` 配置是否正确
- 检查 Milvus 服务是否运行：`netstat -an | grep 19530`

### API 调用失败
- 检查 CORS 配置是否包含前端地址
- 检查模型服务是否可访问（本地或云端）
- 云端 API：检查 API Key 是否有效
- 查看后端日志获取详细错误信息

### 前端无法连接后端
- 检查后端是否运行在正确的端口
- 检查前端 API 服务配置的地址是否正确
- 检查浏览器控制台的网络请求错误

## 相关文档

- [云端 API 快速启动指南](CLOUD_API_QUICKSTART.md) - 使用云服务快速部署
- [系统服务启动指南](SERVICES_SETUP.md) - 详细的本地和云端部署说明
- [API 文档](http://localhost:8000/docs) - 交互式 API 文档（启动后访问）

## License

MIT
