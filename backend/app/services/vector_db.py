"""Vector database module using Milvus"""

from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility
from typing import List, Dict, Any, Optional
from ..config import MILVUS_HOST, MILVUS_PORT, COLLECTION_NAME, EMBEDDING_DIM
from ..utils.logger import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import AsyncSessionLocal
from ..models.user import Resume

class MilvusVectorDB:
    """Milvus vector database wrapper with graceful degradation"""
    
    def __init__(self):
        self.connected = False
        self.collection = None
        
        try:
            # Connect to Milvus with timeout
            connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT, timeout=10)
            
            # Define collection schema
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="resume_id", dtype=DataType.VARCHAR, max_length=255),
                FieldSchema(name="resume_text", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM)
            ]
            
            schema = CollectionSchema(fields, "Resume embeddings collection")

            # Create or load collection
            if COLLECTION_NAME not in utility.list_collections():
                self.collection = Collection(COLLECTION_NAME, schema)
                # Create index
                index_params = {
                    "metric_type": "L2",
                    "index_type": "IVF_FLAT",
                    "params": {"nlist": 128}
                }
                self.collection.create_index("embedding", index_params)
            else:
                self.collection = Collection(COLLECTION_NAME)
            
            # Load collection into memory
            self.collection.load()
            self.connected = True
            logger.info("Milvus 连接成功")
            
        except Exception as e:
            logger.warning(f"Milvus 连接失败，系统将以降级模式运行: {e}")
            self.connected = False
    
    def insert(self, resume_id: str, resume_text: str, embedding: List[float]) -> List[int]:
        """Insert a resume into the collection"""
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过插入: resume_id={resume_id}")
            return []
        
        try:
            entities = [
                [resume_id],  # resume_id
                [resume_text],  # resume_text
                [embedding]  # embedding
            ]

            result = self.collection.insert(entities)
            logger.info(f"成功插入向量到 Milvus: resume_id={resume_id}")
            return result
        except Exception as e:
            logger.error(f"插入向量失败: resume_id={resume_id}, 错误: {e}")
            raise
    
    def insert_with_chunks(self, resume_id: str, resume_text: str, main_embedding: List[float], 
                          chunks: List[Dict[str, Any]]) -> bool:
        """Insert a resume with multiple chunks into the collection
        
        Args:
            resume_id: 简历ID
            resume_text: 完整简历文本
            main_embedding: 主embedding向量（第一个块）
            chunks: 所有文本块信息
            
        Returns:
            是否插入成功
        """
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过插入: resume_id={resume_id}")
            return False
        
        try:
            # 存储主向量（保持向后兼容）
            main_entities = [
                [resume_id],  # resume_id
                [resume_text],  # resume_text
                [main_embedding]  # embedding
            ]
            
            self.collection.insert(main_entities)
            
            # 存储每个块的向量（使用不同的resume_id标识）
            for i, chunk_info in enumerate(chunks):
                chunk_id = f"{resume_id}_chunk_{i}"
                chunk_entities = [
                    [chunk_id],  # resume_id
                    [chunk_info["text"]],  # resume_text
                    [chunk_info["embedding"]]  # embedding
                ]
                self.collection.insert(chunk_entities)
            
            logger.info(f"成功插入多向量到 Milvus: resume_id={resume_id}, 块数={len(chunks)}")
            return True
        except Exception as e:
            logger.error(f"插入多向量失败: resume_id={resume_id}, 错误: {e}")
            return False
    
    # oversampling 倍数：Milvus 取 top_k * OVERSAMPLE_FACTOR 条，
    # 过滤后再截取 top_k，保证 top_k=1 和 top_k=5 的候选集一致
    OVERSAMPLE_FACTOR = 5
    MIN_SEARCH_LIMIT = 30

    async def search(self, query_embedding: List[float], top_k: int = 5,
                time_range: Optional[int] = 7, only_unscreened: Optional[bool] = False,
                filter_job_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for similar resumes with optional filters

        使用 oversampling 策略：从 Milvus 取远大于 top_k 的候选集，
        应用层过滤后再截取 top_k 条，确保排序一致性。

        Args:
            query_embedding: Query embedding vector
            top_k: Number of top results to return
            time_range: Time range in days (0 for all time)
            only_unscreened: Only return unscreened resumes
            filter_job_id: Filter by job ID

        Returns:
            List of search results
        """
        if not self.connected:
            logger.warning("Milvus 不可用，返回空搜索结果")
            return []

        try:
            search_params = {
                "metric_type": "L2",
                "params": {"nprobe": 10}
            }

            # oversampling：取远大于 top_k 的候选集，保证过滤后仍有足够结果
            search_limit = max(top_k * self.OVERSAMPLE_FACTOR, self.MIN_SEARCH_LIMIT)

            # 执行向量搜索
            results = self.collection.search(
                [query_embedding],
                "embedding",
                search_params,
                limit=search_limit,
                output_fields=["resume_id", "resume_text"]
            )

            # Format results
            formatted_results = []
            for hits in results:
                for hit in hits:
                    formatted_results.append({
                        "resume_id": hit.entity.get("resume_id"),
                        "resume_text": hit.entity.get("resume_text"),
                        "distance": hit.distance
                    })

            # 应用层筛选（时间范围和是否已筛选）
            if time_range or only_unscreened or filter_job_id:
                formatted_results = await self._apply_filters(formatted_results, time_range, only_unscreened, filter_job_id)

            # 过滤后截取 top_k 条返回
            formatted_results = formatted_results[:top_k]

            return formatted_results
        except Exception as e:
            logger.error(f"向量搜索失败: {e}")
            return []
    
    async def _apply_filters(self, search_results: List[Dict[str, Any]], 
                           time_range: Optional[int] = None, 
                           only_unscreened: Optional[bool] = False,
                           filter_job_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Apply time range and screening status filters to search results
        
        Args:
            search_results: Raw search results from vector DB
            time_range: Time range in days (0 for all time)
            only_unscreened: Only return unscreened resumes
            filter_job_id: Filter by job ID
            
        Returns:
            Filtered search results
        """
        if not search_results:
            return []
        
        # 获取简历ID列表
        resume_ids = [result["resume_id"] for result in search_results]
        
        async with AsyncSessionLocal() as db:
            # 构建查询条件
            query = select(Resume).where(Resume.resume_id.in_(resume_ids))
            
            # 时间范围筛选
            if time_range and time_range > 0:
                from datetime import datetime, timedelta
                cutoff_date = datetime.now() - timedelta(days=time_range)
                query = query.where(Resume.created_at >= cutoff_date)
            
            # 是否已筛选筛选
            if only_unscreened:
                query = query.where(Resume.is_screened == False)
            
            # 岗位ID筛选
            if filter_job_id:
                query = query.where(Resume.job_id == filter_job_id)
            
            # 执行查询
            result = await db.execute(query)
            filtered_resumes = result.scalars().all()
            
            # 构建过滤后的简历ID集合
            filtered_resume_ids = {resume.resume_id for resume in filtered_resumes}
            
            # 过滤搜索结果
            filtered_results = [
                result for result in search_results 
                if result["resume_id"] in filtered_resume_ids
            ]
            
            logger.info(f"应用筛选条件: 时间范围={time_range}天, 仅未筛选={only_unscreened}, 岗位ID={filter_job_id}")
            logger.info(f"筛选前: {len(search_results)} 个结果, 筛选后: {len(filtered_results)} 个结果")
            
            return filtered_results

    def delete_by_resume_id(self, resume_id: str) -> bool:
        """Delete a resume by resume_id"""
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过删除: resume_id={resume_id}")
            return True  # 返回 True 表示操作"成功"，避免阻塞其他功能
        
        try:
            # 先查询获取 entity id
            results = self.collection.query(
                expr=f"resume_id == '{resume_id}'",
                output_fields=["id"]
            )

            if results:
                entity_ids = [item["id"] for item in results]
                # 删除对应的实体
                self.collection.delete(expr=f"id in {entity_ids}")
                logger.info(f"已从向量数据库删除简历: {resume_id}")
                return True
            else:
                logger.warning(f"向量数据库中未找到简历: {resume_id}")
                return False
        except Exception as e:
            logger.error(f"从向量数据库删除简历失败: {e}")
            return False

    def close(self):
        """Close the connection"""
        if self.connected:
            connections.disconnect("default")
    
    def is_connected(self) -> bool:
        """Check if Milvus is connected"""
        return self.connected