"""公司管理路由（管理员专用）"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..database import get_db
from ..models.user import Company, User
from ..auth import (
    get_current_active_user,
    Permission,
    require_permission,
)
from ..auth.rbac import check_permission, Role
from ..utils.logger import logger

router = APIRouter(prefix="/api/companies", tags=["Company Management"])


class CompanyCreate(BaseModel):
    """创建公司请求"""
    name: str


class CompanyUpdate(BaseModel):
    """更新公司请求"""
    name: Optional[str] = None


class CompanyResponse(BaseModel):
    """公司响应"""
    id: str
    name: str
    invite_code: str
    user_count: int = 0
    created_at: Optional[str] = None


@router.get("", response_model=List[CompanyResponse])
async def list_companies(
    current_user: dict = Depends(require_permission(Permission.COMPANY_READ)),
    db: AsyncSession = Depends(get_db)
):
    """获取公司列表（需要公司读取权限，仅管理员可用）"""
    result = await db.execute(
        select(Company).order_by(Company.created_at.desc())
    )
    companies = result.scalars().all()

    # 统计每个公司的用户数
    company_list = []
    for company in companies:
        count_result = await db.execute(
            select(func.count(User.id)).where(User.company_id == company.id)
        )
        user_count = count_result.scalar() or 0

        company_list.append(CompanyResponse(
            id=company.id,
            name=company.name,
            invite_code=company.invite_code,
            user_count=user_count,
            created_at=company.created_at.isoformat() if company.created_at else None
        ))

    logger.info(f"获取公司列表, 共 {len(company_list)} 个公司")
    return company_list


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_data: CompanyCreate,
    current_user: dict = Depends(require_permission(Permission.COMPANY_CREATE)),
    db: AsyncSession = Depends(get_db)
):
    """创建公司（需要公司创建权限，仅管理员可用）

    创建后自动生成邀请码，用户可通过邀请码注册加入公司。
    """
    name = company_data.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="公司名称不能为空"
        )

    # 生成唯一邀请码
    invite_code = Company.generate_invite_code()
    for _ in range(10):
        existing = await db.execute(
            select(Company).where(Company.invite_code == invite_code)
        )
        if not existing.scalar_one_or_none():
            break
        invite_code = Company.generate_invite_code()

    company_id = f"company_{invite_code}"
    new_company = Company(
        id=company_id,
        name=name,
        invite_code=invite_code
    )
    db.add(new_company)
    await db.commit()
    await db.refresh(new_company)

    logger.info(
        f"创建公司: {name}, 邀请码: {invite_code}, "
        f"操作者: {current_user['username']}"
    )

    return CompanyResponse(
        id=new_company.id,
        name=new_company.name,
        invite_code=new_company.invite_code,
        user_count=0,
        created_at=new_company.created_at.isoformat() if new_company.created_at else None
    )


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: str,
    company_data: CompanyUpdate,
    current_user: dict = Depends(require_permission(Permission.COMPANY_UPDATE)),
    db: AsyncSession = Depends(get_db)
):
    """更新公司信息（需要公司更新权限，仅管理员可用）"""
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="公司不存在"
        )

    if company_data.name is not None:
        name = company_data.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="公司名称不能为空"
            )
        company.name = name

    await db.commit()
    await db.refresh(company)

    # 统计用户数
    count_result = await db.execute(
        select(func.count(User.id)).where(User.company_id == company_id)
    )
    user_count = count_result.scalar() or 0

    logger.info(
        f"更新公司: {company.name}, 操作者: {current_user['username']}"
    )

    return CompanyResponse(
        id=company.id,
        name=company.name,
        invite_code=company.invite_code,
        user_count=user_count,
        created_at=company.created_at.isoformat() if company.created_at else None
    )


@router.post("/{company_id}/reset-invite-code", response_model=CompanyResponse)
async def reset_invite_code(
    company_id: str,
    current_user: dict = Depends(require_permission(Permission.COMPANY_UPDATE)),
    db: AsyncSession = Depends(get_db)
):
    """重置公司邀请码（需要公司更新权限，仅管理员可用）

    旧邀请码将失效，需要通知公司用户使用新邀请码。
    """
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="公司不存在"
        )

    old_code = company.invite_code

    # 生成新的唯一邀请码
    new_code = Company.generate_invite_code()
    for _ in range(10):
        existing = await db.execute(
            select(Company).where(Company.invite_code == new_code)
        )
        if not existing.scalar_one_or_none():
            break
        new_code = Company.generate_invite_code()

    company.invite_code = new_code
    await db.commit()
    await db.refresh(company)

    # 统计用户数
    count_result = await db.execute(
        select(func.count(User.id)).where(User.company_id == company_id)
    )
    user_count = count_result.scalar() or 0

    logger.info(
        f"重置邀请码: {company.name}, {old_code} -> {new_code}, "
        f"操作者: {current_user['username']}"
    )

    return CompanyResponse(
        id=company.id,
        name=company.name,
        invite_code=company.invite_code,
        user_count=user_count,
        created_at=company.created_at.isoformat() if company.created_at else None
    )


@router.delete("/{company_id}")
async def delete_company(
    company_id: str,
    current_user: dict = Depends(require_permission(Permission.COMPANY_DELETE)),
    db: AsyncSession = Depends(get_db)
):
    """删除公司（需要公司删除权限，仅管理员可用）

    会同时解除该公司下所有用户的公司关联。
    """
    result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    company = result.scalar_one_or_none()

    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="公司不存在"
        )

    company_name = company.name

    # 解除该公司下所有用户的关联
    user_result = await db.execute(
        select(User).where(User.company_id == company_id)
    )
    users = user_result.scalars().all()
    for user in users:
        user.company_id = None
    logger.info(
        f"解除 {len(users)} 个用户与公司 {company_name} 的关联"
    )

    await db.delete(company)
    await db.commit()

    logger.info(
        f"删除公司: {company_name}, 操作者: {current_user['username']}"
    )

    return {"success": True, "message": f"公司 {company_name} 已删除"}


class CompanyUserItem(BaseModel):
    """公司下用户简要信息"""
    id: str
    username: str
    full_name: Optional[str] = None
    email: str
    role: str
    is_active: bool


@router.get("/{company_id}/users", response_model=List[CompanyUserItem])
async def list_company_users(
    company_id: str,
    current_user: dict = Depends(require_permission(Permission.COMPANY_READ)),
    db: AsyncSession = Depends(get_db)
):
    """获取公司下的用户列表"""
    # 验证公司存在
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    if not company_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="公司不存在"
        )

    result = await db.execute(
        select(User).where(User.company_id == company_id).order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    return [
        CompanyUserItem(
            id=u.id,
            username=u.username,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
        )
        for u in users
    ]


class BatchAddUsersRequest(BaseModel):
    """批量关联用户请求"""
    user_ids: List[str]


@router.post("/{company_id}/users/batch")
async def batch_add_users(
    company_id: str,
    request_data: BatchAddUsersRequest,
    current_user: dict = Depends(require_permission(Permission.COMPANY_UPDATE)),
    db: AsyncSession = Depends(get_db)
):
    """批量将用户关联到公司"""
    # 验证公司存在
    company_result = await db.execute(
        select(Company).where(Company.id == company_id)
    )
    if not company_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="公司不存在"
        )

    if not request_data.user_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户列表不能为空"
        )

    success_count = 0
    skipped_count = 0

    for user_id in request_data.user_ids:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            skipped_count += 1
            continue
        if user.company_id == company_id:
            skipped_count += 1
            continue

        # 如果用户已关联其他公司，先解除旧关联
        if user.company_id and user.company_id != company_id:
            old_result = await db.execute(
                select(Company).where(Company.id == user.company_id)
            )
            old_company = old_result.scalar_one_or_none()
            logger.info(
                f"用户 {user.username} 从「{old_company.name if old_company else user.company_id}」"
                f"转入「{company_id}」"
            )

        user.company_id = company_id
        success_count += 1

    await db.commit()

    logger.info(
        f"批量关联用户到公司 {company_id}: "
        f"成功 {success_count}, 跳过 {skipped_count}, "
        f"操作者: {current_user['username']}"
    )

    return {
        "success": True,
        "message": f"已关联 {success_count} 个用户" +
                   (f"，跳过 {skipped_count} 个" if skipped_count > 0 else ""),
        "success_count": success_count,
        "skipped_count": skipped_count,
    }


@router.put("/{company_id}/users/{user_id}")
async def update_company_user(
    company_id: str,
    user_id: str,
    action: str = "remove",
    current_user: dict = Depends(require_permission(Permission.COMPANY_UPDATE)),
    db: AsyncSession = Depends(get_db)
):
    """管理公司下的用户（移除用户的公司关联）"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    if user.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该用户不属于此公司"
        )

    user.company_id = None
    await db.commit()

    logger.info(
        f"将用户 {user.username} 从公司 {company_id} 中移除, "
        f"操作者: {current_user['username']}"
    )

    return {"success": True, "message": f"已将用户 {user.username} 从公司中移除"}
