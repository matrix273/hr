"""Vector database module using Milvus"""

from pymilvus import connections, Collection, CollectionSchema, FieldSchema, DataType, utility
from typing import List, Dict, Any
from ..config import MILVUS_HOST, MILVUS_PORT, COLLECTION_NAME, EMBEDDING_DIM
from ..utils.logger import logger

class MilvusVectorDB:
    """Milvus vector database wrapper"""
    
    def __init__(self):
        # Connect to Milvus
        connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT)
        
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
    
    def insert(self, resume_id: str, resume_text: str, embedding: List[float]) -> List[int]:
        """Insert a resume into the collection"""
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
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar resumes"""
        search_params = {
            "metric_type": "L2",
            "params": {"nprobe": 10}
        }
        
        results = self.collection.search(
            [query_embedding],
            "embedding",
            search_params,
            limit=top_k,
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
        
        return formatted_results

    def delete_by_resume_id(self, resume_id: str) -> bool:
        """Delete a resume by resume_id"""
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
        connections.disconnect("default")