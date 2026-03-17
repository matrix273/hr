"""简历筛选路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import json
import asyncio
from ..models.schemas import ScreenRequest, ScreenResponse, BatchDeleteRequest
from ..models.user import Resume, Job, ScreeningResult, User
from ..utils.logger import logger
from ..auth import get_current_active_user, Permission
from ..database import get_db
from ..core.system import ResumeScreeningSystem
from ..auth.rbac import check_permission

router = APIRouter(prefix="/api/screening", tags=["Screening"])


@router.post("/screen")
async def screen_resumes(
    request: ScreenRequest,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """根据职位描述筛选简历 - 流式返回

    Args:
        request: 筛选请求（包含职位描述和 top_k）
        current_user: 当前用户
        db: 数据库会话

    Returns:
        SSE 流式筛选结果
    """
    # 检查权限
    if not check_permission(Permission.SCREENING_EXECUTE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SCREENING_EXECUTE.value}"
        )

    async def event_stream():
        try:
            # 获取用户ID
            user_result = await db.execute(
                select(User.id).where(User.username == current_user['username'])
            )
            user_id = user_result.scalar_one_or_none()

            if not user_id:
                yield f"data: {json.dumps({'error': '用户不存在'})}\n\n"
                return

            logger.info(f"开始简历筛选, 用户: {current_user['username']}, top_k: {request.top_k}, model: {request.model}")

            # 创建筛选系统
            screening_system = ResumeScreeningSystem()

            # 检查向量数据库是否可用
            if not screening_system.vector_db.is_connected():
                logger.warning("向量数据库不可用，无法进行简历筛选")
                yield f"data: {json.dumps({'type': 'error', 'message': '向量数据库不可用，请检查 Milvus 服务'})}\n\n"
                return

            # 获取搜索和 rerank 结果
            query_embedding = screening_system.embedding.embed_single(request.job_description)
            search_results = screening_system.vector_db.search(query_embedding, request.top_k)
            
            if not search_results:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return
                
            resume_texts = [result["resume_text"] for result in search_results]
            reranked = screening_system.reranker.rerank(request.job_description, resume_texts, request.top_k)

            if not reranked:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return

            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'total': len(reranked)})}\n\n"

            # 逐个评估简历并流式返回
            for idx, item in enumerate(reranked):
                resume_idx = item["index"]
                resume_info = search_results[resume_idx]

                # 获取简历详细信息
                resume_id = resume_info["resume_id"]
                query_result = await db.execute(
                    select(Resume).where(Resume.resume_id == resume_id)
                )
                resume = query_result.scalar_one_or_none()

                if not resume:
                    continue

                # 发送进度更新事件
                yield f"data: {json.dumps({'type': 'progress', 'index': idx + 1, 'total': len(reranked), 'filename': resume.original_filename})}\n\n"

                # 记录数据大小
                resume_text = resume_info["resume_text"]
                prompt_size = len(resume_text) + len(request.job_description)
                logger.info(f"评估第 {idx+1}/{len(reranked)} 个简历: {resume_info['resume_id']}, "
                           f"简历文本: {len(resume_text):,} 字符, "
                           f"总prompt: {prompt_size:,} 字符, "
                           f"约 {prompt_size/1024/1024:.2f} MB")

                # LLM 评估
                llm_result = screening_system.llm.evaluate_resume(
                    resume_info["resume_text"],
                    request.job_description,
                    request.model
                )
                logger.info(f"简历 {resume_info['resume_id']} LLM 评估完成")

                # 保存筛选结果到数据库（使用特殊的 job_id 标记为自定义筛选）
                custom_job_id = f"custom_{user_id}_{int(asyncio.get_event_loop().time())}"
                screening_result = ScreeningResult(
                    job_id=custom_job_id,
                    resume_id=resume_id,
                    model=request.model or "custom",
                    screening_type="custom",
                    rerank_score=item["score"],
                    rank=idx + 1,
                    llm_evaluation=llm_result["choices"][0]["message"]["content"],
                    user_id=user_id
                )
                db.add(screening_result)
                await db.commit()

                # 构建结果
                result = {
                    "type": "result",
                    "index": idx + 1,
                    "total": len(reranked),
                    "resume_id": resume_info["resume_id"],
                    "filename": resume.original_filename,
                    "file_size": resume.file_size,
                    "created_at": int(resume.created_at.timestamp()) if resume.created_at else None,
                    "rerank_score": item["score"],
                    "llm_evaluation": llm_result["choices"][0]["message"]["content"]
                }

                # 流式返回结果
                yield f"data: {json.dumps(result)}\n\n"

            # 完成
            yield f"data: {json.dumps({'type': 'done', 'count': len(reranked)})}\n\n"
            logger.info(f"自定义描述筛选完成, 找到 {len(reranked)} 个匹配结果, 用户: {current_user['username']}")

        except Exception as e:
            logger.error(f"自定义描述筛选简历失败: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.get("/history/{job_id}")
async def get_screening_history(
    job_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取某个岗位的筛选历史记录

    Args:
        job_id: 岗位 ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        筛选历史记录
    """
    from ..services.reranker import QwenReranker
    
    try:
        # 获取用户ID
        user_result = await db.execute(
            select(User.id).where(User.username == current_user['username'])
        )
        user_id = user_result.scalar_one_or_none()

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )

        # 查询该岗位的筛选历史
        result = await db.execute(
            select(ScreeningResult)
            .where(ScreeningResult.job_id == job_id, ScreeningResult.user_id == user_id)
            .order_by(ScreeningResult.created_at.desc(), ScreeningResult.rank.asc())
        )
        screening_results = result.scalars().all()

        if not screening_results:
            return {"success": True, "results": []}

        # 获取关联的简历信息
        resume_ids = [r.resume_id for r in screening_results]
        resume_result = await db.execute(
            select(Resume).where(Resume.resume_id.in_(resume_ids))
        )
        resumes = resume_result.scalars().all()
        resume_dict = {r.resume_id: r for r in resumes}

        # 构建响应数据
        results = []
        for screening in screening_results:
            resume = resume_dict.get(screening.resume_id)
            raw_score = screening.rerank_score
            # 对历史数据也进行归一化处理（兼容旧数据）
            # 如果分数不在 0-1 范围内，说明是旧数据，需要归一化
            if raw_score < 0 or raw_score > 1:
                normalized_score = QwenReranker.sigmoid_normalize(raw_score)
            else:
                normalized_score = raw_score
            
            results.append({
                "result_id": screening.result_id,
                "resume_id": screening.resume_id,
                "job_id": screening.job_id,
                "filename": resume.original_filename if resume else "未知文件",
                "file_size": resume.file_size if resume else None,
                "created_at": int(resume.created_at.timestamp()) if resume and resume.created_at else None,
                "model": screening.model,
                "screening_type": screening.screening_type,
                "rerank_score": normalized_score,
                "raw_score": raw_score,  # 保留原始分数供调试
                "rank": screening.rank,
                "llm_evaluation": screening.llm_evaluation,
                "screening_created_at": int(screening.created_at.timestamp()) if screening.created_at else None
            })

        logger.info(f"获取岗位 {job_id} 的筛选历史, 共 {len(results)} 条记录")
        return {"success": True, "results": results}

    except Exception as e:
        logger.error(f"获取筛选历史失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取筛选历史失败: {str(e)}"
        )


@router.get("/custom_history")
async def get_custom_screening_history(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取自定义描述筛选的历史记录

    Args:
        current_user: 当前用户
        db: 数据库会话

    Returns:
        自定义筛选历史记录
    """
    from ..services.reranker import QwenReranker
    
    try:
        # 获取用户ID
        user_result = await db.execute(
            select(User.id).where(User.username == current_user['username'])
        )
        user_id = user_result.scalar_one_or_none()

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )

        # 查询自定义筛选的历史记录（job_id 以 'custom_' 开头）
        result = await db.execute(
            select(ScreeningResult)
            .where(ScreeningResult.job_id.like('custom_%'), ScreeningResult.user_id == user_id)
            .order_by(ScreeningResult.created_at.desc(), ScreeningResult.rank.asc())
        )
        screening_results = result.scalars().all()

        if not screening_results:
            return {"success": True, "results": []}

        # 获取关联的简历信息
        resume_ids = [r.resume_id for r in screening_results]
        resume_result = await db.execute(
            select(Resume).where(Resume.resume_id.in_(resume_ids))
        )
        resumes = resume_result.scalars().all()
        resume_dict = {r.resume_id: r for r in resumes}

        # 构建响应数据
        results = []
        for screening in screening_results:
            resume = resume_dict.get(screening.resume_id)
            raw_score = screening.rerank_score
            # 对历史数据也进行归一化处理（兼容旧数据）
            # 如果分数不在 0-1 范围内，说明是旧数据，需要归一化
            if raw_score < 0 or raw_score > 1:
                normalized_score = QwenReranker.sigmoid_normalize(raw_score)
            else:
                normalized_score = raw_score
            
            results.append({
                "result_id": screening.result_id,
                "resume_id": screening.resume_id,
                "job_id": screening.job_id,
                "filename": resume.original_filename if resume else "未知文件",
                "file_size": resume.file_size if resume else None,
                "created_at": int(resume.created_at.timestamp()) if resume and resume.created_at else None,
                "model": screening.model,
                "screening_type": screening.screening_type,
                "rerank_score": normalized_score,
                "raw_score": raw_score,  # 保留原始分数供调试
                "rank": screening.rank,
                "llm_evaluation": screening.llm_evaluation,
                "screening_created_at": int(screening.created_at.timestamp()) if screening.created_at else None
            })

        logger.info(f"获取自定义筛选历史, 共 {len(results)} 条记录, 用户: {current_user['username']}")
        return {"success": True, "results": results}

    except Exception as e:
        logger.error(f"获取自定义筛选历史失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取自定义筛选历史失败: {str(e)}"
        )


@router.post("/screen_by_job/{job_id}")
async def screen_resumes_by_job(
    job_id: str,
    top_k: Optional[int] = 5,
    model: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """根据岗位 ID 筛选简历 - 流式返回

    Args:
        job_id: 岗位 ID
        top_k: 返回前 k 个结果
        current_user: 当前用户
        db: 数据库会话

    Returns:
        SSE 流式筛选结果
    """
    # 检查权限
    if not check_permission(Permission.SCREENING_EXECUTE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SCREENING_EXECUTE.value}"
        )

    async def event_stream():
        try:
            # 获取岗位信息
            job_result = await db.execute(
                select(Job).where(Job.job_id == job_id)
            )
            job = job_result.scalar_one_or_none()

            if not job:
                yield f"data: {json.dumps({'error': '岗位不存在'})}\n\n"
                return

            # 获取用户ID
            user_result = await db.execute(
                select(User.id).where(User.username == current_user['username'])
            )
            user_id = user_result.scalar_one_or_none()

            if not user_id:
                yield f"data: {json.dumps({'error': '用户不存在'})}\n\n"
                return

            logger.info(f"开始根据岗位筛选简历, 岗位: {job.title}, 用户: {current_user['username']}, top_k: {top_k}, model: {model}")

            # 构建职位描述
            job_description = f"""岗位名称: {job.title}

岗位描述:
{job.description}

岗位要求:
{job.requirements or '无'}

薪资范围: {job.salary_range or '面议'}
工作地点: {job.location or '不限'}
"""

            # 执行筛选 - 流式返回
            screening_system = ResumeScreeningSystem()

            # 检查向量数据库是否可用
            if not screening_system.vector_db.is_connected():
                logger.warning("向量数据库不可用，无法进行简历筛选")
                yield f"data: {json.dumps({'type': 'error', 'message': '向量数据库不可用，请检查 Milvus 服务'})}\n\n"
                return

            # 获取搜索和 rerank 结果
            query_embedding = screening_system.embedding.embed_single(job_description)
            search_results = screening_system.vector_db.search(query_embedding, top_k)
            
            if not search_results:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return
                
            resume_texts = [result["resume_text"] for result in search_results]
            reranked = screening_system.reranker.rerank(job_description, resume_texts, top_k)

            if not reranked:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return

            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'total': len(reranked)})}\n\n"

            # 逐个评估简历并流式返回
            for idx, item in enumerate(reranked):
                resume_idx = item["index"]
                resume_info = search_results[resume_idx]

                # 获取简历详细信息
                resume_id = resume_info["resume_id"]
                query_result = await db.execute(
                    select(Resume).where(Resume.resume_id == resume_id)
                )
                resume = query_result.scalar_one_or_none()

                if not resume:
                    continue

                # 发送进度更新事件
                yield f"data: {json.dumps({'type': 'progress', 'index': idx + 1, 'total': len(reranked), 'filename': resume.original_filename})}\n\n"

                # 记录数据大小
                resume_text = resume_info["resume_text"]
                prompt_size = len(resume_text) + len(job_description)
                logger.info(f"评估第 {idx+1}/{len(reranked)} 个简历: {resume_info['resume_id']}, "
                           f"简历文本: {len(resume_text):,} 字符, "
                           f"总prompt: {prompt_size:,} 字符, "
                           f"约 {prompt_size/1024/1024:.2f} MB")

                # LLM 评估
                llm_result = screening_system.llm.evaluate_resume(
                    resume_info["resume_text"],
                    job_description,
                    model
                )
                logger.info(f"简历 {resume_info['resume_id']} LLM 评估完成")

                # 保存筛选结果到数据库
                screening_result = ScreeningResult(
                    job_id=job_id,
                    resume_id=resume_id,
                    model=model or "qwen-plus",
                    screening_type="job",
                    rerank_score=item["score"],
                    rank=idx + 1,
                    llm_evaluation=llm_result["choices"][0]["message"]["content"],
                    user_id=user_id
                )
                db.add(screening_result)
                await db.commit()

                # 构建结果
                result = {
                    "type": "result",
                    "index": idx + 1,
                    "total": len(reranked),
                    "resume_id": resume_info["resume_id"],
                    "filename": resume.original_filename,
                    "file_size": resume.file_size,
                    "created_at": int(resume.created_at.timestamp()) if resume.created_at else None,
                    "rerank_score": item["score"],
                    "llm_evaluation": llm_result["choices"][0]["message"]["content"]
                }

                # 流式返回结果
                yield f"data: {json.dumps(result)}\n\n"

            # 完成
            yield f"data: {json.dumps({'type': 'done', 'count': len(reranked)})}\n\n"
            logger.info(f"根据岗位筛选完成, 岗位: {job.title}, 找到 {len(reranked)} 个匹配结果")

        except Exception as e:
            logger.error(f"根据岗位筛选简历失败: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


@router.post("/batch-delete")
async def batch_delete_history(
    request: BatchDeleteRequest,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """批量删除筛选历史记录

    Args:
        request: 批量删除请求，包含历史记录 ID 列表
        current_user: 当前用户
        db: 数据库会话

    Returns:
        删除结果
    """
    # 检查权限
    if not check_permission(Permission.SCREENING_DELETE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SCREENING_DELETE.value}"
        )

    if not request.result_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择要删除的历史记录"
        )

    try:
        # 获取用户ID
        user_result = await db.execute(
            select(User.id).where(User.username == current_user['username'])
        )
        user_id = user_result.scalar_one_or_none()

        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="用户不存在"
            )

        deleted_count = 0
        failed_count = 0
        failed_ids = []

        # 批量删除历史记录
        for result_id in request.result_ids:
            try:
                # 删除历史记录
                delete_result = await db.execute(
                    select(ScreeningResult)
                    .where(ScreeningResult.result_id == result_id, ScreeningResult.user_id == user_id)
                )
                screening_result = delete_result.scalar_one_or_none()
                
                if screening_result:
                    await db.delete(screening_result)
                    deleted_count += 1
                else:
                    failed_count += 1
                    failed_ids.append(result_id)
                    
            except Exception as e:
                logger.error(f"删除历史记录失败 (ID: {result_id}): {e}")
                failed_count += 1
                failed_ids.append(result_id)

        await db.commit()

        logger.info(f"批量删除历史记录完成, 成功: {deleted_count}, 失败: {failed_count}, 用户: {current_user['username']}")

        if failed_count > 0:
            return {
                "success": True,
                "message": f"批量删除完成, 成功: {deleted_count} 条, 失败: {failed_count} 条",
                "failed_ids": failed_ids
            }
        else:
            return {
                "success": True,
                "message": f"成功删除 {deleted_count} 条历史记录"
            }

    except Exception as e:
        logger.error(f"批量删除历史记录失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除失败: {str(e)}"
        )
