"""岗位管理路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
from ..models.schemas import (
    JobCreate,
    JobUpdate,
    JobResponse,
    JobListResponse,
    JobOperationResponse
)
from ..models.user import User, Job
from ..utils.logger import logger
from ..auth import get_current_active_user, Permission
from ..database import get_db
from ..auth.rbac import check_permission
from ..services.subscription import check_job_quota

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


@router.post("/create", response_model=JobOperationResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """创建岗位

    Args:
        job_data: 岗位数据
        current_user: 当前用户
        db: 数据库会话

    Returns:
        创建结果
    """
    # 检查权限
    if not check_permission(Permission.JOB_CREATE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.JOB_CREATE.value}"
        )

    try:
        # 从数据库获取用户 ID
        result = await db.execute(
            select(User).where(User.username == current_user['username'])
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 检查岗位配额
        allowed, error_msg = await check_job_quota(user, db)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )

        # 生成唯一 ID
        job_id = str(uuid.uuid4())

        # 创建岗位
        job = Job(
            job_id=job_id,
            title=job_data.title,
            description=job_data.description,
            requirements=job_data.requirements,
            experience_years=job_data.experience_years,
            education=job_data.education,
            certifications=job_data.certifications,
            salary_range=job_data.salary_range,
            location=job_data.location,
            user_id=user.id
        )
        db.add(job)
        await db.commit()

        logger.info(f"岗位创建成功: {job_id}, 用户: {current_user['username']}")

        return JobOperationResponse(
            success=True,
            message="岗位创建成功",
            job_id=job_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"岗位创建失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"岗位创建失败: {str(e)}"
        )


@router.get("/list", response_model=JobListResponse)
async def list_jobs(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取岗位列表

    Args:
        current_user: 当前用户
        db: 数据库会话

    Returns:
        岗位列表
    """
    # 检查权限
    from ..auth.rbac import Role
    if not check_permission(Permission.JOB_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.JOB_READ.value}"
        )

    try:
        # 获取当前用户信息
        result = await db.execute(
            select(User).where(User.username == current_user['username'])
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="用户不存在"
            )

        # 根据用户角色过滤岗位
        user_role = Role(current_user.get("role", Role.USER))
        
        if user_role == Role.ADMIN:
            # 管理员可以看到所有岗位
            query = select(Job).order_by(Job.created_at.desc())
        else:
            # 非管理员只能看到自己创建的岗位
            query = select(Job).where(
                Job.user_id == user.id
            ).order_by(Job.created_at.desc())

        result = await db.execute(query)
        jobs = result.scalars().all()
        jobs_list = [job.to_dict() for job in jobs]

        logger.info(f"获取岗位列表: {len(jobs_list)} 个岗位, 用户: {current_user['username']}, 角色: {user_role.value}")

        return JobListResponse(success=True, jobs=jobs_list)

    except Exception as e:
        logger.error(f"获取岗位列表失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取岗位列表失败: {str(e)}"
        )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取岗位详情

    Args:
        job_id: 岗位 ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        岗位详情
    """
    # 检查权限
    if not check_permission(Permission.JOB_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.JOB_READ.value}"
        )

    try:
        result = await db.execute(
            select(Job).where(Job.job_id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="岗位不存在"
            )

        logger.info(f"获取岗位详情: {job_id}, 用户: {current_user['username']}")

        return job.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取岗位详情失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取岗位详情失败: {str(e)}"
        )


@router.put("/{job_id}", response_model=JobOperationResponse)
async def update_job(
    job_id: str,
    job_data: JobUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """更新岗位

    Args:
        job_id: 岗位 ID
        job_data: 岗位数据
        current_user: 当前用户
        db: 数据库会话

    Returns:
        更新结果
    """
    # 检查权限
    if not check_permission(Permission.JOB_UPDATE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.JOB_UPDATE.value}"
        )

    try:
        result = await db.execute(
            select(Job).where(Job.job_id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="岗位不存在"
            )

        # 更新字段
        update_data = job_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(job, field, value)

        await db.commit()

        logger.info(f"岗位更新成功: {job_id}, 用户: {current_user['username']}")

        return JobOperationResponse(
            success=True,
            message="岗位更新成功",
            job_id=job_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"岗位更新失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"岗位更新失败: {str(e)}"
        )


@router.delete("/{job_id}", response_model=JobOperationResponse)
async def delete_job(
    job_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """删除岗位

    Args:
        job_id: 岗位 ID
        current_user: 当前用户
        db: 数据库会话

    Returns:
        删除结果
    """
    # 检查权限
    if not check_permission(Permission.JOB_DELETE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.JOB_DELETE.value}"
        )

    try:
        result = await db.execute(
            select(Job).where(Job.job_id == job_id)
        )
        job = result.scalar_one_or_none()

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="岗位不存在"
            )

        await db.delete(job)
        await db.commit()

        logger.info(f"岗位删除成功: {job_id}, 用户: {current_user['username']}")

        return JobOperationResponse(
            success=True,
            message="岗位删除成功"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"岗位删除失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"岗位删除失败: {str(e)}"
        )
