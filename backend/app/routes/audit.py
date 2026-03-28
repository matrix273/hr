"""审计日志路由"""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import require_permission, Permission
from ..models.user import AuditLog

router = APIRouter(prefix="/api/audit-logs", tags=["审计日志"])


@router.get("")
async def get_audit_logs(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(10, ge=1, le=100, description="每页条数"),
    action: Optional[str] = Query(None, description="操作类型筛选"),
    target_type: Optional[str] = Query(None, description="目标类型筛选"),
    operator_name: Optional[str] = Query(None, description="操作人筛选"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
):
    """获取审计日志列表（仅管理员）"""
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))

    # 筛选条件
    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.target_type == target_type)
        count_query = count_query.where(AuditLog.target_type == target_type)
    if operator_name:
        query = query.where(AuditLog.operator_name == operator_name)
        count_query = count_query.where(AuditLog.operator_name == operator_name)
    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            or_(
                AuditLog.operator_name.ilike(like_pattern),
                AuditLog.detail.ilike(like_pattern),
                AuditLog.target_id.ilike(like_pattern),
            )
        )
        count_query = count_query.where(
            or_(
                AuditLog.operator_name.ilike(like_pattern),
                AuditLog.detail.ilike(like_pattern),
                AuditLog.target_id.ilike(like_pattern),
            )
        )
    if start_date:
        query = query.where(AuditLog.created_at >= f"{start_date} 00:00:00")
        count_query = count_query.where(AuditLog.created_at >= f"{start_date} 00:00:00")
    if end_date:
        query = query.where(AuditLog.created_at <= f"{end_date} 23:59:59")
        count_query = count_query.where(AuditLog.created_at <= f"{end_date} 23:59:59")

    # 总数
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # 分页查询，按创建时间倒序
    query = query.order_by(desc(AuditLog.created_at))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()

    # 格式化返回
    items = []
    for log in logs:
        detail = None
        if log.detail:
            try:
                detail = json.loads(log.detail)
            except (json.JSONDecodeError, TypeError):
                detail = log.detail

        items.append({
            "id": log.id,
            "operator_id": log.operator_id,
            "operator_name": log.operator_name,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "detail": detail,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/actions")
async def get_action_types(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
):
    """获取所有操作类型（用于筛选下拉框）"""
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    actions = [row[0] for row in result.all()]
    return {"actions": actions}
