"""订阅配额管理服务"""

from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User, Job, ScreeningResult
from ..models.payment import SubscriptionPlan
from ..utils.logger import logger


# 免费套餐默认配额（兜底，防止数据库查询失败）
FREE_PLAN_DEFAULTS = {
    "max_resumes": 10,
    "max_jobs": 3,
}


def _get_month_start() -> datetime:
    """获取当前月份起始时间（UTC）"""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def count_monthly_screening(user_id: str, db: AsyncSession) -> int:
    """统计用户当月筛选简历数量"""
    month_start = _get_month_start()
    result = await db.execute(
        select(func.count(ScreeningResult.id)).where(
            ScreeningResult.user_id == user_id,
            ScreeningResult.created_at >= month_start
        )
    )
    return result.scalar() or 0


async def count_monthly_jobs(user_id: str, db: AsyncSession) -> int:
    """统计用户当月新增岗位数量"""
    month_start = _get_month_start()
    result = await db.execute(
        select(func.count(Job.job_id)).where(
            Job.user_id == user_id,
            Job.created_at >= month_start
        )
    )
    return result.scalar() or 0


async def get_user_plan(user: User, db: AsyncSession) -> dict:
    """获取用户当前套餐配额信息"""
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == user.subscription_plan)
    )
    plan = result.scalar_one_or_none()

    if plan:
        return {
            "id": plan.id,
            "name": plan.name,
            "max_resumes": plan.max_resumes,
            "max_jobs": plan.max_jobs,
            "ai_screening": plan.ai_screening,
        }

    return {
        "id": user.subscription_plan or "free",
        "name": "免费版",
        **FREE_PLAN_DEFAULTS,
        "ai_screening": True,
    }


async def get_user_usage(user_id: str, db: AsyncSession) -> dict:
    """获取用户当月使用量"""
    screening_used = await count_monthly_screening(user_id, db)
    jobs_used = await count_monthly_jobs(user_id, db)
    return {
        "screening_used": screening_used,
        "jobs_used": jobs_used,
    }


async def check_screening_quota(
    user: User, db: AsyncSession
) -> tuple[bool, str]:
    """检查用户筛选配额

    配额基于本月成功完成 AI 筛选的简历总数（ScreeningResult 记录数），
    而非请求的 top_k 值，因为 top_k 可能只筛选出部分结果或全部失败。

    Args:
        user: 用户对象
        db: 数据库会话

    Returns:
        (是否允许, 错误信息) 允许时错误信息为空字符串
    """
    # admin 和 manager 不受限制
    if user.role in ("admin", "manager"):
        return True, ""

    plan = await get_user_plan(user, db)

    if not plan["ai_screening"]:
        return False, "当前套餐不支持 AI 筛选功能，请升级套餐"

    screening_used = await count_monthly_screening(user.id, db)
    remaining = plan["max_resumes"] - screening_used

    if remaining <= 0:
        return False, (
            f"本月筛选配额已用完（{plan['max_resumes']}份/月），"
            f"请升级套餐"
        )

    return True, ""


async def check_job_quota(
    user: User, db: AsyncSession
) -> tuple[bool, str]:
    """检查用户创建岗位配额

    Args:
        user: 用户对象
        db: 数据库会话

    Returns:
        (是否允许, 错误信息)
    """
    # admin 和 manager 不受限制
    if user.role in ("admin", "manager"):
        return True, ""

    plan = await get_user_plan(user, db)
    jobs_used = await count_monthly_jobs(user.id, db)
    remaining = plan["max_jobs"] - jobs_used

    if remaining <= 0:
        return False, (
            f"本月新增岗位配额已用完（{plan['max_jobs']}个/月），"
            f"请升级套餐"
        )

    return True, ""
