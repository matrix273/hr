#!/usr/bin/env python3
"""
Qwen3-Reranker-0.6B 本地服务
支持 OpenAI 兼容的 /v1/rerank API
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer
import uvicorn
import os
import sys

# 添加项目根目录到路径（backend 的父目录）
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.utils.logger import setup_logger, logger

# 初始化日志
setup_logger(log_file="logs/reranker.log")

app = FastAPI(title="Qwen3-Reranker API")

# 模型配置 - 使用本地模型路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 环变量 RERANKER_MODEL_PATH 可覆盖模型路径
MODEL_NAME = os.getenv("RERANKER_MODEL_PATH", os.path.join(SCRIPT_DIR, "app/models/Qwen/Qwen3_Reranker_0.6B"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

logger.info(f"Model path: {MODEL_NAME}")

logger.info(f"Loading {MODEL_NAME} on {DEVICE}...")

# 加载模型和 tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
model = AutoModelForSequenceClassification.from_pretrained(
    MODEL_NAME,
    trust_remote_code=True,
    torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32
).to(DEVICE)

# 如果模型没有 pad_token，使用 eos_token 作为 pad_token
logger.info(f"Tokenizer pad_token before: {repr(tokenizer.pad_token)}")
logger.info(f"Tokenizer eos_token before: {repr(tokenizer.eos_token)}")
logger.info(f"Tokenizer pad_token_id before: {tokenizer.pad_token_id}")

# 强制设置 pad_token 为 eos_token，因为模型的 pad_token 配置为空字符串
logger.info("Setting pad_token to eos_token")
if tokenizer.eos_token:
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.pad_token_id = tokenizer.eos_token_id
    # 同时更新模型配置
    model.config.pad_token_id = tokenizer.pad_token_id
    logger.info(f"Set pad_token to eos_token: {repr(tokenizer.pad_token)}")
    logger.info(f"Set pad_token_id: {tokenizer.pad_token_id}")
    logger.info(f"Set model.config.pad_token_id: {model.config.pad_token_id}")
else:
    # 如果 eos_token 也没有，添加一个新的 pad token
    tokenizer.add_special_tokens({'pad_token': '[PAD]'})
    model.resize_token_embeddings(len(tokenizer))
    logger.info("Added [PAD] token as pad_token")

logger.info(f"Tokenizer pad_token after: {repr(tokenizer.pad_token)}")
logger.info(f"Tokenizer pad_token_id after: {tokenizer.pad_token_id}")

model.eval()
logger.info(f"Model loaded successfully on {DEVICE}")


class RerankRequest(BaseModel):
    """Rerank 请求模型"""
    model: str = "Qwen3-Reranker-0.6B"
    query: str
    documents: List[str]
    top_k: Optional[int] = None


class RerankResponse(BaseModel):
    """Rerank 响应模型"""
    model: str
    results: List[dict]


@app.get("/")
async def root():
    """根路径"""
    logger.info("Root endpoint called")
    return {
        "model": MODEL_NAME,
        "endpoint": "/v1/rerank",
        "device": DEVICE
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy"}


@app.post("/v1/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    """
    重排序文档

    Args:
        request: 包含 query 和 documents 的请求

    Returns:
        按相关性排序的结果
    """
    if not request.documents:
        logger.warning("Received empty documents list")
        raise HTTPException(status_code=400, detail="Documents list cannot be empty")

    logger.info(f"Reranking {len(request.documents)} documents")
    
    # 确定 top_k
    top_k = request.top_k if request.top_k else len(request.documents)
    
    # 准备输入对 (query, document)
    pairs = [[request.query, doc] for doc in request.documents]
    
    # 分词
    inputs = tokenizer(
        pairs,
        padding=True,
        truncation=True,
        return_tensors="pt",
        max_length=512,
        pad_token_id=tokenizer.pad_token_id
    ).to(DEVICE)
    
    # 计算分数
    with torch.no_grad():
        outputs = model(**inputs)
        scores = outputs.logits.squeeze(-1).cpu().tolist()
        # 确保每个分数都是标量
        if isinstance(scores, list):
            scores = [s[0] if isinstance(s, list) else s for s in scores]
    
    # 排序
    indexed_scores = list(enumerate(scores))
    indexed_scores.sort(key=lambda x: x[1], reverse=True)
    
    # 构建结果
    results = []
    for rank, (original_idx, score) in enumerate(indexed_scores[:top_k]):
        results.append({
            "index": int(original_idx),
            "rerank_score": float(score),
            "document": request.documents[original_idx]
        })

    logger.info(f"Reranking completed, returned {len(results)} results")
    return RerankResponse(
        model=request.model,
        results=results
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind")
    parser.add_argument("--port", type=int, default=8001, help="Port to bind")
    parser.add_argument("--workers", type=int, default=1, help="Number of workers")
    args = parser.parse_args()

    logger.info(f"Starting Qwen3-Reranker-0.6B server...")
    logger.info(f"  Model: {MODEL_NAME}")
    logger.info(f"  Device: {DEVICE}")
    logger.info(f"  Host: {args.host}")
    logger.info(f"  Port: {args.port}")
    logger.info(f"  API: http://{args.host}:{args.port}/v1/rerank")

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        workers=args.workers
    )
