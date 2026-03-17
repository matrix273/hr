#!/usr/bin/env python3
"""
Qwen3-Embedding-0.6B 本地服务
支持 OpenAI 兼容的 /v1/embeddings API
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
from transformers import AutoModel, AutoTokenizer
import uvicorn
import os
import sys

# 尝试导入 sentence_transformers，如果没有则使用 transformers
try:
    from sentence_transformers import SentenceTransformer
    USE_SENTENCE_TRANSFORMERS = True
except ImportError:
    USE_SENTENCE_TRANSFORMERS = False

# 添加项目根目录到路径（backend 的父目录）
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.utils.logger import setup_logger, logger

# 初始化日志
setup_logger(log_file="logs/embedding.log")

app = FastAPI(title="Qwen3-Embedding API")

# 模型配置 - 使用本地模型路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 环变量 EMBEDDING_MODEL_PATH 可覆盖模型路径
MODEL_NAME = os.getenv("EMBEDDING_MODEL_PATH", os.path.join(SCRIPT_DIR, "app/models/Qwen/Qwen3-Embedding-0.6B"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Loading {MODEL_NAME} on {DEVICE}...")

# 加载模型
if USE_SENTENCE_TRANSFORMERS:
    logger.info("Using SentenceTransformer")
    model = SentenceTransformer(MODEL_NAME, device=DEVICE)
else:
    logger.info("Using AutoModel")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    model = AutoModel.from_pretrained(
        MODEL_NAME,
        trust_remote_code=True,
        torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32
    ).to(DEVICE)
    model.eval()

logger.info(f"Model loaded successfully on {DEVICE}")


class EmbeddingRequest(BaseModel):
    """Embedding 请求模型"""
    model: str = "Qwen3-Embedding-0.6B"
    input: List[str]  # 单个文本或文本列表
    encoding_format: Optional[str] = "float"  # float 或 base64


class EmbeddingResponse(BaseModel):
    """Embedding 响应模型"""
    model: str
    data: List[dict]
    usage: dict


@app.get("/")
async def root():
    """根路径"""
    logger.info("Root endpoint called")
    return {
        "model": MODEL_NAME,
        "endpoint": "/v1/embeddings",
        "device": DEVICE
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy"}


@app.post("/v1/embeddings", response_model=EmbeddingResponse)
async def create_embeddings(request: EmbeddingRequest):
    """
    创建文本嵌入向量

    Args:
        request: 包含 input（文本列表）的请求

    Returns:
        包含嵌入向量的响应
    """
    if not request.input:
        logger.warning("Received empty input list")
        raise HTTPException(status_code=400, detail="Input list cannot be empty")

    # 统一处理输入为列表
    if isinstance(request.input, str):
        texts = [request.input]
    else:
        texts = request.input

    logger.info(f"Creating embeddings for {len(texts)} texts")

    # 计算嵌入
    if USE_SENTENCE_TRANSFORMERS:
        # 使用 SentenceTransformer
        embeddings = model.encode(texts, convert_to_numpy=True)
    else:
        # 使用 AutoModel
        inputs = tokenizer(
            texts,
            padding=True,
            truncation=True,
            return_tensors="pt",
            max_length=512
        ).to(DEVICE)

        with torch.no_grad():
            outputs = model(**inputs)
            # 使用 [CLS] token
            embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()

    # 构建响应
    data = []
    for i, (embedding, text) in enumerate(zip(embeddings, texts)):
        data.append({
            "object": "embedding",
            "embedding": embedding.tolist(),
            "index": i
        })

    logger.info(f"Embeddings created successfully for {len(texts)} texts")

    return EmbeddingResponse(
        model=request.model,
        data=data,
        usage={
            "prompt_tokens": sum(len(text.split()) for text in texts),
            "total_tokens": sum(len(text.split()) for text in texts)
        }
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8010, help="Port to bind")
    parser.add_argument("--workers", type=int, default=1, help="Number of workers")
    args = parser.parse_args()

    logger.info(f"Starting Qwen3-Embedding-0.6B server...")
    logger.info(f"  Model: {MODEL_NAME}")
    logger.info(f"  Device: {DEVICE}")
    logger.info(f"  Host: {args.host}")
    logger.info(f"  Port: {args.port}")
    logger.info(f"  API: http://{args.host}:{args.port}/v1/embeddings")

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        workers=args.workers
    )
