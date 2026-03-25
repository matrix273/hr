"""简历筛选路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import json
import asyncio
from datetime import datetime
from io import BytesIO
from urllib.parse import quote

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT
from ..models.schemas import ScreenRequest, BatchDeleteRequest
from ..models.user import Resume, Job, ScreeningResult, User
from ..utils.logger import logger
from ..auth import get_current_active_user, Permission
from ..database import get_db
from ..core.system import ResumeScreeningSystem
from ..auth.rbac import check_permission
from ..tasks import evaluate_resume_with_llm

router = APIRouter(prefix="/api/screening", tags=["Screening"])


@router.post("/screen")
async def screen_resumes(
    request: ScreenRequest,
    time_range: Optional[int] = 7,
    only_unscreened: Optional[bool] = False,
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

            # 获取搜索和 rerank 结果（支持时间和未评估筛选）
            query_embedding = screening_system.embedding.embed_single(request.job_description)
            search_results = await screening_system.vector_db.search(
                query_embedding, 
                request.top_k,
                time_range=request.time_range,
                only_unscreened=request.only_unscreened,
                filter_job_id=request.filter_job_id
            )
            
            if not search_results:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return
                
            resume_texts = [result["resume_text"] for result in search_results]
            reranked = screening_system.reranker.rerank(request.job_description, resume_texts, request.top_k)
            
            # 调试日志：检查rerank结果中的分数
            logger.info(f"Rerank 结果数量: {len(reranked)}")
            for i, item in enumerate(reranked):
                logger.info(f"第 {i+1} 个结果 - score: {item.get('score')}, raw_score: {item.get('raw_score')}")

            if not reranked:
                logger.warning("未找到匹配的简历")
                yield f"data: {json.dumps({'type': 'done', 'count': 0})}\n\n"
                return

            # 发送开始事件
            yield f"data: {json.dumps({'type': 'start', 'total': len(reranked)})}\n\n"

            # 逐个评估简历并流式返回
            successful_results = []  # 记录成功的评估结果
            
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

                # 异步调用 LLM 评估任务
                llm_task = evaluate_resume_with_llm.delay(
                    resume_info["resume_id"],
                    resume_info["resume_text"],
                    request.job_description,
                    request.model
                )
                
                # 等待任务完成（设置超时时间）
                try:
                    llm_result = llm_task.get(timeout=120)  # 120秒超时，给Qwen足够时间
                    
                    if llm_result["success"]:
                        evaluation_result = llm_result["evaluation_result"]
                        llm_content = evaluation_result.get("overall_evaluation", "评估完成")
                        matching_score = evaluation_result.get("matching_score", 0)
                        
                        logger.info(f"简历 {resume_info['resume_id']} LLM 评估完成, 匹配度: {matching_score}%")
                        
                        # 只有LLM评估成功的简历才保存结果并返回
                        custom_job_id = f"custom_{user_id}_{int(asyncio.get_event_loop().time())}"
                        screening_result = ScreeningResult(
                            job_id=custom_job_id,
                            resume_id=resume_id,
                            model=request.model or "custom",
                            screening_type="custom",
                            rerank_score=item["score"],
                            raw_score=item.get("raw_score", item["score"]),  # 保存原始分数
                            rank=len(successful_results) + 1,  # 重新排序
                            llm_evaluation=llm_content,
                            matching_score=matching_score,
                            user_id=user_id
                        )
                        db.add(screening_result)
                        
                        # 更新简历的筛选状态
                        resume.is_screened = True
                        
                        await db.commit()

                        # 构建结果
                        result = {
                            "type": "result",
                            "index": len(successful_results) + 1,
                            "total": len(reranked),  # 仍然显示总数量
                            "resume_id": resume_info["resume_id"],
                            "filename": resume.original_filename,
                            "file_size": resume.file_size,
                            "created_at": int(resume.created_at.timestamp()) if resume.created_at else None,
                            "rerank_score": item["score"],
                            "llm_evaluation": llm_content,
                            "matching_score": matching_score
                        }
                        
                        successful_results.append(result)
                        
                        # 流式返回成功的结果
                        yield f"data: {json.dumps(result)}\n\n"
                        
                    else:
                        llm_content = f"LLM评估失败: {llm_result['message']}"
                        matching_score = 0
                        logger.warning(f"简历 {resume_info['resume_id']} LLM 评估失败: {llm_result['message']}")
                        
                        # LLM评估失败，不保存结果，也不返回给前端
                        continue
                        
                except Exception as e:
                    llm_content = f"LLM评估超时或失败: {str(e)}"
                    matching_score = 0
                    logger.error(f"简历 {resume_info['resume_id']} LLM 评估异常: {e}")
                    
                    # LLM评估异常，不保存结果，也不返回给前端
                    continue

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
            # 历史记录中已经保存了原始分数和归一化分数
            # 直接从数据库读取，避免重复计算
            results.append({
                "result_id": screening.result_id,
                "resume_id": screening.resume_id,
                "job_id": screening.job_id,
                "filename": resume.original_filename if resume else "未知文件",
                "file_size": resume.file_size if resume else None,
                "created_at": int(resume.created_at.timestamp()) if resume and resume.created_at else None,
                "model": screening.model,
                "screening_type": screening.screening_type,
                "rerank_score": screening.rerank_score,  # 已经是归一化分数
                "raw_score": screening.raw_score if hasattr(screening, 'raw_score') else screening.rerank_score,  # 如果存在原始分数则使用，否则使用rerank_score
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
            # 历史记录中已经保存了原始分数和归一化分数
            # 直接从数据库读取，避免重复计算
            results.append({
                "result_id": screening.result_id,
                "resume_id": screening.resume_id,
                "job_id": screening.job_id,
                "filename": resume.original_filename if resume else "未知文件",
                "file_size": resume.file_size if resume else None,
                "created_at": int(resume.created_at.timestamp()) if resume and resume.created_at else None,
                "model": screening.model,
                "screening_type": screening.screening_type,
                "rerank_score": screening.rerank_score,  # 已经是归一化分数
                "raw_score": screening.raw_score if hasattr(screening, 'raw_score') else screening.rerank_score,  # 如果存在原始分数则使用，否则使用rerank_score
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
            search_results = await screening_system.vector_db.search(
                query_embedding, 
                top_k,
                time_range=7,  # 默认7天
                only_unscreened=False,  # 默认不筛选未评估的
                filter_job_id=None  # 岗位筛选模式下不需要额外过滤
            )
            
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

                # 异步调用 LLM 评估任务
                llm_task = evaluate_resume_with_llm.delay(
                    resume_info["resume_id"],
                    resume_info["resume_text"],
                    job_description,
                    model
                )
                
                # 等待任务完成（设置超时时间）
                try:
                    llm_result = llm_task.get(timeout=120)  # 120秒超时，给Qwen足够时间
                    
                    if llm_result["success"]:
                        evaluation_result = llm_result["evaluation_result"]
                        llm_content = evaluation_result.get("overall_evaluation", "评估完成")
                        matching_score = evaluation_result.get("matching_score", 0)
                        
                        logger.info(f"简历 {resume_info['resume_id']} LLM 评估完成, 匹配度: {matching_score}%")
                    else:
                        llm_content = f"LLM评估失败: {llm_result['message']}"
                        matching_score = 0
                        logger.warning(f"简历 {resume_info['resume_id']} LLM 评估失败: {llm_result['message']}")
                        
                except Exception as e:
                    llm_content = f"LLM评估超时或失败: {str(e)}"
                    matching_score = 0
                    logger.error(f"简历 {resume_info['resume_id']} LLM 评估异常: {e}")

                # 保存筛选结果到数据库
                screening_result = ScreeningResult(
                    job_id=job_id,
                    resume_id=resume_id,
                    model=model or "qwen-plus",
                    screening_type="job",
                    rerank_score=item["score"],
                    raw_score=item.get("raw_score", item["score"]),  # 保存原始分数
                    rank=idx + 1,
                    llm_evaluation=llm_content,
                    matching_score=matching_score,
                    user_id=user_id
                )
                db.add(screening_result)
                
                # 更新简历的筛选状态
                resume.is_screened = True
                
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
                    "llm_evaluation": llm_content,
                    "matching_score": matching_score
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


def _register_chinese_font():
    """注册中文字体，返回字体名称和粗体字体名称"""
    import os
    
    # 系统中文字体候选列表 (常规和粗体)
    font_pairs = [
        # macOS
        ("/System/Library/Fonts/STHeiti Light.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"),
        ("/System/Library/Fonts/PingFang.ttc", None),
        ("/System/Library/Fonts/Supplemental/Songti.ttc", None),
        ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", None),
        # Windows
        ("C:/Windows/Fonts/simsun.ttc", "C:/Windows/Fonts/simhei.ttf"),
        ("C:/Windows/Fonts/msyh.ttc", None),
        # Linux
        ("/usr/share/fonts/truetype/wqy/wqy-microhei.ttc", "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc"),
        ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", None),
    ]
    
    # 查找可用字体
    font_path = None
    bold_font_path = None
    for regular, bold in font_pairs:
        if os.path.exists(regular):
            font_path = regular
            bold_font_path = bold if bold and os.path.exists(bold) else None
            break
    
    if font_path is None:
        raise RuntimeError("未找到合适的中文字体，请安装 CJK 字体")
    
    # 注册常规字体
    font_name = "CN"
    try:
        if font_path.endswith(".ttc"):
            pdfmetrics.registerFont(TTFont(font_name, font_path, subfontIndex=0))
        else:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
    except Exception as e:
        logger.error(f"注册常规字体失败: {e}")
        raise
    
    # 注册粗体字体（如果可用）
    bold_font_name = "CN_Bold"
    if bold_font_path:
        try:
            if bold_font_path.endswith(".ttc"):
                pdfmetrics.registerFont(TTFont(bold_font_name, bold_font_path, subfontIndex=0))
            else:
                pdfmetrics.registerFont(TTFont(bold_font_name, bold_font_path))
            logger.info(f"成功注册中文字体: {font_path}, 粗体: {bold_font_path}")
        except Exception as e:
            logger.warning(f"注册粗体字体失败，使用常规字体代替: {e}")
            bold_font_name = font_name
    else:
        # 如果没有单独的粗体字体，使用常规字体
        bold_font_name = font_name
        logger.info(f"成功注册中文字体: {font_path} (无单独粗体，使用常规字体)")
    
    return font_name, bold_font_name


# ── 颜色定义 ───────────────────────────────────────────────────────────────
DARK_BLUE = HexColor("#1A3A5C")
MID_BLUE = HexColor("#2E6DA4")
LIGHT_BLUE = HexColor("#E8F1F8")
GRAY_TEXT = HexColor("#555555")
LINE_COLOR = HexColor("#2E6DA4")


def _create_styles(chinese_font: str, bold_font: str = None) -> dict:
    """创建 PDF 样式字典"""
    if bold_font is None:
        bold_font = chinese_font
    
    return {
        "name": ParagraphStyle("name", fontName=chinese_font, fontSize=26, leading=32, 
                               textColor=DARK_BLUE, spaceAfter=2),
        "title": ParagraphStyle("title", fontName=chinese_font, fontSize=13, leading=18, 
                                textColor=MID_BLUE, spaceAfter=4),
        "contact": ParagraphStyle("contact", fontName=chinese_font, fontSize=9, leading=14, 
                                  textColor=GRAY_TEXT),
        "h1": ParagraphStyle("h1", fontName=chinese_font, fontSize=18, leading=24, 
                             textColor=DARK_BLUE, spaceAfter=6, spaceBefore=12),
        "section": ParagraphStyle("section", fontName=chinese_font, fontSize=12, leading=16, 
                                  textColor="white", backColor=MID_BLUE, leftIndent=6, 
                                  spaceAfter=2, spaceBefore=8),
        "job": ParagraphStyle("job", fontName=chinese_font, fontSize=10, leading=15, 
                             textColor=DARK_BLUE),
        "body": ParagraphStyle("body", fontName=chinese_font, fontSize=9.5, leading=15, 
                              textColor=GRAY_TEXT, leftIndent=10),
        "bullet": ParagraphStyle("bullet", fontName=chinese_font, fontSize=9.5, leading=15, 
                                textColor=GRAY_TEXT, leftIndent=18, firstLineIndent=-8),
        "normal": ParagraphStyle("normal", fontName=chinese_font, fontSize=10, leading=16, 
                                 textColor=GRAY_TEXT),
        "bold": ParagraphStyle("bold", fontName=bold_font, fontSize=9.5, leading=15, 
                              textColor=GRAY_TEXT),
    }


def _section_header(text: str, styles: dict) -> list:
    """创建章节标题"""
    return [
        Paragraph(f"  {text}", styles["section"]),
        Spacer(1, 3),
    ]


def _bullet(text: str, styles: dict) -> Paragraph:
    """创建项目符号"""
    return Paragraph(f"• {text}", styles["bullet"])


def _parse_markdown_to_story(markdown_text: str, styles: dict, bold_font: str = "CN_Bold") -> list:
    """将 Markdown 文本转换为 PDF 元素列表
    
    Args:
        markdown_text: Markdown 格式的文本
        styles: 样式字典
        bold_font: 粗体字体名称
        
    Returns:
        PDF 元素列表
    """
    import re
    elements = []
    lines = markdown_text.strip().split('\n')
    in_list = False
    in_table = False
    table_data = []
    
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()  # 保留缩进，只去掉右边空白
        
        # 跳过空行
        if not line.strip():
            if in_list:
                in_list = False
            if in_table and table_data:
                # 渲染表格
                elements.extend(_render_table(table_data, styles))
                table_data = []
                in_table = False
            i += 1
            continue
        
        # 一级标题 (# 标题)
        if line.startswith('# ') and not line.startswith('## '):
            title_text = line[2:].strip()
            title_text = _process_inline_formatting(title_text, bold_font)
            elements.append(Paragraph(title_text, styles["h1"]))
            elements.append(Spacer(1, 4))
        
        # 二级标题 (## 标题)
        elif line.startswith('## '):
            title_text = line[3:].strip()
            title_text = _process_inline_formatting(title_text, bold_font)
            elements.extend(_section_header(title_text, styles))
        
        # 三级标题 (### **标题** 或 ### 标题)
        elif line.startswith('### '):
            title_text = line[4:].strip()
            # 处理标题中的粗体标记
            title_text = _process_inline_formatting(title_text, bold_font)
            elements.append(Paragraph(title_text, styles["job"]))
            elements.append(Spacer(1, 4))
        
        # 列表项处理 (- 或 * 开头)
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            item_text = line.strip()[2:].strip()
            # 处理列表中的粗体
            item_text = _process_inline_formatting(item_text, bold_font)
            elements.append(_bullet(item_text, styles))
            in_list = True
        
        # 表格处理 (| 开头)
        elif line.startswith('|'):
            in_table = True
            # 解析表格行
            cells = [cell.strip() for cell in line.split('|')[1:-1]]
            # 跳过表头分隔行 (|---|---| 或 |:---:|---:|----: 等)
            # 检查是否所有单元格都是分隔符格式 (:---, ---:, :---:, -)
            is_separator = all(
                re.match(r'^[:\-]*[:\-]$', cell.strip()) or cell.strip() in ('', '-')
                for cell in cells
            )
            if not is_separator:
                processed_cells = [_process_inline_formatting(cell, bold_font) for cell in cells]
                row = [Paragraph(cell, styles["body"]) for cell in processed_cells]
                table_data.append(row)
        
        # 水平分隔线
        elif line.strip().startswith('---') or line.strip().startswith('***'):
            elements.append(Spacer(1, 6))
        
        # 普通段落
        else:
            # 如果之前有表格，先渲染
            if in_table and table_data:
                elements.extend(_render_table(table_data, styles))
                table_data = []
                in_table = False
            
            # 处理行内格式
            text = _process_inline_formatting(line, bold_font)
            elements.append(Paragraph(text, styles["body"]))
            elements.append(Spacer(1, 4))
        
        i += 1
    
    # 处理最后的表格
    if in_table and table_data:
        elements.extend(_render_table(table_data, styles))
    
    return elements


def _process_inline_formatting(text: str, bold_font: str = "CN_Bold") -> str:
    """处理行内格式（粗体、斜体等）"""
    import re
    
    # 使用明确的字体名称来渲染粗体和斜体
    # ReportLab 的 <b> 标签可能不能正确处理中文字体的粗体
    # 所以我们使用 <font name="CN_Bold"> 来明确指定粗体字体
    text = re.sub(r'\*\*(.+?)\*\*', rf'<font name="{bold_font}"><b>\1</b></font>', text)
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    text = re.sub(r'`(.+?)`', r'<font face="Courier">\1</font>', text)
    
    return text


def _render_table(table_data: list, styles: dict) -> list:
    """渲染表格为 PDF 元素"""
    elements = []
    
    if not table_data or len(table_data) < 2:
        return elements
    
    # 计算列数
    num_cols = max(len(row) for row in table_data)
    col_width = (A4[0] - 30*mm) / num_cols
    
    # 确保所有行都有相同的列数
    for row in table_data:
        while len(row) < num_cols:
            row.append(Paragraph("", styles["body"]))
    
    # 创建表格
    table = Table(table_data, colWidths=[col_width] * num_cols)
    
    table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), styles["normal"].fontName),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('BACKGROUND', (0, 0), (-1, 0), LIGHT_BLUE),  # 表头背景
        ('TEXTCOLOR', (0, 0), (-1, -1), GRAY_TEXT),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),  # 使用 TOP 对齐以便处理多行文本
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.3, HexColor("#cccccc")),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 8))
    return elements


def generate_pdf_report(data: List[dict], title: str = "AI简历筛选报告") -> bytes:
    """生成PDF报告（支持Markdown渲染）
    
    Args:
        data: 筛选结果数据列表
        title: 报告标题
        
    Returns:
        PDF文件的字节内容
    """
    from reportlab.platypus import HRFlowable
    
    # 注册中文字体 (返回常规字体和粗体字体)
    chinese_font, bold_font = _register_chinese_font()
    
    # 创建样式字典
    styles = _create_styles(chinese_font, bold_font)
    
    # 创建字节流
    buffer = BytesIO()
    
    # 创建文档
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15*mm,
        leftMargin=15*mm,
        topMargin=15*mm,
        bottomMargin=15*mm
    )
    
    # 构建文档内容
    story = []
    
    # 标题
    story.append(Paragraph(title, styles["name"]))
    story.append(Paragraph("AI 简历筛选评估报告", styles["title"]))
    
    # 生成时间
    generated_time = datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')
    story.append(Paragraph(f"生成时间：{generated_time}", styles["contact"]))
    story.append(Paragraph(f"简历数量：{len(data)} 份", styles["contact"]))
    story.append(Spacer(1, 10))
    
    # 分隔线
    story.append(HRFlowable(width="100%", thickness=1.5, color=LINE_COLOR, spaceAfter=10))
    story.append(Spacer(1, 10))
    
    # 遍历每个结果
    for idx, item in enumerate(data, 1):
        # 格式化相似度
        similarity = item.get('rerank_score', 0) * 100
        
        # 文件名和基本信息
        filename = item.get('filename', '未知文件')
        story.extend(_section_header(f"{idx}. {filename}", styles))
        
        # 基本信息
        file_size = item.get('file_size', 0)
        if file_size < 1024:
            size_str = f"{file_size} B"
        elif file_size < 1024 * 1024:
            size_str = f"{file_size / 1024:.2f} KB"
        else:
            size_str = f"{file_size / (1024 * 1024):.2f} MB"
        
        created_at = item.get('created_at', 0)
        if isinstance(created_at, (int, float)):
            upload_time = datetime.fromtimestamp(created_at).strftime('%Y-%m-%d %H:%M:%S')
        else:
            upload_time = str(created_at) if created_at else "未知"
        
        # 基本信息表格
        info_data = [
            [Paragraph("<b>相似度：</b>", styles["body"]), 
             Paragraph(f"{similarity:.1f}%", styles["body"])],
            [Paragraph("<b>上传时间：</b>", styles["body"]), 
             Paragraph(upload_time, styles["body"])],
            [Paragraph("<b>文件大小：</b>", styles["body"]), 
             Paragraph(size_str, styles["body"])],
        ]
        
        info_table = Table(info_data, colWidths=[30*mm, 80*mm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), chinese_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 8))
        
        # AI评估 - 使用 Markdown 解析
        if item.get('llm_evaluation'):
            story.extend(_section_header("AI 评估", styles))
            
            try:
                # 解析 Markdown 并添加到 story
                eval_content = item['llm_evaluation']
                md_story = _parse_markdown_to_story(eval_content, styles, bold_font)
                story.extend(md_story)
                
            except Exception as e:
                logger.warning(f"Markdown解析失败，使用纯文本: {e}")
                # 降级为纯文本
                eval_content = item['llm_evaluation'].replace('\n', '<br/>')
                story.append(Paragraph(eval_content, styles["body"]))
        
        story.append(Spacer(1, 15))
        
        # 添加分隔线
        story.append(HRFlowable(width="100%", thickness=0.5, color=LINE_COLOR, spaceAfter=6))
        story.append(Spacer(1, 10))
    
    # 构建PDF
    doc.build(story)
    
    return buffer.getvalue()


@router.post("/export-pdf")
async def export_pdf(
    request: dict,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """导出筛选结果为PDF
    
    Args:
        request: 包含result_ids的请求体
        current_user: 当前用户
        db: 数据库会话
        
    Returns:
        PDF文件响应
    """
    try:
        # 检查权限
        if not check_permission(Permission.SCREENING_EXECUTE, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"缺少所需权限: {Permission.SCREENING_EXECUTE.value}"
            )
        
        # 获取用户ID
        user_result = await db.execute(
            select(User.id).where(User.username == current_user['username'])
        )
        user_id = user_result.scalar_one_or_none()
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )
        
        # 获取要导出的结果ID列表
        result_ids = request.get('result_ids', [])
        if not result_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请选择要导出的结果"
            )
        
        # 查询筛选结果
        results = []
        for result_id in result_ids:
            # 查询筛选结果
            query_result = await db.execute(
                select(ScreeningResult)
                .where(
                    ScreeningResult.result_id == result_id,
                    ScreeningResult.user_id == user_id
                )
            )
            screening_result = query_result.scalar_one_or_none()
            
            if screening_result:
                # 获取简历信息
                resume_result = await db.execute(
                    select(Resume).where(Resume.resume_id == screening_result.resume_id)
                )
                resume = resume_result.scalar_one_or_none()
                
                if resume:
                    results.append({
                        'resume_id': resume.resume_id,
                        'filename': resume.original_filename,
                        'file_size': resume.file_size,
                        'created_at': resume.created_at,
                        'rerank_score': screening_result.rerank_score,
                        'llm_evaluation': screening_result.llm_evaluation
                    })
        
        if not results:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="未找到任何结果"
            )
        
        # 生成PDF
        logger.info(f"开始生成PDF报告, 用户: {current_user['username']}, 结果数: {len(results)}")
        pdf_bytes = generate_pdf_report(results)
        
        # 返回PDF响应 - 使用RFC 5987编码中文文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}简历筛选报告.pdf"
        encoded_filename = quote(filename)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导出PDF失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"导出PDF失败: {str(e)}"
        )
