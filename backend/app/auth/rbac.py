"""基于角色的访问控制 (RBAC)"""

from enum import Enum
from typing import List, Set
from fastapi import HTTPException, status, Depends
from .jwt import get_current_user


class Role(str, Enum):
    """用户角色枚举"""
    ADMIN = "admin"  # 管理员
    MANAGER = "manager"  # 经理
    HR = "hr"  # 人力资源
    RECRUITER = "recruiter"  # 招聘专员
    INTERVIEWER = "interviewer"  # 面试官
    USER = "user"  # 普通用户


class Permission(str, Enum):
    """权限枚举"""
    # 简历管理
    RESUME_READ = "resume:read"
    RESUME_CREATE = "resume:create"
    RESUME_UPDATE = "resume:update"
    RESUME_DELETE = "resume:delete"

    # 岗位管理
    JOB_READ = "job:read"
    JOB_CREATE = "job:create"
    JOB_UPDATE = "job:update"
    JOB_DELETE = "job:delete"

    # 筛选管理
    SCREENING_READ = "screening:read"
    SCREENING_EXECUTE = "screening:execute"
    SCREENING_DELETE = "screening:delete"

    # 用户管理
    USER_READ = "user:read"
    USER_CREATE = "user:create"
    USER_UPDATE = "user:update"
    USER_DELETE = "user:delete"

    # 报表统计
    REPORT_READ = "report:read"

    # 系统管理
    SYSTEM_CONFIG = "system:config"
    SYSTEM_ADMIN = "system:admin"


# 角色权限映射
ROLE_PERMISSIONS: dict[Role, Set[Permission]] = {
    Role.ADMIN: {
        # 简历管理 - 完整权限
        Permission.RESUME_READ,
        Permission.RESUME_CREATE,
        Permission.RESUME_UPDATE,
        Permission.RESUME_DELETE,
        # 岗位管理 - 完整权限
        Permission.JOB_READ,
        Permission.JOB_CREATE,
        Permission.JOB_UPDATE,
        Permission.JOB_DELETE,
        # 筛选管理 - 完整权限
        Permission.SCREENING_READ,
        Permission.SCREENING_EXECUTE,
        Permission.SCREENING_DELETE,
        # 用户管理 - 完整权限
        Permission.USER_READ,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_DELETE,
        # 报表统计 - 完整权限
        Permission.REPORT_READ,
        # 系统管理 - 完整权限
        Permission.SYSTEM_CONFIG,
        Permission.SYSTEM_ADMIN,
    },
    Role.MANAGER: {
        # 简历管理 - 可读取、创建、更新，删除需审批
        Permission.RESUME_READ,
        Permission.RESUME_CREATE,
        Permission.RESUME_UPDATE,
        # 岗位管理 - 完整权限
        Permission.JOB_READ,
        Permission.JOB_CREATE,
        Permission.JOB_UPDATE,
        Permission.JOB_DELETE,
        # 筛选管理 - 可执行和查看，删除需审批
        Permission.SCREENING_READ,
        Permission.SCREENING_EXECUTE,
        # 用户管理 - 可查看和更新用户信息
        Permission.USER_READ,
        Permission.USER_UPDATE,
        # 报表统计 - 可查看报表
        Permission.REPORT_READ,
    },
    Role.HR: {
        # 简历管理 - 可读取、创建、更新，删除需审批
        Permission.RESUME_READ,
        Permission.RESUME_CREATE,
        Permission.RESUME_UPDATE,
        # 岗位管理 - 可创建和修改岗位，删除需审批
        Permission.JOB_READ,
        Permission.JOB_CREATE,
        Permission.JOB_UPDATE,
        # 筛选管理 - 可执行和查看筛选
        Permission.SCREENING_READ,
        Permission.SCREENING_EXECUTE,
        # 用户管理 - 仅可查看和更新非管理员用户
        Permission.USER_READ,
        Permission.USER_UPDATE,
        # 报表统计 - 可查看报表
        Permission.REPORT_READ,
    },
    Role.RECRUITER: {
        # 简历管理 - 可读取和上传简历
        Permission.RESUME_READ,
        Permission.RESUME_CREATE,
        # 岗位管理 - 可查看岗位信息
        Permission.JOB_READ,
        # 筛选管理 - 可执行和查看筛选结果
        Permission.SCREENING_READ,
        Permission.SCREENING_EXECUTE,
    },
    Role.INTERVIEWER: {
        # 简历管理 - 可查看简历
        Permission.RESUME_READ,
        # 岗位管理 - 可查看岗位信息
        Permission.JOB_READ,
        # 筛选管理 - 可查看筛选结果
        Permission.SCREENING_READ,
    },
    Role.USER: {
        # 简历管理 - 可查看自己的简历
        Permission.RESUME_READ,
        # 岗位管理 - 可查看岗位信息
        Permission.JOB_READ,
    },
}


def get_role_permissions(role: Role) -> Set[Permission]:
    """获取角色的所有权限"""
    return ROLE_PERMISSIONS.get(role, set())


def check_permission(permission: Permission, current_user: dict = Depends(get_current_user)) -> bool:
    """检查用户是否有指定权限"""
    user_role = Role(current_user.get("role", Role.USER))
    user_permissions = get_role_permissions(user_role)
    
    return permission in user_permissions


def require_permission(permission: Permission):
    """要求指定权限的依赖项"""
    def _require_permission(current_user: dict) -> dict:
        if not check_permission(permission, current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"缺少所需权限: {permission.value}",
            )
        return current_user
    return _require_permission


def require_role(role: Role):
    """要求指定角色的依赖项"""
    def _require_role(current_user: dict) -> dict:
        user_role = Role(current_user.get("role", Role.USER))
        if user_role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要角色: {role.value}",
            )
        return current_user
    return _require_role


def require_any_role(*roles: Role):
    """要求任意一个角色的依赖项"""
    def _require_any_role(current_user: dict) -> dict:
        user_role = Role(current_user.get("role", Role.USER))
        if user_role not in roles:
            role_names = ", ".join([r.value for r in roles])
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"需要以下角色之一: {role_names}",
            )
        return current_user
    return _require_any_role
