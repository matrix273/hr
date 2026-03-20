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

# Celery 配置
celery_app.conf.update(
    task_track_started=False,
    task_ignore_result=False,
    result_serializer='json',
    task_serializer='json',
    accept_content=['json'],
    worker_hijack_root_logger=False,
)

from app.core.system import ResumeScreeningSystem
from app.services.llm import LLMClient
from app.utils.celery_logger import get_celery_logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.models.user import Resume, ScreeningResult
from app.config import POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

# 获取 Celery 专用的日志记录器
logger = get_celery_logger("celery.tasks")


def get_async_session_factory():
    """为每个任务创建独立的数据库会话工厂"""
    DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    engine = create_async_engine(
        DATABASE_URL,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False
    )

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
        async_session_factory = get_async_session_factory()
        async with async_session_factory() as db:
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

@celery_app.task(name="evaluate_resume_with_llm", bind=True, max_retries=3, default_retry_delay=10)
def evaluate_resume_with_llm(self, resume_id: str, resume_text: str, job_description: str, model: str = None) -> dict:
    """异步使用 LLM 评估简历

    Args:
        resume_id: 简历 ID
        resume_text: 简历文本内容
        job_description: 职位描述
        model: LLM 模型名称

    Returns:
        评估结果
    """

    async def process():
        try:
            logger.info(f"开始 LLM 评估简历: {resume_id}")
            
            # 初始化 LLM 服务
            llm_client = LLMClient()
            
            # 调用 LLM 评估（同步调用，在异步环境中需要特殊处理）
            # 使用线程池执行同步的LLM调用
            import asyncio
            loop = asyncio.get_running_loop()
            llm_result = await loop.run_in_executor(
                None, 
                lambda: llm_client.evaluate_resume(resume_text, job_description, model)
            )
            
            # 解析 LLM 响应（也是同步调用）
            evaluation_result = await loop.run_in_executor(
                None,
                lambda: llm_client.parse_evaluation_result(llm_result)
            )
            
            logger.info(f"LLM 评估完成: {resume_id}, 匹配度: {evaluation_result.get('matching_score', 0)}%")
            
            return {
                "success": True,
                "resume_id": resume_id,
                "evaluation_result": evaluation_result,
                "message": "LLM 评估完成"
            }

        except Exception as e:
            error_msg = str(e)
            logger.error(f"LLM 评估失败: {resume_id}, 错误: {error_msg}")
            
            return {
                "success": False,
                "resume_id": resume_id,
                "message": f"LLM 评估失败: {error_msg}"
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
