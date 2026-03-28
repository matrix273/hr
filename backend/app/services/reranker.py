"""Reranker module"""

import httpx
import math
from typing import List, Dict, Any
from ..config import QWEN_RERANKER_URL, QWEN_RERANKER_API_KEY, QWEN_RERANKER_MODEL

class QwenReranker:
    """Qwen3-reranker model"""

    def __init__(self):
        self.url = QWEN_RERANKER_URL
        self.api_key = QWEN_RERANKER_API_KEY
        self.model = QWEN_RERANKER_MODEL
        self.client = httpx.Client(timeout=30.0)

    @staticmethod
    def sigmoid_normalize(score: float) -> float:
        """将任意实数分数归一化到 0-1 范围
        
        Reranker 模型输出的分数可以是任意实数（如 -10 到 10），
        使用 sigmoid 函数将其映射到 0-1 范围，便于显示百分比。
        """
        # 使用缩放因子让分数分布更合理
        # 分数范围通常在 -5 到 5 之间，缩放后 sigmoid 更敏感
        scaled_score = score / 2.0
        return 1.0 / (1.0 + math.exp(-scaled_score))

    def rerank(self, query: str, documents: List[str], top_k: int = 3) -> List[Dict[str, Any]]:
        """Rerank documents based on relevance to the query"""
        import time
        import json
        from ..utils.logger import logger

        start_time = time.time()

        # 判断是否为阿里通义千问 API（基于 URL 包含 dashscope）
        is_dashscope = "dashscope" in self.url.lower()
        
        if is_dashscope:
            # 阿里通义千问 API 格式
            payload = {
                "model": self.model,
                "query": query,
                "documents": documents,
                "top_n": top_k,
                "instruct": "Given a query, retrieve relevant passages that answer the query."
            }
        else:
            # Cohere 或其他兼容 OpenAI 格式的 API
            payload = {
                "model": self.model,
                "query": query,
                "documents": documents,
                "top_k": top_k
            }

        headers = {}
        if self.api_key and self.api_key != "not_required":
            headers["Authorization"] = f"Bearer {self.api_key}"

        # 计算请求数据大小
        total_chars = len(query) + sum(len(doc) for doc in documents)
        payload_size = len(json.dumps(payload).encode('utf-8'))
        logger.info(f"Rerank 请求: 模型={self.model}, 文档数={len(documents)}, top_k={top_k}, "
                    f"总字符数={total_chars:,}, 请求大小={payload_size:,} 字节 ({payload_size/1024:.2f} KB)")

        try:
            request_start = time.time()
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
            request_time = time.time() - request_start
            logger.info(f"Reranker HTTP 请求耗时: {request_time:.2f} 秒")

            response.raise_for_status()

            result = response.json()
            reranked_results = []

            # 处理不同 API 的响应格式
            if is_dashscope:
                # 阿里通义千问格式 - 根据您提供的成功响应结构处理
                
                # 优先处理错误响应
                if "code" in result and result["code"] != "200":
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"阿里通义千问 API 错误: {result['code']} - {error_msg}")
                    raise Exception(f"阿里通义千问 API 错误: {result['code']} - {error_msg}")
                
                # 处理成功响应
                if "output" in result and "results" in result["output"]:
                    # 您提供的成功响应格式: output -> results
                    for item in result["output"]["results"]:
                        raw_score = item.get("relevance_score", 0.0)
                        # 阿里通义千问的分数已经是 0-1 范围，无需 sigmoid 归一化
                        normalized_score = raw_score
                        document_text = ""
                        
                        # 提取文档文本
                        if "document" in item and "text" in item["document"]:
                            document_text = item["document"]["text"]
                        elif "text" in item:
                            document_text = item["text"]
                        else:
                            # 使用索引获取原始文档
                            index = item.get("index", 0)
                            document_text = documents[index] if index < len(documents) else ""
                        
                        reranked_results.append({
                            "index": item.get("index", 0),
                            "score": normalized_score,
                            "raw_score": raw_score,  # 保留原始分数供调试
                            "document": document_text
                        })
                elif "data" in result:
                    # 格式1: 包含 data 字段
                    for i, item in enumerate(result["data"]):
                        raw_score = item.get("relevance_score", item.get("score", 0.0))
                        normalized_score = raw_score
                        reranked_results.append({
                            "index": i,
                            "score": normalized_score,
                            "raw_score": raw_score,
                            "document": item.get("document", item.get("text", documents[i] if i < len(documents) else ""))
                        })
                elif "results" in result:
                    # 格式2: 包含 results 字段
                    for i, item in enumerate(result["results"]):
                        raw_score = item.get("relevance_score", item.get("score", 0.0))
                        normalized_score = raw_score
                        reranked_results.append({
                            "index": i,
                            "score": normalized_score,
                            "raw_score": raw_score,
                            "document": item.get("document", item.get("text", documents[i] if i < len(documents) else ""))
                        })
                else:
                    # 格式3: 直接是数组
                    for i, item in enumerate(result):
                        raw_score = item.get("relevance_score", item.get("score", 0.0))
                        normalized_score = raw_score
                        reranked_results.append({
                            "index": i,
                            "score": normalized_score,
                            "raw_score": raw_score,
                            "document": item.get("document", item.get("text", documents[i] if i < len(documents) else ""))
                        })
                    
            else:
                # Cohere/OpenAI 兼容格式
                for item in result["results"]:
                    raw_score = item["rerank_score"]
                    # 对分数进行 sigmoid 归一化到 0-1 范围
                    normalized_score = self.sigmoid_normalize(raw_score)
                    reranked_results.append({
                        "index": item["index"],
                        "score": normalized_score,
                        "raw_score": raw_score,  # 保留原始分数供调试
                        "document": documents[item["index"]]
                    })

            total_time = time.time() - start_time
            logger.info(f"Rerank 完成, 耗时={total_time:.2f} 秒")

            return reranked_results
        except httpx.TimeoutException as e:
            total_time = time.time() - start_time
            logger.error(f"Reranker API 请求超时 (已耗时 {total_time:.2f} 秒): {self.url}, 错误: {e}")
            raise Exception(f"Reranker API 请求超时: {self.url}, 错误: {e}")
        except httpx.HTTPStatusError as e:
            total_time = time.time() - start_time
            logger.error(f"Reranker API 返回错误 (已耗时 {total_time:.2f} 秒): {e.response.status_code}, 响应: {e.response.text}")
            raise Exception(f"Reranker API 返回错误: {e.response.status_code}, 响应: {e.response.text}")
        except httpx.RequestError as e:
            total_time = time.time() - start_time
            logger.error(f"Reranker API 请求失败 (已耗时 {total_time:.2f} 秒): {e}")
            raise Exception(f"Reranker API 请求失败: {e}")