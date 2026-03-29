"""订阅配额管理服务

配额规则：
- 有公司的用户 → 配额按公司维度聚合（公司所有成员共享）
- 无公司的用户 → 配额按个人维度（保持原有逻辑）
- admin → 不受限制
"""

from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user import User, Company, Job, ScreeningResult
from ..models.payment import SubscriptionPlan, QuotaAddon
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


async def sum_addons(
    target_id: str, is_company: bool, db: AsyncSession
) -> dict[str, int]:
    """统计加量包总量（永久有效，不按月过滤）

    Args:
        target_id: 公司ID或用户ID
        is_company: 是否按公司维度
        db: 数据库会话

    Returns:
        {"resumes": 额外筛选数, "jobs": 额外岗位数}
    """
    if is_company:
        condition = QuotaAddon.company_id == target_id
    else:
        condition = QuotaAddon.user_id == target_id
    result = await db.execute(
        select(
            func.coalesce(func.sum(QuotaAddon.addon_resumes), 0),
            func.coalesce(func.sum(QuotaAddon.addon_jobs), 0),
        ).where(condition)
    )
    row = result.one()
    return {"resumes": int(row[0]), "jobs": int(row[1])}


async def _get_company_user_ids(company_id: str, db: AsyncSession) -> list[str]:
    """获取公司下所有用户ID列表"""
    result = await db.execute(
        select(User.id).where(User.company_id == company_id, User.is_active == True)
    )
    return [row[0] for row in result.all()]


async def count_monthly_screening(user_ids: list[str], db: AsyncSession) -> int:
    """统计当月筛选简历数量（支持多用户聚合）"""
    if not user_ids:
        return 0
    month_start = _get_month_start()
    result = await db.execute(
        select(func.count(ScreeningResult.id)).where(
            ScreeningResult.user_id.in_(user_ids),
            ScreeningResult.created_at >= month_start
        )
    )
    return result.scalar() or 0


async def count_monthly_jobs(user_ids: list[str], db: AsyncSession) -> int:
    """统计当月新增岗位数量（支持多用户聚合）"""
    if not user_ids:
        return 0
    month_start = _get_month_start()
    result = await db.execute(
        select(func.count(Job.job_id)).where(
            Job.user_id.in_(user_ids),
            Job.created_at >= month_start
        )
    )
    return result.scalar() or 0


async def sum_monthly_addons(
    target_id: str, is_company: bool, db: AsyncSession
) -> dict[str, int]:
    """统计加量包总量（永久有效，兼容旧接口名）

    Args:
        target_id: 公司ID或用户ID
        is_company: 是否按公司维度
        db: 数据库会话

    Returns:
        {"resumes": 额外筛选数, "jobs": 额外岗位数}
    """
    return await sum_addons(target_id, is_company, db)


async def _get_effective_plan(user: User, db: AsyncSession) -> tuple[str | None, dict]:
    """获取用户的有效套餐

    有公司则取公司套餐，无公司则取个人套餐。
    同时检查是否过期。

    Returns:
        (plan_id, plan_dict)
    """
    # 优先使用公司订阅
    if user.company_id:
        company_result = await db.execute(
            select(Company).where(Company.id == user.company_id)
        )
        company = company_result.scalar_one_or_none()
        if company and company.subscription_plan:
            # 检查公司订阅是否过期
            if (company.subscription_expires
                    and company.subscription_expires <= datetime.now(timezone.utc)):
                # 过期则降级
                company.subscription_plan = "free"
                company.subscription_expires = None
                await db.commit()
            plan_result = await db.execute(
                select(SubscriptionPlan).where(
                    SubscriptionPlan.id == company.subscription_plan
                )
            )
            plan = plan_result.scalar_one_or_none()
            if plan:
                return company.subscription_plan, {
                    "id": plan.id,
                    "name": plan.name,
                    "max_resumes": plan.max_resumes,
                    "max_jobs": plan.max_jobs,
                    "ai_screening": plan.ai_screening,
                }

    # 个人订阅
    plan_id = user.subscription_plan or "free"
    # 检查个人订阅是否过期
    if (plan_id != "free"
            and user.subscription_expires
            and user.subscription_expires <= datetime.now(timezone.utc)):
        user.subscription_plan = "free"
        user.subscription_expires = None
        plan_id = "free"
        await db.commit()
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    )
    plan = plan_result.scalar_one_or_none()
    if plan:
        return plan_id, {
            "id": plan.id,
            "name": plan.name,
            "max_resumes": plan.max_resumes,
            "max_jobs": plan.max_jobs,
            "ai_screening": plan.ai_screening,
        }

    return plan_id, {
        "id": plan_id,
        "name": "免费版",
        **FREE_PLAN_DEFAULTS,
        "ai_screening": True,
    }


async def get_user_plan(user: User, db: AsyncSession) -> dict:
    """获取用户当前套餐配额信息（兼容旧接口）"""
    _, plan = await _get_effective_plan(user, db)
    return plan


async def get_user_usage(user: User, db: AsyncSession) -> dict:
    """获取用户当月使用量

    有公司则聚合公司所有成员的使用量。
    """
    if user.company_id:
        user_ids = await _get_company_user_ids(user.company_id, db)
    else:
        user_ids = [user.id]

    screening_used = await count_monthly_screening(user_ids, db)
    jobs_used = await count_monthly_jobs(user_ids, db)

    # 加量包总量（永久有效）
    if user.company_id:
        addon = await sum_addons(user.company_id, is_company=True, db=db)
    else:
        addon = await sum_addons(user.id, is_company=False, db=db)

    return {
        "screening_used": screening_used,
        "jobs_used": jobs_used,
        "addon_resumes": addon["resumes"],
        "addon_jobs": addon["jobs"],
    }


async def get_subscription_info(user: User, db: AsyncSession) -> dict:
    """获取完整的订阅信息（用于前端展示）

    包含是否公司订阅、公司名称、计划详情、使用量等。
    """
    plan_id, plan = await _get_effective_plan(user, db)
    usage = await get_user_usage(user, db)

    info = {
        "subscription_plan": plan_id,
        "plan": plan,
        "usage": usage,
        "is_company_plan": False,
        "company_name": None,
    }

    if user.company_id:
        company_result = await db.execute(
            select(Company).where(Company.id == user.company_id)
        )
        company = company_result.scalar_one_or_none()
        if company and company.subscription_plan and company.subscription_plan != "free":
            info["is_company_plan"] = True
            info["company_name"] = company.name
            info["subscription_expires"] = (
                company.subscription_expires.isoformat()
                if company.subscription_expires else None
            )
            return info

    # 个人订阅
    info["subscription_expires"] = (
        user.subscription_expires.isoformat()
        if user.subscription_expires else None
    )
    return info


async def check_screening_quota(
    user: User, db: AsyncSession
) -> tuple[bool, str]:
    """检查筛选配额

    消费顺序：当前套餐配额优先，加量包配额在套餐用完后消耗。
    有公司：聚合公司所有成员的使用量。
    无公司：个人使用量。

    Returns:
        (是否允许, 错误信息) 允许时错误信息为空字符串
    """
    if user.role == "admin":
        return True, ""

    plan_id, plan = await _get_effective_plan(user, db)

    if not plan["ai_screening"]:
        return False, "当前套餐不支持 AI 筛选功能，请升级套餐"

    if user.company_id:
        user_ids = await _get_company_user_ids(user.company_id, db)
    else:
        user_ids = [user.id]

    screening_used = await count_monthly_screening(user_ids, db)

    # 获取加量包总量
    if user.company_id:
        addon = await sum_addons(user.company_id, is_company=True, db=db)
    else:
        addon = await sum_addons(user.id, is_company=False, db=db)

    plan_quota = plan["max_resumes"]
    addon_quota = addon["resumes"]

    # 消费顺序：套餐配额优先，加量包在套餐用完后消耗
    if screening_used < plan_quota:
        # 套餐配额充足
        return True, ""

    # 套餐已用完，检查加量包
    addon_used = screening_used - plan_quota
    if addon_used < addon_quota:
        # 加量包配额充足
        return True, ""

    # 全部用完
    scope = "公司" if user.company_id else "本月"
    addon_hint = f"（含加量包 +{addon_quota}）" if addon_quota > 0 else ""
    return False, (
        f"{scope}筛选配额已用完（套餐 {plan_quota} 份 + 加量包 {addon_quota} 份{addon_hint}），"
        f"请升级套餐或购买加量包"
    )


async def check_job_quota(
    user: User, db: AsyncSession
) -> tuple[bool, str]:
    """检查创建岗位配额

    消费顺序：当前套餐配额优先，加量包配额在套餐用完后消耗。
    有公司：聚合公司所有成员的使用量。
    无公司：个人使用量。

    Returns:
        (是否允许, 错误信息)
    """
    if user.role == "admin":
        return True, ""

    plan_id, plan = await _get_effective_plan(user, db)

    if user.company_id:
        user_ids = await _get_company_user_ids(user.company_id, db)
    else:
        user_ids = [user.id]

    jobs_used = await count_monthly_jobs(user_ids, db)

    # 获取加量包总量
    if user.company_id:
        addon = await sum_addons(user.company_id, is_company=True, db=db)
    else:
        addon = await sum_addons(user.id, is_company=False, db=db)

    plan_quota = plan["max_jobs"]
    addon_quota = addon["jobs"]

    # 消费顺序：套餐配额优先，加量包在套餐用完后消耗
    if jobs_used < plan_quota:
        return True, ""

    addon_used = jobs_used - plan_quota
    if addon_used < addon_quota:
        return True, ""

    scope = "公司" if user.company_id else "本月"
    addon_hint = f"（含加量包 +{addon_quota}）" if addon_quota > 0 else ""
    return False, (
        f"{scope}新增岗位配额已用完（套餐 {plan_quota} 个 + 加量包 {addon_quota} 个{addon_hint}），"
        f"请升级套餐或购买加量包"
    )
