"""基于数据库的认证和用户管理路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User
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

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class UserCreate(BaseModel):
    """用户注册请求"""
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"


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


async def create_default_admin(db: AsyncSession):
    """创建默认管理员用户"""
    result = await db.execute(select(User).where(User.username == "admin"))
    existing_user = result.scalar_one_or_none()

    if not existing_user:
        admin_user = User(
            id="user_admin",
            username="admin",
            email="admin@example.com",
            password_hash=get_password_hash("admin123"),
            full_name="系统管理员",
            role=Role.ADMIN.value,
            is_active=True
        )
        db.add(admin_user)
        await db.commit()
        logger.info("默认管理员用户已创建: admin/admin123")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    """用户注册"""
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

    # 创建新用户
    user_id = f"user_{user.username}"
    new_user = User(
        id=user_id,
        username=user.username,
        email=user.email,
        password_hash=get_password_hash(user.password),
        full_name=user.full_name,
        role=user.role,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"新用户注册: {user.username}, 角色: {user.role}")

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        permissions=[],
        is_active=new_user.is_active
    )


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
            "role": user.role
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
        is_active=user.is_active
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    current_user: dict = Depends(require_permission(Permission.USER_READ)),
    db: AsyncSession = Depends(get_db)
):
    """获取用户列表（需要用户读取权限）"""
    from ..auth.rbac import get_role_permissions

    result = await db.execute(select(User))
    users = result.scalars().all()

    user_list = []
    for user in users:
        user_role = Role(user.role)
        permissions = [p.value for p in get_role_permissions(user_role)]
        user_list.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            permissions=permissions,
            is_active=user.is_active
        ))

    return user_list
