"""应用配置"""

import os
import json
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


def _detect_embedding_dimension() -> int:
    """通过实际调用 embedding 服务检测输出维度"""
    try:
        import requests

        # 从环境变量获取配置
        url = os.getenv("QWEN_EMBEDDING_URL", "http://localhost:8010/v1/embeddings")
        api_key = os.getenv("QWEN_EMBEDDING_API_KEY", "not_required")
        model = os.getenv("QWEN_EMBEDDING_MODEL", "text-embedding-v3")

        print(f"正在检测 embedding 维度...")
        print(f"  服务地址: {url}")
        print(f"  模型: {model}")

        # 准备测试请求
        payload = {
            "model": model,
            "input": ["test"]
        }

        headers = {}
        if api_key and api_key != "not_required":
            headers["Authorization"] = f"Bearer {api_key}"

        # 调用 embedding 服务
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()

        # 获取 embedding 维度
        result = response.json()
        if "data" in result and len(result["data"]) > 0:
            embedding = result["data"][0]["embedding"]
            dimension = len(embedding)

            print(f"✓ 自动检测到 embedding 维度: {dimension}")
            return dimension
        else:
            print(f"✗ 响应格式错误，使用默认值 1024")
            return 1024

    except requests.exceptions.RequestException as e:
        print(f"✗ 无法连接到 embedding 服务: {e}")
        print(f"  使用默认值 1024")
        return 1024
    except Exception as e:
        print(f"✗ 检测 embedding 维度时出错: {e}")
        print(f"  使用默认值 1024")
        return 1024


# Milvus Configuration
MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = int(os.getenv("MILVUS_PORT", "19530"))

# Embedding Model Configuration
QWEN_EMBEDDING_URL = os.getenv("QWEN_EMBEDDING_URL", "http://localhost:8010/v1/embeddings")
QWEN_EMBEDDING_API_KEY = os.getenv("QWEN_EMBEDDING_API_KEY", "not_required")
QWEN_EMBEDDING_MODEL = os.getenv("QWEN_EMBEDDING_MODEL", "text-embedding-v3")

# Reranker Model Configuration
QWEN_RERANKER_URL = os.getenv("QWEN_RERANKER_URL", "http://localhost:8001/v1/rerank")
QWEN_RERANKER_API_KEY = os.getenv("QWEN_RERANKER_API_KEY", "not_required")
QWEN_RERANKER_MODEL = os.getenv("QWEN_RERANKER_MODEL", "Qwen3-Reranker-0.6B")

# LLM Configuration
LLM_URL = os.getenv("LLM_URL", "http://localhost:8002/v1/chat/completions")
LLM_API_KEY = os.getenv("LLM_API_KEY", "not_required")
LLM_MODEL = os.getenv("LLM_MODEL", "Qwen3.5-0.8B")

# 多模型 LLM Configuration
LLM_PROVIDERS = {
    "qwen-plus": {
        "url": os.getenv("QWEN_LLM_URL", "http://localhost:8002/v1/chat/completions"),
        "api_key": os.getenv("QWEN_LLM_API_KEY", "not_required"),
        "model": os.getenv("QWEN_LLM_MODEL", "Qwen3.5-0.8B")
    },
    "deepseek-chat": {
        "url": os.getenv("DEEPSEEK_LLM_URL", "http://localhost:8002/v1/chat/completions"),
        "api_key": os.getenv("DEEPSEEK_LLM_API_KEY", "not_required"),
        "model": os.getenv("DEEPSEEK_LLM_MODEL", "Qwen3.5-0.8B")
    },
    "Doubao-pro-32k": {
        "url": os.getenv("DOUBAO_LLM_URL", "http://localhost:8002/v1/chat/completions"),
        "api_key": os.getenv("DOUBAO_LLM_API_KEY", "not_required"),
        "model": os.getenv("DOUBAO_LLM_MODEL", "Doubao-pro-32k")
    },
    "Qwen3.5-0.8B": {
        "url": "http://localhost:8002/v1/chat/completions",
        "api_key": "not_required",
        "model": "Qwen3.5-0.8B"
    },
    "Qwen3.5-4B": {
        "url": "http://localhost:8002/v1/chat/completions",
        "api_key": "not_required",
        "model": "Qwen3.5-4B"
    }
}

# Application Configuration
INDEX_NAME = os.getenv("INDEX_NAME", "resume_index")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "resumes")

# Embedding Dimension - 注意: 本地 embedding 服务输出 1024 维
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", 1024))

# FastAPI Configuration
FASTAPI_HOST = os.getenv("FASTAPI_HOST", "0.0.0.0")
FASTAPI_PORT = int(os.getenv("FASTAPI_PORT", "8000"))

# CORS Configuration
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")

# PostgreSQL Configuration
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "localhost")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_USER = os.getenv("POSTGRES_USER", "hr_user")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "hr_password")
POSTGRES_DB = os.getenv("POSTGRES_DB", "hr_db")

# Redis Configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Celery Configuration
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30 * 24 * 60"))  # 30 days
