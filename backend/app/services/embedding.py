"""Embedding module"""

import httpx
from typing import List, Dict, Any
from ..config import QWEN_EMBEDDING_URL, QWEN_EMBEDDING_API_KEY, QWEN_EMBEDDING_MODEL

class QwenEmbedding:
    """Qwen3-Embedding-0.6B embedding model"""

    def __init__(self):
        self.url = QWEN_EMBEDDING_URL
        self.api_key = QWEN_EMBEDDING_API_KEY
        self.model = QWEN_EMBEDDING_MODEL
        self.client = httpx.Client(timeout=30.0)

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        payload = {
            "model": self.model,
            "input": texts
        }

        headers = {}
        if self.api_key and self.api_key != "not_required":
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            response = self.client.post(
                self.url,
                json=payload,
                headers=headers,
                timeout=httpx.Timeout(
                    connect=5.0,
                    read=60.0,
                    write=5.0,
                    pool=5.0
                )
            )
            response.raise_for_status()

            result = response.json()
            embeddings = [item["embedding"] for item in result["data"]]

            return embeddings
        except httpx.TimeoutException as e:
            raise Exception(f"Embedding API 请求超时: {self.url}, 错误: {e}")
        except httpx.HTTPStatusError as e:
            raise Exception(f"Embedding API 返回错误: {e.response.status_code}, 响应: {e.response.text}")
        except httpx.RequestError as e:
            raise Exception(f"Embedding API 请求失败: {e}")

    def embed_single(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        return self.embed([text])[0]