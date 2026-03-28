# AI 简历筛选系统

基于阿里通义千问 Embedding、Milvus 向量数据库、Qwen3-Reranker 和多模型 LLM 的 AI 简历筛选系统，采用前后端分离架构，所有 AI 服务使用云端 API。

## 技术栈

### 后端
- **API 框架**: FastAPI
- **Embedding**: 阿里通义千问 text-embedding-v3（云端）
- **向量数据库**: Milvus
- **Reranker**: 阿里通义千问 qwen3-rerank（云端）
- **LLM**: 阿里通义千问 / DeepSeek / 字节豆包（云端，可切换）
- **任务队列**: Celery + Redis
- **数据库**: PostgreSQL
- **Python**: >=3.12

### 前端
- **Framework**: React 18
- **UI**: Ant Design
- **Build Tool**: Vite
- **HTTP Client**: Axios

## 项目结构

```
hr/
├── backend/                          # 后端目录
│   ├── app/
│   │   ├── main.py                   # FastAPI 应用入口
│   │   ├── config.py                 # 配置文件
│   │   ├── models/                   # 数据模型
│   │   ├── services/                 # 业务逻辑服务
│   │   │   ├── embedding.py          # 嵌入模型服务
│   │   │   ├── vector_db.py          # 向量数据库服务
│   │   │   ├── reranker.py           # 重排序服务
│   │   │   └── llm.py                # LLM 服务
│   │   ├── routes/                   # API 路由
│   │   └── core/                     # 核心系统
├── frontend/                         # 前端目录
│   └── src/
│       ├── pages/                    # 页面组件
│       │   ├── Screening.jsx         # 简历筛选（核心页面）
│       │   ├── ResumeUpload.jsx      # 简历上传
│       │   ├── JobManagement.jsx     # 岗位管理
│       │   └── ...
│       ├── components/               # 公共组件
│       └── utils/                    # 工具函数
├── alembic/                          # 数据库迁移
├── docker-compose.yml                # Milvus / PostgreSQL / Redis
├── pyproject.toml                    # Python 依赖配置
├── .env.example                      # 环境变量示例
├── start-all.sh                      # 一键启动
└── start-celery.sh                   # 启动 Celery
```

## 快速开始

### 1. 克隆项目
```bash
git clone <repo-url>
cd hr
```

### 2. 安装后端依赖
```bash
uv sync
```

### 3. 启动基础设施（Docker）
```bash
docker compose up -d
```
这会启动：Milvus（向量库）、PostgreSQL（数据库）、Redis（任务队列）。

### 4. 配置环境变量
```bash
cp .env.example .env
```
编辑 `.env`，填入以下云服务 API Key：
- `QWEN_EMBEDDING_API_KEY` — 阿里通义千问
- `QWEN_RERANKER_API_KEY` — 阿里通义千问
- `LLM_API_KEY` — 阿里通义千问（默认）/ DeepSeek / 字节豆包

### 5. 初始化数据库
```bash
alembic upgrade head
```

### 6. 启动后端
```bash
./start-backend.sh
# 或
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 7. 启动 Celery（简历上传解析）
```bash
./start-celery.sh
```

### 8. 启动前端
```bash
cd frontend && npm install && npm run dev
# 或
./start-frontend.sh
```

### 一键启动
```bash
./start-all.sh
```

## 环境变量配置

关键配置项（详见 `.env.example`）：

### AI 服务（全部使用云端 API）
```env
# Embedding - 阿里通义千问
QWEN_EMBEDDING_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
QWEN_EMBEDDING_API_KEY=your_key
QWEN_EMBEDDING_MODEL=text-embedding-v3

# Reranker - 阿里通义千问
QWEN_RERANKER_URL=https://dashscope.aliyuncs.com/compatible-api/v1/reranks
QWEN_RERANKER_API_KEY=your_key
QWEN_RERANKER_MODEL=qwen3-rerank

# LLM - 阿里通义千问（默认）
LLM_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
LLM_API_KEY=your_key
LLM_MODEL=qwen-plus
```

### 基础设施
```env
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=hr_user
POSTGRES_PASSWORD=hr_password
POSTGRES_DB=hr

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Milvus
MILVUS_HOST=localhost
MILVUS_PORT=19530
```

## 核心流程

1. **简历上传**：上传 PDF 文件，Celery 异步解析文本内容
2. **向量化**：调用阿里通义千问 Embedding API 生成向量，存入 Milvus
3. **相似检索**：根据岗位描述向量在 Milvus 中检索候选简历
4. **重排序**：调用 Qwen3-Reranker 对候选简历精准排序
5. **智能评估**：调用 LLM 对每份简历生成详细的匹配度评估
6. **导出报告**：支持 PDF / Markdown 格式导出筛选结果

## 功能特性

- 多模型 LLM 切换（通义千问 / DeepSeek / 字节豆包）
- SSE 实时推送筛选进度
- 岗位管理 + 自定义描述两种筛选模式
- PDF / Markdown 双格式导出
- 简历预览 + AI 评估详情
- 用户权限管理
- 邮箱验证码注册

## 故障排查

| 问题 | 排查方向 |
|------|---------|
| 后端启动失败 | `uv sync` 安装依赖，检查 `.env` 配置 |
| Milvus 连接失败 | `docker compose ps` 确认容器运行 |
| Embedding/Reranker 报错 | 检查 API Key 是否有效 |
| 简历上传解析失败 | 检查 Celery + Redis 是否启动 |
| 前端无法连接后端 | 检查 CORS 配置，确认后端端口 |

## License

MIT
