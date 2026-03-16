# pyproject.toml 修复总结

## 🐛 原始错误

```bash
error: Failed to parse: `/Users/matrix273/pycharmprojects/hr/pyproject.toml`
  Caused by: TOML parse error at line 16, column 1
   |
16 | [project.dependencies]
   | ^^^^^^^^^^^^^^^^^^^^^^
invalid type: map, expected a sequence
```

## 📋 问题分析

### 问题 1：重复的 `[project]` 段落
原文件中：
- 第 1-9 行：项目元数据（没有 `[project]` 标记）
- 第 11 行：`[project]` 段落开始（只有 packages）
- 第 16 行：`[project.dependencies]` - 错误的 TOML 语法

### 问题 2：错误的 TOML 语法
- `[project.dependencies]` 不是有效的 TOML 写法
- 正确写法：在 `[project]` 段落内使用 `dependencies = [...]`

### 问题 3：相对导入错误
- `backend/app/main.py` 中使用了 `from ..config import ...`
- 但 main.py 和 config.py 在同一目录，应该用 `from .config import ...`

## ✅ 修复方案

### 1. 修复 `pyproject.toml`

```toml
[project]
name = "hr"
version = "0.1.0"
description = "AI Resume Screening System based on Qwen3-Embedding, Milvus, and DeepSeek/Qwen"
requires-python = ">=3.12"
authors = [
    {name = "Your Name", email = "your.email@example.com"}
]
readme = "README.md"

# Dependencies（在 [project] 段落内）
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "python-multipart>=0.0.6",
    "pymilvus>=2.4.0",
    "sentence-transformers>=2.7.0",
    "langchain>=0.1.0",
    "langchain-core>=0.1.0",
    "langchain-community>=0.1.0",
    "requests>=2.31.0",
    "python-dotenv>=1.0.0",
]

[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[tool.setuptools]
package-dir = {"" = "backend"}

[dependency-groups]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.21.0",
    "httpx>=0.25.0",
]
```

**关键改进**：
- ✅ 所有项目信息都在一个 `[project]` 段落内
- ✅ 使用 `dependencies = [...]` 而不是 `[project.dependencies]`
- ✅ 添加 `tool.setuptools.package-dir` 将包根目录指向 `backend/`
- ✅ 移除废弃的 `tool.uv.dev-dependencies`，改用 `dependency-groups`

### 2. 修复相对导入

**`backend/app/main.py`**
```python
# 修复前（错误）
from ..config import CORS_ORIGINS, FASTAPI_HOST, FASTAPI_PORT

# 修复后（正确）
from .config import CORS_ORIGINS, FASTAPI_HOST, FASTAPI_PORT

# 同时修复 uvicorn 入口点
uvicorn.run(
    "app.main:app",  # 修复前是 "hr.main:app"
    host=FASTAPI_HOST,
    port=FASTAPI_PORT,
    reload=True
)
```

**其他文件保持不变**：
- `services/*.py` - 使用 `from ..config` （正确，因为 services 是子包）
- `core/*.py` - 使用 `from ..` 导入同级模块（正确）
- `models/*.py` - 使用 `from ..` 导入同级模块（正确）

## ✅ 验证结果

### 1. 包安装
```bash
uv pip install -e .
```

**结果**：✅ 成功
```
Resolved 97 packages in 72ms
Building hr @ file:///Users/matrix273/pycharmprojects/hr
Built hr @ file:///Users/matrix273/pycharmprojects/hr
Installed 1 package in 1ms
+ hr==0.1.0 (from file:///Users/matrix273/pycharmprojects/hr)
```

### 2. 模块导入测试
```bash
uv run python -c "from app.main import app"
uv run python -c "from app.core.system import ResumeScreeningSystem"
uv run python -c "from app.services.embedding import QwenEmbedding"
uv run python -c "from app.models.schemas import ResumeRequest"
```

**结果**：✅ 所有导入成功

### 3. 服务启动测试
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**结果**：✅ 服务正常启动

## 📁 包结构说明

### 目录结构
```
backend/
└── app/              # Python 包（app）
    ├── __init__.py
    ├── main.py         # 使用 from .config
    ├── config.py
    ├── core/           # 子包
    ├── models/         # 子包
    └── services/       # 子包
        ├── *.py        # 使用 from ..config
```

### 相对导入规则
- **同级文件**：`from .config`
- **父目录**：`from ..config`
- **子包**：`from .core.system`

## 🚀 使用方式

### 安装依赖
```bash
# 从项目根目录
uv sync

# 或
uv pip install -e .
```

### 启动后端
```bash
# 方式1：使用启动脚本（推荐）
./start-backend.sh

# 方式2：使用 uv run
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 方式3：从虚拟环境
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 添加新依赖
```bash
uv add package-name

# 例如：
uv add httpx
```

## 📚 关键知识点

### 1. pyproject.toml 结构
```toml
[project]
name = "..."
version = "..."
dependencies = [
    "package>=1.0.0",
]

[build-system]
requires = ["..."]
build-backend = "..."

[tool.setuptools]
package-dir = {"" = "backend"}  # 将包根目录指向 backend/
```

### 2. 依赖格式
- ✅ `dependencies = ["package>=1.0.0", "other-package"]`
- ❌ `[project.dependencies]` （错误的 TOML 语法）
- ❌ `dependencies = {"package" = "1.0.0"}` （错误的格式）

### 3. 包发现
`[tool.setuptools.package-dir]` 指定包的根目录：
```toml
package-dir = {"" = "backend"}  # backend/ 下找 app 包
```

这样配置后，`pip install -e .` 会：
- 从 `backend/` 寻找 Python 包
- 安装后可以 `import app`

## ✅ 总结

所有问题已修复：
- ✅ 修复 pyproject.toml 的 TOML 语法错误
- ✅ 修复 main.py 的相对导入错误
- ✅ 配置正确的包发现机制
- ✅ 验证所有模块导入正常
- ✅ 验证服务启动正常

项目现在可以正常使用 `uv` 进行依赖管理和开发了！

---

修复时间：2026-03-16
修复内容：pyproject.toml 和导入路径
