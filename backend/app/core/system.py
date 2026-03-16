"""Core system module for resume screening"""

from typing import List, Dict, Any
from ..services.embedding import QwenEmbedding
from ..services.vector_db import MilvusVectorDB
from ..services.reranker import QwenReranker
from ..services.llm import LLMClient
from ..utils.logger import logger


class ResumeScreeningSystem:
    """AI Resume Screening System"""

    def __init__(self):
        self.embedding = QwenEmbedding()
        self.vector_db = MilvusVectorDB()
        self.reranker = QwenReranker()
        self.llm = LLMClient()

    def add_resume(self, resume_id: str, resume_text: str) -> bool:
        """Add a resume to the system"""
        try:
            # Generate embedding
            logger.info(f"开始生成 embedding: resume_id={resume_id}")
            embedding = self.embedding.embed_single(resume_text)

            # Insert into vector database
            logger.info(f"开始插入向量数据库: resume_id={resume_id}, embedding维度={len(embedding)}")
            self.vector_db.insert(resume_id, resume_text, embedding)
            logger.info(f"简历添加成功: resume_id={resume_id}")
            return True
        except Exception as e:
            logger.error(f"添加简历失败: resume_id={resume_id}, 错误: {e}")
            return False

    def screen_resumes(self, job_description: str, top_k: int = 5, model: str = None) -> List[Dict[str, Any]]:
        """Screen resumes for a job description"""
        try:
            # Generate embedding for job description
            logger.info("开始生成 job description embedding")
            query_embedding = self.embedding.embed_single(job_description)
            logger.info(f"Embedding 生成完成, 维度: {len(query_embedding)}")

            # Search in vector database
            logger.info("开始在向量数据库中搜索")
            search_results = self.vector_db.search(query_embedding, top_k)
            logger.info(f"向量搜索完成, 找到 {len(search_results)} 个结果")

            # Extract resume texts
            resume_texts = [result["resume_text"] for result in search_results]
            logger.info(f"提取了 {len(resume_texts)} 个简历文本")

            # Rerank results
            logger.info("开始 rerank")
            reranked = self.reranker.rerank(job_description, resume_texts, top_k)
            logger.info(f"Rerank 完成, 返回 {len(reranked)} 个结果")

            # Evaluate top resumes with LLM
            final_results = []
            logger.info(f"开始用 LLM 评估 {len(reranked)} 个简历, 模型: {model}")

            for idx, item in enumerate(reranked):
                resume_idx = item["index"]
                resume_info = search_results[resume_idx]
                logger.info(f"评估第 {idx+1}/{len(reranked)} 个简历: {resume_info['resume_id']}")

                # Evaluate with LLM (use selected model if provided)
                llm_result = self.llm.evaluate_resume(resume_info["resume_text"], job_description, model)
                logger.info(f"简历 {resume_info['resume_id']} LLM 评估完成")

                final_results.append({
                    "resume_id": resume_info["resume_id"],
                    "rerank_score": item["score"],
                    "llm_evaluation": llm_result["choices"][0]["message"]["content"]
                })

            logger.info(f"所有简历评估完成, 返回 {len(final_results)} 个结果")
            return final_results
        except Exception as e:
            logger.error(f"Error screening resumes: {e}", exc_info=True)
            return []

    def delete_resume(self, resume_id: str) -> bool:
        """Delete a resume from the system"""
        try:
            success = self.vector_db.delete_by_resume_id(resume_id)
            return success
        except Exception as e:
            print(f"Error deleting resume: {e}")
            return False

    def close(self):
        """Close resources"""
        self.vector_db.close()
