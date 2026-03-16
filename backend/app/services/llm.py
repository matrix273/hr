"""LLM module for resume evaluation"""

import httpx
from typing import Dict, Any
from ..config import LLM_URL, LLM_API_KEY, LLM_MODEL, LLM_PROVIDERS

class LLMClient:
    """LLM client for resume evaluation"""

    def __init__(self):
        self.url = LLM_URL
        self.api_key = LLM_API_KEY
        self.model = LLM_MODEL
        self.client = httpx.Client(timeout=30.0)

    def _get_model_config(self, model: str = None) -> Dict[str, str]:
        """Get configuration for the specified model"""
        if not model:
            return {"url": self.url, "api_key": self.api_key, "model": self.model}

        # 检查是否是多模型配置中的模型
        if model in LLM_PROVIDERS:
            return LLM_PROVIDERS[model]

        # 如果不是预配置模型,使用默认配置
        return {"url": self.url, "api_key": self.api_key, "model": model}
    
    def evaluate_resume(self, resume_text: str, job_description: str, model: str = None) -> Dict[str, Any]:
        """Evaluate resume against job description"""
        import time
        from ..utils.logger import logger

        start_time = time.time()

        prompt = f"""请评估以下简历是否符合职位描述，并提供详细分析：

职位描述：
{job_description}

简历：
{resume_text}

评估内容应包括：
1. 整体匹配度评分（0-100）
2. 技能匹配分析
3. 经验匹配分析
4. 教育背景匹配分析
5. 优势与劣势
6. 建议
"""

        # 获取模型配置
        model_config = self._get_model_config(model)

        payload = {
            "model": model_config["model"],
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": 0.7
        }

        headers = {
            "Content-Type": "application/json",
        }

        if model_config["api_key"] and model_config["api_key"] != "not_required":
            headers["Authorization"] = f"Bearer {model_config['api_key']}"

        # 记录请求数据大小
        payload_json = payload
        request_size = len(str(payload_json).encode('utf-8'))
        logger.info(f"LLM 请求: 模型={model_config['model']}, "
                    f"请求大小={request_size:,} 字节 ({request_size/1024:.2f} KB), "
                    f"prompt字符数={len(prompt):,}")

        try:
            request_start = time.time()
            response = self.client.post(
                model_config["url"],
                json=payload,
                headers=headers,
                timeout=httpx.Timeout(
                    connect=10.0,
                    read=60.0,
                    write=10.0,
                    pool=5.0
                )
            )
            request_time = time.time() - request_start
            logger.info(f"LLM HTTP 请求耗时: {request_time:.2f} 秒")

            response.raise_for_status()
            result = response.json()

            response_size = len(str(result).encode('utf-8'))
            total_time = time.time() - start_time
            logger.info(f"LLM 响应: 大小={response_size:,} 字节 ({response_size/1024:.2f} KB), "
                        f"总耗时={total_time:.2f} 秒")

            return result
        except httpx.TimeoutException as e:
            total_time = time.time() - start_time
            logger.error(f"LLM API 请求超时 (已耗时 {total_time:.2f} 秒): {model_config['url']}, 错误: {e}")
            raise Exception(f"LLM API 请求超时: {model_config['url']}, 错误: {e}")
        except httpx.HTTPStatusError as e:
            total_time = time.time() - start_time
            logger.error(f"LLM API 返回错误 (已耗时 {total_time:.2f} 秒): {e.response.status_code}, 响应: {e.response.text}")
            raise Exception(f"LLM API 返回错误: {e.response.status_code}, 响应: {e.response.text}")
        except httpx.RequestError as e:
            total_time = time.time() - start_time
            logger.error(f"LLM API 请求失败 (已耗时 {total_time:.2f} 秒): {e}")
            raise Exception(f"LLM API 请求失败: {e}")