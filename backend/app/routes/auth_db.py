"""基于数据库的认证和用户管理路由"""

import uuid
import base64
import random

import redis
from fastapi import APIRouter, Depends, HTTPException, status, Request
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
from ..config import REDIS_HOST, REDIS_PORT, REDIS_DB
from ..utils.logger import logger
from ..utils.fastapi_logger import get_client_ip
from ..services.email_service import send_verification_code, verify_code

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ========== Redis 工具 ==========


def _get_redis() -> redis.Redis:
    """获取 Redis 连接"""
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)


# ========== 登录安全配置 ==========

_CAPTCHA_EXPIRE = 300       # 验证码 5 分钟过期
_LOGIN_FAIL_WINDOW = 900    # 失败计数窗口 15 分钟
_LOGIN_FAIL_LIMIT = 5       # 触发验证码的失败次数
_IP_LOCK_LIMIT = 10         # IP 锁定阈值
_IP_LOCK_DURATION = 1800    # IP 锁定 30 分钟
_ACCOUNT_LOCK_LIMIT = 8     # 账号锁定阈值
_ACCOUNT_LOCK_DURATION = 3600  # 账号锁定 1 小时


def _gen_captcha_text(length: int = 4) -> str:
    """生成图形验证码文本（排除易混淆字符）"""
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(chars, k=length))


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
    captcha_id: Optional[str] = Field(None, description="图形验证码ID")
    captcha_code: Optional[str] = Field(None, description="图形验证码")


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


# ========== 图形验证码接口 ==========


@router.get("/captcha")
async def get_captcha():
    """生成图形验证码，返回 captcha_id 和 base64 图片"""
    captcha_id = str(uuid.uuid4())
    text = _gen_captcha_text(4)

    # 生成图片
    from captcha.image import ImageCaptcha
    generator = ImageCaptcha(width=120, height=40)
    buf = generator.generate(text)
    b64 = base64.b64encode(buf.getvalue()).decode()

    # 存入 Redis
    r = _get_redis()
    r.setex(f"captcha:{captcha_id}", _CAPTCHA_EXPIRE, text.lower())

    return {"captcha_id": captcha_id, "captcha_image": f"data:image/png;base64,{b64}"}


# ========== 登录接口（含安全防护） ==========


@router.post("/login", response_model=TokenResponse)
async def login(user_login: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    """用户登录（含验证码校验、失败计数、IP/账号锁定）"""
    client_ip = get_client_ip(request) or "unknown"
    r = _get_redis()

    # --- 1. 检查 IP 是否被锁定 ---
    ip_lock_key = f"login_lock:{client_ip}"
    ip_lock_ttl = r.ttl(ip_lock_key)
    if ip_lock_ttl > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"该 IP 登录失败次数过多，请 {ip_lock_ttl} 秒后再试",
        )

    # --- 2. 查找用户 ---
    result = await db.execute(
        select(User).where(
            (User.username == user_login.username) | (User.email == user_login.username)
        )
    )
    user = result.scalar_one_or_none()

    # --- 3. 检查账号是否被锁定 ---
    if user:
        acct_lock_key = f"login_lock_account:{user.username}"
        acct_lock_ttl = r.ttl(acct_lock_key)
        if acct_lock_ttl > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"该账号已被临时锁定，请 {acct_lock_ttl} 秒后再试",
            )

    # --- 4. 检查是否需要验证码 ---
    ip_fail_key = f"login_fail:{client_ip}"
    ip_fail_count = int(r.get(ip_fail_key) or 0)
    need_captcha = ip_fail_count >= _LOGIN_FAIL_LIMIT

    if need_captcha:
        if not user_login.captcha_id or not user_login.captcha_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="请输入图形验证码",
            )
        # 校验验证码
        captcha_key = f"captcha:{user_login.captcha_id}"
        stored = r.get(captcha_key)
        # 无论是否匹配，验证后立即删除（一次性使用）
        r.delete(captcha_key)
        if not stored or stored != user_login.captcha_code.lower().strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="图形验证码错误或已过期",
            )

    # --- 5. 验证用户和密码 ---
    if not user:
        _record_login_fail(r, client_ip, ip_fail_key, ip_fail_count)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户已被禁用",
        )

    if not verify_password(user_login.password, user.password_hash):
        _record_login_fail(r, client_ip, ip_fail_key, ip_fail_count, username=user.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )

    # --- 6. 登录成功：清除失败计数 ---
    r.delete(ip_fail_key)
    r.delete(f"login_fail_account:{user.username}")

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

    logger.info(f"用户登录: {user.username}, IP: {client_ip}")

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


def _record_login_fail(
    r: redis.Redis,
    client_ip: str,
    ip_fail_key: str,
    ip_fail_count: int,
    username: str | None = None,
) -> None:
    """记录登录失败，并在达到阈值时锁定 IP / 账号"""
    # IP 失败计数
    r.incr(ip_fail_key)
    if ip_fail_count == 0:
        r.expire(ip_fail_key, _LOGIN_FAIL_WINDOW)

    new_count = ip_fail_count + 1

    # IP 锁定
    if new_count >= _IP_LOCK_LIMIT:
        r.setex(f"login_lock:{client_ip}", _IP_LOCK_DURATION, "1")
        logger.warning(f"IP 锁定: {client_ip}, 累计失败 {new_count} 次")

    # 账号失败计数
    if username:
        acct_fail_key = f"login_fail_account:{username}"
        acct_fail_count = int(r.incr(acct_fail_key))
        if acct_fail_count == 1:
            r.expire(acct_fail_key, _ACCOUNT_LOCK_DURATION)
        if acct_fail_count >= _ACCOUNT_LOCK_LIMIT:
            r.setex(
                f"login_lock_account:{username}", _ACCOUNT_LOCK_DURATION, "1"
            )
            logger.warning(f"账号锁定: {username}, 累计失败 {acct_fail_count} 次")


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
