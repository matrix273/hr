# 配置文件说明

## 配置文件位置

### ✅ 推荐配置（Monorepo 风格）

```
hr/
├── pyproject.toml          # Python 依赖配置（根目录）
├── uv.lock                 # Python 依赖锁文件（根目录）
├── .env                     # 环境变量（根目录，不提交到git）
├── .env.example             # 环境变量示例（根目录，提交到git）
├── backend/
│   ├── .env.example         # 后端环境变量示例（可选）
│   └── app/config.py        # 配置加载逻辑
└── frontend/
    ├── package.json         # Node 依赖配置
    └── package-lock.json
```

## 为什么选择这种结构？

### 1. **pyproject.toml 在根目录**
- ✅ 统一管理 Python 依赖
- ✅ 可以在根目录运行 `uv run` 启动后端
- ✅ 符合现代 Python 项目工具（uv、rye）的设计理念
- ✅ 方便 Docker Compose 部署

### 2. **uv.lock 在根目录**
- ✅ 与 pyproject.toml 在同一位置
- ✅ 确保依赖版本一致
- ✅ 方便团队协作

### 3. **.env 在根目录**
- ✅ 统一管理所有环境变量
- ✅ 支持多服务共享配置
- ✅ 方便 Docker Compose 使用
- ✅ 应用代码会自动查找并加载
  - 优先级：`backend/.env` > `/.env`

### 4. **.env.example 在两个位置**
- 根目录：作为主要参考
- backend/：作为后端特定配置的参考

## 配置加载顺序

应用启动时，`backend/app/config.py` 会按以下顺序查找 `.env` 文件：

1. **backend/.env** （如果存在，优先使用）
2. **根目录/.env** （默认位置）
3. 使用默认值（如果都没有找到）

## 使用指南

### 首次配置

```bash
# 1. 复制环境变量示例
cp .env.example .env

# 2. 编辑 .env 文件，填入实际配置值
vim .env  # 或使用你喜欢的编辑器

# 3. 安装依赖（首次）
uv sync

# 4. 启动服务
./start-all.sh  # 一键启动全部服务
```

### 日常开发

```bash
# 启动后端
./start-backend.sh

# 启动前端（新终端）
./start-frontend.sh

# 或一键启动
./start-all.sh
```

### 手动启动

```bash
# 后端
uv run uvicorn hr.main:app --host 0.0.0.0 --port 8000 --reload

# 前端
cd frontend
npm run dev
```

## 环境变量说明

### 后端配置（.env）

```env
# Milvus - 向量数据库
MILVUS_HOST=localhost
MILVUS_PORT=19530

# Embedding - 嵌入模型
QWEN_EMBEDDING_URL=http://localhost:8000/v1/embeddings

# Reranker - 重排序模型
QWEN_RERANKER_URL=http://localhost:8001/v1/rerank

# LLM - 大语言模型
LLM_URL=http://localhost:8002/v1/chat/completions
LLM_API_KEY=your_api_key_here

# 应用配置
INDEX_NAME=resume_index
COLLECTION_NAME=resumes

# FastAPI - API 服务器
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000

# CORS - 跨域配置
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 前端配置（可选 frontend/.env）

如果前端需要环境变量（如 API 地址），可以在 `frontend/` 目录创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_APP_TITLE=AI Resume Screening
```

注意：前端环境变量必须以 `VITE_` 开头（Vite 规范）。

## 常见问题

### 1. 为什么不在 backend/ 下放 pyproject.toml？

虽然这样更符合传统 Python 项目结构，但：
- uv 等现代工具推荐在根目录管理
- 简化开发流程（无需每次都进入 backend/）
- 便于多项目管理（如果将来添加更多服务）

### 2. 如果我仍然想在 backend/ 下管理？

可以这样做：
1. 将 `pyproject.toml` 和 `uv.lock` 移到 `backend/`
2. 修改启动脚本：`cd backend && uv run uvicorn ...`
3. 确保从根目录或 backend/ 运行应用

### 3. 生产环境怎么办？

生产环境建议：
- 使用 Docker Compose 或 Kubernetes
- 通过环境变量或 ConfigMap/Secret 传递配置
- 不提交 `.env` 文件到版本控制

### 4. 如何配置不同的环境？

```bash
# 开发环境
cp .env.example .env.development
# 编辑 .env.development

# 生产环境
cp .env.example .env.production
# 编辑 .env.production

# 使用特定环境配置
# 在启动脚本中加载对应的 .env 文件
```

## Git 提交规则

### 应该提交：
- ✅ `pyproject.toml`
- ✅ `.env.example`（两个位置）
- ✅ `package.json`
- ✅ `package-lock.json`

### 不应该提交：
- ❌ `.env`
- ❌ `uv.lock`（可选，取决于团队策略）
- ❌ 任何包含敏感信息的配置

## 迁移检查清单

从之前的结构迁移到新结构：

- [ ] 将 `backend/pyproject.toml` 的依赖合并到根目录 `pyproject.toml`
- [ ] 移动 `backend/uv.lock` 到根目录
- [ ] 清理重复的 `.env` 文件
- [ ] 创建 `.env.example` 文件
- [ ] 更新 `backend/app/config.py` 以支持新的文件位置
- [ ] 更新启动脚本
- [ ] 更新文档
- [ ] 测试应用启动
- [ ] 提交更改

---

配置管理最佳实践：
1. 始终使用 `.env.example` 作为模板
2. 不要提交 `.env` 到版本控制
3. 使用不同的 `.env.*.local` 文件管理不同环境
4. 定期审查和更新配置
5. 使用默认值使应用可以无配置启动（用于开发）
