"""基于数据库的认证和用户管理路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User, Company
from ..auth import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_active_user,
    Role,
    Permission,
    require_permission
)
from ..utils.logger import logger
from ..services.email_service import send_verification_code, verify_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class UserCreate(BaseModel):
    """用户注册请求"""
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"
    verification_code: str = Field(..., description="邮箱验证码")
    invite_code: Optional[str] = Field(None, description="公司邀请码（可选）")


class SendCodeRequest(BaseModel):
    """发送验证码请求"""
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    """忘记密码 - 发送验证码请求"""
    username: str
    email: EmailStr


class CheckUsernameRequest(BaseModel):
    """忘记密码 - 校验用户名是否存在"""
    username: str


class CheckEmailRequest(BaseModel):
    """忘记密码 - 校验邮箱是否存在"""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """忘记密码 - 重置密码请求"""
    username: str
    email: EmailStr
    verification_code: str
    new_password: str


class UserLogin(BaseModel):
    """用户登录请求"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """Token 响应"""
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    """用户响应"""
    id: str
    username: str
    email: str
    full_name: str | None = None
    role: str
    permissions: List[str] = []
    is_active: bool
    company_id: str | None = None


@router.post("/send-code")
async def send_code(req: SendCodeRequest):
    """发送邮箱验证码"""
    result = await send_verification_code(req.email)
    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["detail"]
        )
    return {"success": True, "message": "验证码已发送"}


@router.post("/forgot-password/check-username")
async def forgot_password_check_username(
    req: CheckUsernameRequest,
    db: AsyncSession = Depends(get_db)
):
    """忘记密码 - 校验用户名是否存在"""
    result = await db.execute(
        select(User).where(User.username == req.username)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名不存在"
        )

    return {"success": True, "detail": "用户名存在"}


@router.post("/forgot-password/check-email")
async def forgot_password_check_email(
    req: CheckEmailRequest,
    db: AsyncSession = Depends(get_db)
):
    """忘记密码 - 校验邮箱是否存在"""
    result = await db.execute(
        select(User).where(User.email == req.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱不存在"
        )

    return {"success": True, "detail": "邮箱存在"}


@router.post("/forgot-password/check")
async def forgot_password_check(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """忘记密码 - 校验用户名和邮箱是否匹配"""
    result = await db.execute(
        select(User).where(User.username == req.username, User.email == req.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名和邮箱不匹配"
        )

    return {"success": True, "detail": "验证通过"}


@router.post("/forgot-password/send-code")
async def forgot_password_send_code(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """忘记密码 - 发送验证码（需验证用户名和邮箱匹配）"""
    result = await db.execute(
        select(User).where(User.username == req.username, User.email == req.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名和邮箱不匹配"
        )

    email_result = await send_verification_code(req.email, purpose="reset_password")
    if not email_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_result["detail"]
        )

    return {"success": True, "message": "验证码已发送"}


@router.post("/forgot-password/reset")
async def forgot_password_reset(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):
    """忘记密码 - 验证验证码后重置密码"""
    # 验证用户名和邮箱匹配
    result = await db.execute(
        select(User).where(User.username == req.username, User.email == req.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名和邮箱不匹配"
        )

    # 验证邮箱验证码
    if not verify_code(req.email, req.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )

    # 更新密码
    user.password_hash = get_password_hash(req.new_password)
    await db.commit()

    logger.info(f"用户通过忘记密码重置密码: {user.username}")

    return {"success": True, "message": "密码重置成功，请使用新密码登录"}


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册（需要邮箱验证码，通过邀请码加入公司）"""
    # 验证邮箱验证码
    if not verify_code(user.email, user.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="验证码错误或已过期"
        )

    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )

    # 验证角色
    try:
        Role(user.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的角色，可选值: {[r.value for r in Role]}"
        )

    # 禁止注册 admin
    if user.role.lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不允许注册此角色"
        )

    # 通过邀请码加入公司（可选）
    company_id = None
    if user.invite_code:
        company_result = await db.execute(
            select(Company).where(Company.invite_code == user.invite_code.strip().upper())
        )
        company = company_result.scalar_one_or_none()
        if not company:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邀请码无效，请检查后重试"
            )
        company_id = company.id

    # 创建新用户
    user_id = f"user_{user.username}"
    new_user = User(
        id=user_id,
        username=user.username,
        email=user.email,
        password_hash=get_password_hash(user.password),
        full_name=user.full_name,
        role=user.role,
        is_active=True,
        company_id=company_id
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"新用户注册: {user.username}, 角色: {user.role}, 公司: {company_id}")

    return {
        "id": new_user.id,
        "username": new_user.username,
        "email": new_user.email,
        "full_name": new_user.full_name,
        "role": new_user.role,
        "permissions": [],
        "is_active": new_user.is_active,
        "company_id": new_user.company_id
    }


@router.post("/login", response_model=TokenResponse)
async def login(user_login: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    # 查找用户（通过用户名或邮箱）
    result = await db.execute(
        select(User).where(
            (User.username == user_login.username) | (User.email == user_login.username)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )

    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用"
        )

    # 验证密码
    if not verify_password(user_login.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )

    # 获取用户权限
    from ..auth.rbac import get_role_permissions
    user_role = Role(user.role)
    permissions = [p.value for p in get_role_permissions(user_role)]

    # 生成访问令牌
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role,
            "permissions": permissions
        }
    )

    logger.info(f"用户登录: {user.username}")

    return TokenResponse(
        access_token=access_token,
        user={
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "company_id": user.company_id
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取当前用户信息"""
    result = await db.execute(select(User).where(User.username == current_user["username"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    from ..auth.rbac import get_role_permissions
    user_role = Role(user.role)
    permissions = [p.value for p in get_role_permissions(user_role)]

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        permissions=permissions,
        is_active=user.is_active,
        company_id=user.company_id
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: dict = Depends(require_permission(Permission.USER_READ)),
    db: AsyncSession = Depends(get_db)
):
    """获取用户列表（需要用户读取权限，按公司隔离）"""
    from ..auth.rbac import get_role_permissions

    user_role = Role(current_user.get("role", Role.USER))

    # 管理员可以看到所有用户
    if user_role == Role.ADMIN:
        result = await db.execute(select(User))
    else:
        # 非管理员只能看到同公司用户
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        if not me or not me.company_id:
            return []
        result = await db.execute(
            select(User).where(User.company_id == me.company_id)
        )

    users = result.scalars().all()

    user_list = []
    for user in users:
        u_role = Role(user.role)
        permissions = [p.value for p in get_role_permissions(u_role)]
        user_list.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            permissions=permissions,
            is_active=user.is_active,
            company_id=user.company_id
        ))

    return user_list
