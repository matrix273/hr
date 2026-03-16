"""Celery 异步任务"""

import sys
import asyncio
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from celery import Celery
from app.config import CELERY_BROKER_URL, CELERY_RESULT_BACKEND

# 创建 Celery 实例
celery_app = Celery(
    "hr_app",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
)
from app.core.system import ResumeScreeningSystem
from app.utils.logger import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import Resume
from app.database import AsyncSessionLocal

@celery_app.task(name="process_resume_embedding", bind=True, max_retries=3)
def process_resume_embedding(self, resume_id: str, resume_text: str) -> dict:
    """异步处理简历 embedding

    Args:
        resume_id: 简历 ID
        resume_text: 简历文本内容

    Returns:
        处理结果
    """

    async def update_status(status: str, error: str = None):
        """更新 embedding 状态"""
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(
                    select(Resume).where(Resume.resume_id == resume_id)
                )
                resume = result.scalar_one_or_none()
                if resume:
                    resume.embedding_status = status
                    resume.embedding_error = error
                    await db.commit()
                    logger.info(f"更新简历状态: {resume_id} -> {status}")
            except Exception as e:
                logger.error(f"更新状态失败: {resume_id}, 错误: {e}")

    async def process():
        try:
            logger.info(f"开始处理简历 embedding: {resume_id}")

            # 更新状态为处理中
            await update_status("processing")

            # 创建筛选系统实例
            screening_system = ResumeScreeningSystem()

            # 添加到向量数据库
            success = screening_system.add_resume(resume_id, resume_text)

            if success:
                logger.info(f"简历 embedding 处理成功: {resume_id}")
                await update_status("completed")
                return {
                    "success": True,
                    "resume_id": resume_id,
                    "message": "简历 embedding 处理成功"
                }
            else:
                logger.error(f"简历 embedding 处理失败: {resume_id}")
                await update_status("failed", "embedding 处理失败")
                return {
                    "success": False,
                    "resume_id": resume_id,
                    "message": "简历 embedding 处理失败"
                }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"处理简历 embedding 时出错: {resume_id}, 错误: {error_msg}")
            await update_status("failed", error_msg)
            return {
                "success": False,
                "resume_id": resume_id,
                "message": f"处理失败: {error_msg}"
            }

    # 创建新的事件循环来运行异步任务
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(process())
    finally:
        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()

    return result
