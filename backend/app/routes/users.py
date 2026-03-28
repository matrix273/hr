"""用户管理路由"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models.user import User, Contact
from ..auth import (
    get_password_hash,
    get_current_active_user,
    Role,
    Permission,
    require_permission
)
from ..auth.rbac import check_permission, get_role_permissions
from ..utils.logger import logger

router = APIRouter(prefix="/api/users", tags=["User Management"])


class UserCreate(BaseModel):
    """创建用户请求"""
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"
    is_active: bool = True
    company_id: Optional[str] = None


class UserRegister(BaseModel):
    """用户注册请求"""
    username: str
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"
    company_id: Optional[str] = None


class ContactForm(BaseModel):
    """联系表单"""
    name: str
    email: EmailStr
    message: str


class UserUpdate(BaseModel):
    """更新用户请求"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserResponse(BaseModel):
    """用户响应"""
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    company_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@router.get("", response_model=List[UserResponse])
async def list_users(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户列表（需要用户读取权限）"""
    if not check_permission(Permission.USER_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.USER_READ.value}"
        )

    user_role = Role(current_user.get("role", Role.USER))

    # 管理员可以看到所有用户
    if user_role == Role.ADMIN:
        query = select(User).order_by(User.created_at.desc())
    else:
        # 非管理员只能看到同公司的用户
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        if not me or not me.company_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前用户未关联公司，无法查看用户列表"
            )

        query = select(User).where(
            User.company_id == me.company_id
        ).order_by(User.created_at.desc())

        # HR和经理不能看到管理员账号
        if user_role in [Role.HR, Role.MANAGER]:
            query = query.where(User.role != Role.ADMIN)
        # 招聘专员和面试官只能看到普通用户
        elif user_role in [Role.RECRUITER, Role.INTERVIEWER]:
            query = query.where(User.role == Role.USER)
        # 普通用户不能查看用户列表
        elif user_role == Role.USER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="普通用户无权查看用户列表"
            )

    result = await db.execute(query)
    users = result.scalars().all()

    user_list = []
    for user in users:
        user_list.append(UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            is_active=user.is_active,
            company_id=user.company_id,
            created_at=user.created_at.isoformat() if user.created_at else None,
            updated_at=user.updated_at.isoformat() if user.updated_at else None
        ))

    logger.info(f"获取用户列表, 共 {len(user_list)} 个用户, 操作者: {current_user['username']}")
    return user_list


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """创建新用户（需要用户创建权限）"""
    if not check_permission(Permission.USER_CREATE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.USER_CREATE.value}"
        )

    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )

    # 验证角色
    try:
        Role(user_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的角色，可选值: {[r.value for r in Role]}"
        )

    # 权限检查：非管理员不能创建管理员角色
    current_user_role = Role(current_user.get("role", Role.USER))
    new_user_role = Role(user_data.role)
    
    if new_user_role == Role.ADMIN and current_user_role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权创建管理员角色"
        )

    # 确定新用户的 company_id
    if current_user_role == Role.ADMIN and user_data.company_id:
        # 管理员可以为用户指定公司
        target_company_id = user_data.company_id
    else:
        # 非管理员创建的用户继承创建者的 company_id
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        target_company_id = me.company_id if me else None

    # 创建新用户
    import uuid
    user_id = f"user_{str(uuid.uuid4())[:8]}"
    new_user = User(
        id=user_id,
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active,
        company_id=target_company_id
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"创建新用户: {user_data.username}, 角色: {user_data.role}, 操作者: {current_user['username']}")

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        company_id=new_user.company_id,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None,
        updated_at=new_user.updated_at.isoformat() if new_user.updated_at else None
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取用户详情（需要用户读取权限）"""
    if not check_permission(Permission.USER_READ, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.USER_READ.value}"
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 非管理员只能查看同公司用户
    current_user_role = Role(current_user.get("role", Role.USER))
    if current_user_role != Role.ADMIN:
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        if not me or me.company_id != user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权查看其他公司的用户信息"
            )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        company_id=user.company_id,
        created_at=user.created_at.isoformat() if user.created_at else None,
        updated_at=user.updated_at.isoformat() if user.updated_at else None
    )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """更新用户信息（需要用户更新权限）"""
    if not check_permission(Permission.USER_UPDATE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.USER_UPDATE.value}"
        )

    # 查找用户
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 权限检查：非管理员只能修改同公司用户
    current_user_role = Role(current_user.get("role", Role.USER))
    if current_user_role != Role.ADMIN:
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        if not me or me.company_id != user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改其他公司的用户信息"
            )

    # 权限检查：HR和经理不能修改管理员账号
    target_user_role = Role(user.role)

    if target_user_role == Role.ADMIN and current_user_role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权修改管理员账号"
        )

    # 权限检查：HR和经理不能将用户提升为管理员
    if user_data.role is not None and Role(user_data.role) == Role.ADMIN and current_user_role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权创建或修改为管理员角色"
        )

    # 更新字段
    if user_data.email is not None:
        # 检查邮箱是否被其他用户使用
        email_result = await db.execute(
            select(User).where(User.email == user_data.email, User.id != user_id)
        )
        if email_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="邮箱已被其他用户使用"
            )
        user.email = user_data.email

    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    if user_data.role is not None:
        # 验证角色
        try:
            Role(user_data.role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的角色，可选值: {[r.value for r in Role]}"
            )
        user.role = user_data.role

    if user_data.is_active is not None:
        user.is_active = user_data.is_active

    if user_data.password is not None and user_data.password.strip():
        user.password_hash = get_password_hash(user_data.password)
        logger.info(f"更新用户密码: {user.username}")

    await db.commit()
    await db.refresh(user)

    logger.info(f"更新用户: {user.username}, 操作者: {current_user['username']}")

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        company_id=user.company_id,
        created_at=user.created_at.isoformat() if user.created_at else None,
        updated_at=user.updated_at.isoformat() if user.updated_at else None
    )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """删除用户（需要用户删除权限）"""
    if not check_permission(Permission.USER_DELETE, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.USER_DELETE.value}"
        )

    # 查找用户
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 不能删除自己
    if user.username == current_user["username"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账户"
        )

    # 权限检查：非管理员只能删除同公司用户
    current_user_role = Role(current_user.get("role", Role.USER))
    if current_user_role != Role.ADMIN:
        me_result = await db.execute(
            select(User).where(User.username == current_user["username"])
        )
        me = me_result.scalar_one_or_none()
        if not me or me.company_id != user.company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权删除其他公司的用户"
            )

    # 权限检查：HR和经理不能删除管理员账号
    target_user_role = Role(user.role)
    
    if target_user_role == Role.ADMIN and current_user_role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权删除管理员账号"
        )

    username = user.username
    await db.delete(user)
    await db.commit()

    logger.info(f"删除用户: {username}, 操作者: {current_user['username']}")

    return {"success": True, "message": f"用户 {username} 已删除"}


# 禁止注册的角色
FORBIDDEN_REGISTER_ROLES = ["admin", "manager"]


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    """用户注册（无需认证，但不能注册 admin 和 manager 角色）"""
    # 检查用户名是否已存在
    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )

    # 检查邮箱是否已存在
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )

    # 验证角色 - 禁止注册 admin 和 manager
    if user_data.role.lower() in FORBIDDEN_REGISTER_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不允许注册此角色，可选角色: hr, recruiter, interviewer, user"
        )

    # 验证角色是否有效
    try:
        Role(user_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的角色，可选值: {[r.value for r in Role if r.value not in FORBIDDEN_REGISTER_ROLES]}"
        )

    # 创建新用户
    import uuid
    user_id = f"user_{str(uuid.uuid4())[:8]}"
    new_user = User(
        id=user_id,
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=True,
        company_id=user_data.company_id
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    logger.info(f"新用户注册: {user_data.username}, 角色: {user_data.role}")

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role,
        is_active=new_user.is_active,
        company_id=new_user.company_id,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None,
        updated_at=new_user.updated_at.isoformat() if new_user.updated_at else None
    )


@router.post("/contact", status_code=status.HTTP_200_OK)
async def submit_contact(
    contact_data: ContactForm,
    db: AsyncSession = Depends(get_db)
):
    """提交联系表单（无需认证）"""
    logger.info(f"收到联系表单: 姓名={contact_data.name}, 邮箱={contact_data.email}, 留言={contact_data.message[:50]}...")

    # 保存到数据库
    new_contact = Contact(
        name=contact_data.name,
        email=contact_data.email,
        message=contact_data.message,
        status="pending"
    )
    db.add(new_contact)
    await db.commit()
    await db.refresh(new_contact)

    logger.info(f"联系表单已保存: ID={new_contact.id}")

    return {
        "success": True,
        "message": "感谢您的留言，我们会尽快与您联系！"
    }


class ContactResponse(BaseModel):
    """联系表单响应"""
    id: int
    name: str
    email: str
    message: str
    status: str
    created_at: Optional[str] = None


@router.get("/contacts", response_model=List[ContactResponse])
async def list_contacts(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取联系表单列表（需要系统管理权限）"""
    if not check_permission(Permission.SYSTEM_ADMIN, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SYSTEM_ADMIN.value}"
        )

    result = await db.execute(select(Contact).order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    return [
        ContactResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            message=c.message,
            status=c.status,
            created_at=c.created_at.isoformat() if c.created_at else None
        )
        for c in contacts
    ]


@router.put("/contacts/{contact_id}")
async def update_contact_status(
    contact_id: int,
    status: str = "processed",
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """更新联系表单状态（需要系统管理权限）"""
    if not check_permission(Permission.SYSTEM_ADMIN, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SYSTEM_ADMIN.value}"
        )

    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="联系记录不存在"
        )

    contact.status = status
    await db.commit()

    logger.info(f"更新联系表单状态: ID={contact_id}, 状态={status}, 操作者: {current_user['username']}")

    return {"success": True, "message": "状态已更新"}
