"""认证和用户管理路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from ..models.schemas import UserCreate, UserLogin, TokenResponse, UserResponse
from ..auth import (
    create_access_token,
    verify_password,
    get_password_hash,
    get_current_active_user,
    Role,
    Permission,
    require_permission,
    require_role
)
from ..utils.logger import logger
import json
from pathlib import Path

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# 简单的用户存储（生产环境应使用数据库）
USERS_FILE = Path(__file__).parent.parent / "data" / "users.json"
USERS_FILE.parent.mkdir(parents=True, exist_ok=True)


def load_users() -> dict:
    """加载用户数据"""
    if USERS_FILE.exists():
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    # 创建默认管理员用户
    default_users = {
        "admin": {
            "username": "admin",
            "email": "admin@example.com",
            "password_hash": get_password_hash("admin123"),
            "full_name": "系统管理员",
            "role": Role.ADMIN.value,
            "is_active": True,
            "id": "user_admin"
        }
    }
    save_users(default_users)
    return default_users


def save_users(users: dict):
    """保存用户数据"""
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    """用户注册"""
    users = load_users()
    
    # 检查用户名是否已存在
    if user.username in users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 检查邮箱是否已存在
    for u in users.values():
        if u.get("email") == user.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被注册"
            )
    
    # 创建新用户
    user_id = f"user_{user.username}"
    users[user.username] = {
        "username": user.username,
        "email": user.email,
        "password_hash": get_password_hash(user.password),
        "full_name": user.full_name,
        "role": user.role.value,
        "is_active": True,
        "id": user_id
    }
    
    save_users(users)
    logger.info(f"新用户注册: {user.username}, 角色: {user.role.value}")
    
    return UserResponse(
        id=user_id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        permissions=[],
        is_active=True
    )


@router.post("/login", response_model=TokenResponse)
async def login(user_login: UserLogin):
    """用户登录"""
    users = load_users()
    
    # 查找用户
    user = None
    for u in users.values():
        if u.get("username") == user_login.username or u.get("email") == user_login.username:
            user = u
            break
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 验证密码
    if not verify_password(user_login.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误"
        )
    
    # 生成访问令牌
    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
            "permissions": []
        }
    )
    
    logger.info(f"用户登录: {user['username']}")
    
    return TokenResponse(
        access_token=access_token,
        user={
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "role": user["role"]
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """获取当前用户信息"""
    users = load_users()
    user = users.get(current_user["username"])
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    from ..auth.rbac import get_role_permissions
    user_role = Role(user["role"])
    permissions = [p.value for p in get_role_permissions(user_role)]
    
    return UserResponse(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user.get("full_name"),
        role=user["role"],
        permissions=permissions,
        is_active=user.get("is_active", True)
    )


@router.get("/users", response_model=List[UserResponse])
async def list_users(current_user: dict = Depends(require_permission(Permission.USER_READ))):
    """获取用户列表（需要用户读取权限）"""
    users = load_users()
    from ..auth.rbac import get_role_permissions
    
    user_list = []
    for user in users.values():
        user_role = Role(user["role"])
        permissions = [p.value for p in get_role_permissions(user_role)]
        user_list.append(UserResponse(
            id=user["id"],
            username=user["username"],
            email=user["email"],
            full_name=user.get("full_name"),
            role=user["role"],
            permissions=permissions,
            is_active=user.get("is_active", True)
        ))
    
    return user_list
