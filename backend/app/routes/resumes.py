"""简历管理路由"""

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import uuid
import os
from pathlib import Path
from ..utils.pdf_parser import parse_pdf, clean_text
from ..models.schemas import ResumeUploadResponse
from ..models.user import Resume, Job, ScreeningResult
from ..utils.logger import logger
from ..auth import get_current_user_from_token, get_current_active_user, Permission
from ..database import get_db
from sqlalchemy import select
from ..tasks import process_resume_embedding
from ..core.system import ResumeScreeningSystem
from ..services.llm import LLMClient
from pydantic import BaseModel

router = APIRouter(prefix="/api/resumes", tags=["Resumes"])

# 创建上传目录
UPLOAD_DIR = Path(__file__).parent.parent / "uploads" / "pdf"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class BatchDeleteRequest(BaseModel):
    """批量删除请求"""
    resume_ids: list[str]


@router.post("/upload", response_model=ResumeUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    job_id: Optional[str] = Body(None),
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """上传 PDF 简历

    Args:
        file: PDF 文件
        current_user: 当前用户
        db: 数据库会话

    Returns:
        上传结果
    """
    # 验证文件类型
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="只支持 PDF 格式的简历文件"
        )

    # 检查权限
    from ..auth.rbac import check_permission
    if not check_permission(Permission.RESUME_CREATE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.RESUME_CREATE.value}"
        )

    try:
        # 读取文件内容
        file_bytes = await file.read()
        logger.info(f"接收到文件: {file.filename}, 大小: {len(file_bytes)} bytes")

        # 解析 PDF
        raw_text = parse_pdf(file_bytes)
        if not raw_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PDF 解析失败，无法提取文本内容"
            )

        # 清理文本
        resume_text = clean_text(raw_text)
        if len(resume_text) < 100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="简历文本内容过短，请检查文件内容"
            )

        # 从数据库获取用户 ID
        from ..models.user import User
        result = await db.execute(
            select(User).where(User.username == current_user['username'])
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 生成唯一 ID
        resume_id = str(uuid.uuid4())

        # 生成脱敏文本（上传时一次计算，筛选时直接使用）
        llm_client = LLMClient()
        anonymized_text = llm_client.anonymize_resume(resume_text)

        # 保存 PDF 文件
        file_path = UPLOAD_DIR / f"{resume_id}.pdf"
        with open(file_path, "wb") as f:
            f.write(file_bytes)
        logger.info(f"PDF 文件已保存: {file_path}")

        # 验证岗位是否存在（如果提供了岗位ID）
        if job_id:
            result = await db.execute(
                select(Job).where(Job.job_id == job_id)
            )
            job = result.scalar_one_or_none()
            if not job:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="指定的岗位不存在"
                )

        # 保存到数据库
        resume = Resume(
            resume_id=resume_id,
            original_filename=file.filename,
            file_size=len(file_bytes),
            resume_text=resume_text,
            anonymized_resume_text=anonymized_text,
            user_id=user.id,
            job_id=job_id
        )
        db.add(resume)
        await db.commit()
        logger.info(f"简历信息已保存到数据库: {resume_id}")

        # 异步处理 embedding（不阻塞响应）
        try:
            process_resume_embedding.delay(resume_id, resume_text)
            logger.info(f"已提交 embedding 异步任务: {resume_id}")
        except Exception as e:
            logger.error(f"提交 embedding 任务失败: {e}")
            # 不影响整体上传流程，继续返回成功

        logger.info(f"简历上传成功: {resume_id}, 用户: {current_user['username']}")

        return ResumeUploadResponse(
            success=True,
            message="简历上传成功，正在后台处理",
            resume_id=resume_id,
            resume_text=resume_text
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"简历上传失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"简历上传失败: {str(e)}"
        )


@router.delete("/{resume_id}")
async def delete_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """删除简历

    Args:
        resume_id: 简历 ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        删除结果
    """
    # 检查权限
    from ..auth.rbac import check_permission
    if not check_permission(Permission.RESUME_DELETE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.RESUME_DELETE.value}"
        )

    try:
        # 从数据库删除
        result = await db.execute(
            select(Resume).where(Resume.resume_id == resume_id)
        )
        resume = result.scalar_one_or_none()

        if resume:
            # 软删除关联的筛选结果记录（保留记录，配额计算仍计入）
            sr_result = await db.execute(
                select(ScreeningResult).where(
                    ScreeningResult.resume_id == resume_id,
                    ScreeningResult.deleted == False
                )
            )
            screening_results = sr_result.scalars().all()
            if screening_results:
                for sr in screening_results:
                    sr.deleted = True
                logger.info(f"已软删除关联的筛选结果 {len(screening_results)} 条: {resume_id}")

            await db.delete(resume)
            await db.commit()
            logger.info(f"简历记录已从数据库删除: {resume_id}, 用户: {current_user['username']}")

            # 从向量数据库删除
            try:
                screening_system = ResumeScreeningSystem()
                screening_system.delete_resume(resume_id)
            except Exception as e:
                logger.error(f"从向量数据库删除简历时出错: {e}")
                # 不影响整体删除流程，继续
        else:
            logger.warning(f"简历记录不存在: {resume_id}")

        # 检查文件是否存在并删除
        file_path = UPLOAD_DIR / f"{resume_id}.pdf"
        if file_path.exists():
            file_path.unlink()
            logger.info(f"简历文件已删除: {resume_id}, 用户: {current_user['username']}")
        else:
            logger.warning(f"简历文件不存在: {resume_id}")

        return {"success": True, "message": "简历删除成功"}

    except Exception as e:
        logger.error(f"简历删除失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"简历删除失败: {str(e)}"
        )


@router.post("/batch-delete")
async def batch_delete_resumes(
    request: BatchDeleteRequest,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """批量删除简历

    Args:
        request: 批量删除请求，包含简历 ID 列表
        current_user: 当前用户
        db: 数据库会话

    Returns:
        删除结果
    """
    # 检查权限
    from ..auth.rbac import check_permission
    if not check_permission(Permission.RESUME_DELETE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.RESUME_DELETE.value}"
        )

    if not request.resume_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择要删除的简历"
        )

    try:
        deleted_count = 0
        failed_count = 0
        failed_ids = []

        # 创建筛选系统实例
        screening_system = ResumeScreeningSystem()

        for resume_id in request.resume_ids:
            try:
                # 从数据库删除
                result = await db.execute(
                    select(Resume).where(Resume.resume_id == resume_id)
                )
                resume = result.scalar_one_or_none()

                if resume:
                    # 软删除关联的筛选结果记录（保留记录，配额计算仍计入）
                    sr_result = await db.execute(
                        select(ScreeningResult).where(
                            ScreeningResult.resume_id == resume_id,
                            ScreeningResult.deleted == False
                        )
                    )
                    screening_results = sr_result.scalars().all()
                    if screening_results:
                        for sr in screening_results:
                            sr.deleted = True
                        logger.info(
                            f"已软删除关联的筛选结果 {len(screening_results)} 条: {resume_id}"
                        )

                    await db.delete(resume)
                    await db.commit()
                    deleted_count += 1
                    logger.info(f"简历记录已从数据库删除: {resume_id}")

                    # 从向量数据库删除
                    try:
                        screening_system.delete_resume(resume_id)
                    except Exception as e:
                        logger.error(f"从向量数据库删除简历时出错: {resume_id}, 错误: {e}")
                        # 不影响整体删除流程，继续

                    # 删除文件
                    file_path = UPLOAD_DIR / f"{resume_id}.pdf"
                    if file_path.exists():
                        file_path.unlink()
                        logger.info(f"简历文件已删除: {resume_id}")
                else:
                    logger.warning(f"简历记录不存在: {resume_id}")
                    failed_ids.append(resume_id)
                    failed_count += 1

            except Exception as e:
                logger.error(f"删除简历失败: {resume_id}, 错误: {e}")
                failed_ids.append(resume_id)
                failed_count += 1

        result_message = f"成功删除 {deleted_count} 个简历"
        if failed_count > 0:
            result_message += f"，失败 {failed_count} 个"

        logger.info(f"批量删除完成: 成功 {deleted_count}，失败 {failed_count}, 用户: {current_user['username']}")

        return {
            "success": True,
            "message": result_message,
            "deleted_count": deleted_count,
            "failed_count": failed_count,
            "failed_ids": failed_ids
        }

    except Exception as e:
        logger.error(f"批量删除简历失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量删除失败: {str(e)}"
        )


@router.get("/list")
async def list_resumes(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取简历列表

    Args:
        current_user: 当前用户
        db: 数据库会话

    Returns:
        简历列表
    """
    # 检查权限
    from ..auth.rbac import check_permission, Role
    if not check_permission(Permission.RESUME_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.RESUME_READ.value}"
        )

    try:
        # 获取当前用户信息
        from ..models.user import User
        result = await db.execute(
            select(User).where(User.username == current_user['username'])
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 根据用户角色过滤简历
        user_role = Role(current_user.get("role", Role.USER))
        
        if user_role == Role.ADMIN:
            # 管理员可以看到所有简历
            query = select(Resume).order_by(Resume.created_at.desc())
        else:
            # 非管理员只能看到自己上传的简历
            query = select(Resume).where(
                Resume.user_id == user.id
            ).order_by(Resume.created_at.desc())

        result = await db.execute(query)
        resumes = result.scalars().all()
        resumes_list = [resume.to_dict() for resume in resumes]

        logger.info(f"获取简历列表: {len(resumes_list)} 个简历, 用户: {current_user['username']}, 角色: {user_role.value}")

        return {"success": True, "resumes": resumes_list}

    except Exception as e:
        logger.error(f"获取简历列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取简历列表失败: {str(e)}"
        )


@router.get("/{resume_id}/file")
async def get_resume_file(
    resume_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """获取简历 PDF 文件

    Args:
        resume_id: 简历 ID
        current_user: 当前用户

    Returns:
        PDF 文件
    """
    # 检查权限
    from ..auth.rbac import check_permission
    if not check_permission(Permission.RESUME_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.RESUME_READ.value}"
        )

    try:
        file_path = UPLOAD_DIR / f"{resume_id}.pdf"

        if not file_path.exists():
            logger.warning(f"简历文件不存在: {resume_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="简历文件不存在"
            )

        from fastapi.responses import FileResponse
        return FileResponse(
            file_path,
            media_type='application/pdf',
            filename=file_path.name,
            headers={
                'Content-Disposition': 'inline',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取简历文件失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取简历文件失败: {str(e)}"
        )
