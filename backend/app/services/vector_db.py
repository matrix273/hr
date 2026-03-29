"""Vector database module using Milvus

将业务过滤条件（时间范围、是否已评估）下推到 Milvus 搜索阶段，
在向量计算时直接过滤，避免对无关节历计算向量距离。

注意：job_id 不存储在 Milvus 中，因为岗位内容可修改，
静态关联会导致数据不一致。向量搜索应覆盖所有简历，
岗位维度的过滤在应用层处理。
"""

from datetime import datetime, timedelta
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

    # 当前 schema 版本，用于检测是否需要迁移
    SCHEMA_VERSION = 2

    def __init__(self):
        self.connected = False
        self.collection = None

        try:
            connections.connect("default", host=MILVUS_HOST, port=MILVUS_PORT, timeout=10)

            # 定义 collection schema（含过滤标量字段）
            fields = [
                FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
                FieldSchema(name="resume_id", dtype=DataType.VARCHAR, max_length=255),
                FieldSchema(name="resume_text", dtype=DataType.VARCHAR, max_length=65535),
                FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=EMBEDDING_DIM),
                # 过滤标量字段
                FieldSchema(name="created_at", dtype=DataType.INT64, default_value=0),
                FieldSchema(name="is_screened", dtype=DataType.BOOL, default_value=False),
            ]

            schema = CollectionSchema(fields, "Resume embeddings collection v3")

            # 检查是否需要迁移：schema 字段集不匹配时需重建
            expected_fields = {f.name for f in fields}
            need_recreate = False
            if COLLECTION_NAME in utility.list_collections():
                existing = Collection(COLLECTION_NAME)
                existing_field_names = {f.name for f in existing.schema.fields}
                if not expected_fields.issubset(existing_field_names) or "job_id" in existing_field_names:
                    logger.warning(
                        "Milvus collection schema 不匹配，"
                        "将删除旧 collection 并重建，简历需要重新 embedding"
                    )
                    existing.drop()
                    need_recreate = True
                else:
                    self.collection = existing

            if not need_recreate and self.collection is None:
                if COLLECTION_NAME in utility.list_collections():
                    self.collection = Collection(COLLECTION_NAME)

            if self.collection is None or need_recreate:
                self.collection = Collection(COLLECTION_NAME, schema)
                index_params = {
                    "metric_type": "L2",
                    "index_type": "IVF_FLAT",
                    "params": {"nlist": 128}
                }
                self.collection.create_index("embedding", index_params)

            self.collection.load()
            self.connected = True
            logger.info("Milvus 连接成功")

        except Exception as e:
            logger.warning(f"Milvus 连接失败，系统将以降级模式运行: {e}")
            self.connected = False

    def insert(
        self,
        resume_id: str,
        resume_text: str,
        embedding: List[float],
        created_at: int = 0,
        is_screened: bool = False,
    ) -> List[int]:
        """插入一条简历向量记录

        Args:
            resume_id: 简历ID
            resume_text: 简历文本
            embedding: 向量
            created_at: 简历创建时间戳（秒）
            is_screened: 是否已被筛选
        """
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过插入: resume_id={resume_id}")
            return []

        try:
            entities = [
                [resume_id],
                [resume_text],
                [embedding],
                [created_at],
                [is_screened],
            ]
            result = self.collection.insert(entities)
            logger.info(f"成功插入向量到 Milvus: resume_id={resume_id}")
            return result
        except Exception as e:
            logger.error(f"插入向量失败: resume_id={resume_id}, 错误: {e}")
            raise

    def insert_with_chunks(
        self,
        resume_id: str,
        resume_text: str,
        main_embedding: List[float],
        chunks: List[Dict[str, Any]],
        created_at: int = 0,
        is_screened: bool = False,
    ) -> bool:
        """插入简历及其分块向量

        Args:
            resume_id: 简历ID
            resume_text: 完整简历文本
            main_embedding: 主 embedding（第一个块）
            chunks: 所有文本块信息
            created_at: 简历创建时间戳（秒）
            is_screened: 是否已被筛选
        """
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过插入: resume_id={resume_id}")
            return False

        try:
            # 存储主向量
            self.collection.insert([
                [resume_id],
                [resume_text],
                [main_embedding],
                [created_at],
                [is_screened],
            ])

            # 存储每个块的向量（chunks 继承主简历的过滤字段）
            for i, chunk_info in enumerate(chunks):
                chunk_id = f"{resume_id}_chunk_{i}"
                self.collection.insert([
                    [chunk_id],
                    [chunk_info["text"]],
                    [chunk_info["embedding"]],
                    [created_at],
                    [is_screened],
                ])

            logger.info(
                f"成功插入多向量到 Milvus: resume_id={resume_id}, "
                f"块数={len(chunks)}"
            )
            return True
        except Exception as e:
            logger.error(f"插入多向量失败: resume_id={resume_id}, 错误: {e}")
            return False

    def update_screening_status(self, resume_id: str, is_screened: bool) -> None:
        """更新简历在 Milvus 中的 is_screened 状态

        通过查询→删除→重新插入的方式更新，覆盖主记录和所有分块。

        Args:
            resume_id: 简历ID
            is_screened: 新的筛选状态
        """
        if not self.connected:
            return

        try:
            # 查询该简历的所有记录（主记录 + 分块）
            results = self.collection.query(
                expr=f'resume_id like "{resume_id}%"',
                output_fields=[
                    "id", "resume_id", "resume_text",
                    "embedding", "created_at", "is_screened",
                ],
            )

            if not results:
                logger.warning(f"Milvus 中未找到简历记录: {resume_id}")
                return

            # 删除旧记录
            ids = [item["id"] for item in results]
            self.collection.delete(expr=f"id in {ids}")

            # 重新插入（更新 is_screened）
            self.collection.insert([
                [item["resume_id"] for item in results],
                [item["resume_text"] for item in results],
                [item["embedding"] for item in results],
                [item["created_at"] for item in results],
                [is_screened] * len(results),
            ])

            logger.info(
                f"已更新 Milvus 筛选状态: resume_id={resume_id}, "
                f"is_screened={is_screened}, 记录数={len(results)}"
            )
        except Exception as e:
            logger.error(f"更新 Milvus 筛选状态失败: resume_id={resume_id}, 错误: {e}")

    # oversampling 倍数
    OVERSAMPLE_FACTOR = 5
    MIN_SEARCH_LIMIT = 30

    def _build_filter_expr(
        self,
        time_range: Optional[int] = 7,
        only_unscreened: Optional[bool] = False,
    ) -> str:
        """构建 Milvus 过滤表达式

        Args:
            time_range: 时间范围（天），0 表示不限
            only_unscreened: 是否只筛选未评估的

        Returns:
            Milvus expr 字符串，空字符串表示不过滤
        """
        parts: list[str] = []

        if time_range and time_range > 0:
            cutoff_ts = int((datetime.now() - timedelta(days=time_range)).timestamp())
            parts.append(f"created_at >= {cutoff_ts}")

        if only_unscreened:
            # Milvus BOOL 字段在 expr 中使用 true/false
            parts.append("is_screened == false")

        return " && ".join(parts)

    async def search(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        time_range: Optional[int] = 7,
        only_unscreened: Optional[bool] = False,
    ) -> List[Dict[str, Any]]:
        """带业务过滤的向量搜索

        过滤条件通过 Milvus expr 在向量计算阶段生效，
        减少无关节历的向量距离计算。

        Args:
            query_embedding: 查询向量
            top_k: 返回数量
            time_range: 时间范围（天）
            only_unscreened: 是否只筛选未评估的

        Returns:
            搜索结果列表
        """
        if not self.connected:
            logger.warning("Milvus 不可用，返回空搜索结果")
            return []

        try:
            search_params = {
                "metric_type": "L2",
                "params": {"nprobe": 10}
            }

            # 构建 Milvus 过滤表达式
            expr = self._build_filter_expr(time_range, only_unscreened)

            # oversampling：多取一些，保证过滤后仍有足够结果
            search_limit = max(top_k * self.OVERSAMPLE_FACTOR, self.MIN_SEARCH_LIMIT)

            logger.info(
                f"Milvus 搜索: limit={search_limit}, "
                f"expr={expr or '(无过滤)'}"
            )

            # 执行向量搜索（过滤在 Milvus 内部完成）
            results = self.collection.search(
                [query_embedding],
                "embedding",
                search_params,
                limit=search_limit,
                expr=expr if expr else None,
                output_fields=["resume_id", "resume_text"],
            )

            formatted_results = []
            for hits in results:
                for hit in hits:
                    formatted_results.append({
                        "resume_id": hit.entity.get("resume_id"),
                        "resume_text": hit.entity.get("resume_text"),
                        "distance": hit.distance,
                    })

            # 对 is_screened 做 PostgreSQL 兜底校验，
            # 防止 Milvus 数据与 PG 不一致
            if only_unscreened and formatted_results:
                formatted_results = await self._verify_unscreened(formatted_results)

            # 截取 top_k
            formatted_results = formatted_results[:top_k]

            logger.info(f"Milvus 搜索返回: {len(formatted_results)} 条结果")
            return formatted_results

        except Exception as e:
            logger.error(f"向量搜索失败: {e}")
            return []

    async def _verify_unscreened(
        self, search_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """PostgreSQL 兜底校验：确保返回的简历确实未被筛选

        当 Milvus 中 is_screened 与 PostgreSQL 不同步时，以此为准。

        Args:
            search_results: Milvus 搜索结果

        Returns:
            过滤后的结果
        """
        # 提取真实简历 ID（排除 chunk 记录）
        real_ids = set()
        for r in search_results:
            rid = r["resume_id"]
            # chunk ID 格式: resume_id_chunk_N
            if "_chunk_" not in rid:
                real_ids.add(rid)

        if not real_ids:
            return search_results

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Resume.resume_id).where(
                    Resume.resume_id.in_(real_ids),
                    Resume.is_screened == False,
                )
            )
            valid_ids = {row[0] for row in result.all()}

        if len(valid_ids) == len(real_ids):
            return search_results

        # 过滤掉已被筛选的简历（包括其 chunk）
        filtered = [
            r for r in search_results
            if "_chunk_" in r["resume_id"]
            or r["resume_id"] in valid_ids
        ]
        skipped = len(search_results) - len(filtered)
        if skipped > 0:
            logger.info(
                f"PG 兜底过滤: {skipped} 条记录因 is_screened 状态不一致被移除"
            )
        return filtered

    def delete_by_resume_id(self, resume_id: str) -> bool:
        """Delete a resume by resume_id"""
        if not self.connected:
            logger.warning(f"Milvus 不可用，跳过删除: resume_id={resume_id}")
            return True

        try:
            # 使用 like 匹配主记录和所有 chunk
            results = self.collection.query(
                expr=f'resume_id like "{resume_id}%"',
                output_fields=["id"]
            )

            if results:
                entity_ids = [item["id"] for item in results]
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
