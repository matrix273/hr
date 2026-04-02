"""支付路由 - 基于 YunGouOS 微信收银台支付"""

import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from ..auth.rbac import require_permission, Permission
from ..auth.jwt import get_current_user
from ..database import AsyncSessionLocal, get_db
from ..models.user import User, Company
from ..models.payment import PaymentOrder, SubscriptionPlan, QuotaAddon
from ..services.payment import YunGouOSService
from ..services.subscription import get_user_plan, get_subscription_info
from ..utils.logger import logger

router = APIRouter(prefix="/api/payment", tags=["payment"])

# 免费套餐兜底定义（仅保证 free 套餐存在）
_FREE_PLAN = {
    "id": "free",
    "name": "免费版",
    "description": "适合个人体验，基础功能免费使用",
    "price": 0,
    "duration_days": 36500,
    "max_resumes": 10,
    "max_jobs": 3,
    "ai_screening": True,
    "priority_support": False,
}


class PlanCreateRequest(BaseModel):
    """创建/更新套餐请求体"""
    id: str
    name: str
    description: Optional[str] = ""
    price: float = 0
    duration_days: int = 30
    max_resumes: int = 0
    max_jobs: int = 0
    ai_screening: bool = True
    priority_support: bool = False
    plan_type: str = "subscription"
    addon_resumes: int = 0
    addon_jobs: int = 0
    is_test: bool = False


async def init_default_plans():
    """确保免费套餐存在（其余套餐由管理员通过界面管理）"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == "free")
        )
        if result.scalar_one_or_none() is None:
            plan = SubscriptionPlan(**_FREE_PLAN)
            db.add(plan)
            await db.commit()
            logger.info("已初始化免费套餐")


async def _check_subscription_expiry(user: User, db: AsyncSession):
    """检查订阅是否到期，到期自动降级为免费版"""
    # 检查个人订阅到期
    if (user.subscription_plan != "free"
            and user.subscription_expires
            and user.subscription_expires <= datetime.now(timezone.utc)):
        user.subscription_plan = "free"
        user.subscription_expires = None

    # 检查公司订阅到期
    if user.company_id:
        company = await db.execute(
            select(Company).where(Company.id == user.company_id)
        )
        company = company.scalar_one_or_none()
        if company and company.subscription_plan != "free":
            if (company.subscription_expires
                    and company.subscription_expires <= datetime.now(timezone.utc)):
                company.subscription_plan = "free"
                company.subscription_expires = None
        await db.commit()


async def get_current_user_object(
    user_dict: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """获取当前用户的数据库对象（复用同一个 db session）"""
    result = await db.execute(select(User).where(User.username == user_dict["username"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 检查订阅到期，自动降级
    await _check_subscription_expiry(user, db)

    return user


@router.get("/plans", response_model=List[dict])
async def get_subscription_plans(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """获取订阅套餐列表（测试套餐仅管理员可见）"""
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True))
    plans = result.scalars().all()

    # 非管理员过滤掉测试套餐
    is_admin = False
    try:
        token = request.headers.get("authorization", "").replace("Bearer ", "")
        if token:
            from ..auth.jwt import verify_token
            payload = verify_token(token)
            permissions = payload.get("permissions", [])
            is_admin = "system:admin" in permissions
    except Exception:
        pass

    if not is_admin:
        plans = [p for p in plans if not p.is_test]

    return [plan.to_dict() for plan in plans]


# ========== 管理员：套餐管理接口 ==========


@router.get("/admin/plans", response_model=List[dict])
async def admin_get_plans(
    _current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """管理员获取所有套餐（含已停用）"""
    result = await db.execute(
        select(SubscriptionPlan).order_by(
            SubscriptionPlan.plan_type,
            SubscriptionPlan.price
        )
    )
    plans = result.scalars().all()
    return [plan.to_dict() for plan in plans]


@router.post("/admin/plans")
async def admin_create_plan(
    body: PlanCreateRequest,
    _current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """管理员创建套餐"""
    if not body.id:
        raise HTTPException(status_code=400, detail="套餐ID不能为空")

    existing = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == body.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"套餐ID '{body.id}' 已存在")

    plan = SubscriptionPlan(**body.model_dump())
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    logger.info(f"管理员创建套餐: {body.id} ({body.name})")
    return plan.to_dict()


@router.put("/admin/plans/{plan_id}")
async def admin_update_plan(
    plan_id: str,
    body: PlanCreateRequest,
    _current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """管理员更新套餐"""
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")

    # 免费套餐不允许修改核心字段
    if plan_id == "free":
        if body.price != 0:
            raise HTTPException(status_code=400, detail="免费套餐价格不允许修改")
        body.duration_days = 36500

    # 更新字段
    update_data = body.model_dump(exclude={"id"})
    for key, value in update_data.items():
        setattr(plan, key, value)

    await db.commit()
    await db.refresh(plan)
    logger.info(f"管理员更新套餐: {plan_id}")
    return plan.to_dict()


@router.delete("/admin/plans/{plan_id}")
async def admin_delete_plan(
    plan_id: str,
    _current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """管理员删除套餐（软删除：标记为停用）"""
    if plan_id == "free":
        raise HTTPException(status_code=400, detail="免费套餐不允许删除")

    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")

    plan.is_active = False
    await db.commit()
    logger.info(f"管理员停用套餐: {plan_id}")
    return {"message": f"套餐 '{plan.name}' 已停用"}


@router.put("/admin/plans/{plan_id}/activate")
async def admin_activate_plan(
    plan_id: str,
    _current_user: dict = Depends(require_permission(Permission.SYSTEM_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """管理员启用套餐"""
    result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id)
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")

    plan.is_active = True
    await db.commit()
    logger.info(f"管理员启用套餐: {plan_id}")
    return {"message": f"套餐 '{plan.name}' 已启用"}


@router.get("/methods")
async def get_payment_methods():
    """获取可用的支付方式"""
    payment_service = YunGouOSService()
    return payment_service.get_available_payment_methods()


@router.post("/create-qrcode")
async def create_payment_qrcode(
    plan_id: str,
    payment_method: str,
    quantity: int = 1,
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """创建支付订单"""
    # 校验购买数量
    if quantity < 1 or quantity > 12:
        raise HTTPException(status_code=400, detail="购买数量需在 1-12 之间")

    # 获取套餐信息
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")

    # 加量包不支持多数量购买
    if plan.plan_type == "addon" and quantity > 1:
        quantity = 1

    total_amount = plan.price * quantity

    # 加量包直接走支付流程（不支持免费）
    is_addon = plan.plan_type == "addon"
    
    # 免费套餐直接创建订单并确认
    if not is_addon and (plan.price == 0 or payment_method == "free"):
        order = PaymentOrder(
            user_id=current_user.id,
            amount=0,
            payment_method="free",
            product_type="subscription",
            product_id=plan_id,
            product_name=plan.name,
            status="paid"
        )
        db.add(order)

        # 更新订阅：有公司则更新公司订阅
        if current_user.company_id:
            company_result = await db.execute(
                select(Company).where(Company.id == current_user.company_id)
            )
            company = company_result.scalar_one_or_none()
            if company:
                company.subscription_plan = plan_id
                company.subscription_expires = None
        else:
            current_user.subscription_plan = plan_id
            current_user.subscription_expires = None

        await db.commit()
        await db.refresh(order)
        return {
            "order_id": order.order_id,
            "plan": plan.to_dict(),
            "status": "paid"
        }

    # 创建支付订单
    order = PaymentOrder(
        user_id=current_user.id,
        amount=total_amount,
        payment_method=payment_method,
        product_type="addon" if is_addon else "subscription",
        product_id=plan_id,
        product_name=plan.name if is_addon else f"{plan.name} x{quantity}个月"
    )
    
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    # 调用 YunGouOS 创建扫码支付
    payment_service = YunGouOSService()
    result = payment_service.create_native_pay(
        order_id=order.order_id,
        total_fee=total_amount,
        body=f"购买套餐: {plan.name} x{quantity}个月"
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "支付创建失败"))
    
    return {
        "order_id": order.order_id,
        "code_url": result["code_url"],
        "plan": plan.to_dict()
    }


@router.post("/verify/{order_id}")
async def verify_payment(
    order_id: str,
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """验证支付状态"""
    # 查询订单
    result = await db.execute(select(PaymentOrder).where(PaymentOrder.order_id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    
    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此订单")
    
    # 根据数据库中订单的实际状态返回
    is_paid = order.status == "paid"

    return {
        "order": order.to_dict(),
        "payment_status": {
            "success": True,
            "paid": is_paid,
            "order_id": order_id,
            "status": order.status
        }
    }


@router.post("/notify")
async def payment_notify(request: Request):
    """YunGouOS 支付回调通知（无需鉴权，由支付平台调用）"""
    try:
        form_data = await request.form()
        # FormData 值为 list，需转为单值字符串
        post_data = {k: v if isinstance(v, str) else v[0] for k, v in form_data.items()}
        logger.info(f"收到 YunGouOS 支付回调: {post_data}")
    except Exception as e:
        logger.error(f"解析回调数据失败: {e}")
        return PlainTextResponse("FAIL", status_code=200)

    # 验证签名
    payment_service = YunGouOSService()
    result = payment_service.verify_notify(post_data)

    if not result.get("success"):
        logger.warning(f"回调验证失败: {result.get('error')}")
        return PlainTextResponse("FAIL", status_code=200)

    out_trade_no = result["out_trade_no"]
    async with AsyncSessionLocal() as db:
        order_result = await db.execute(
            select(PaymentOrder).where(PaymentOrder.order_id == out_trade_no)
        )
        order = order_result.scalar_one_or_none()

        if not order:
            logger.warning(f"回调对应订单不存在: {out_trade_no}")
            return PlainTextResponse("FAIL", status_code=200)

        if order.status == "paid":
            logger.info(f"订单已处理过, 跳过: {out_trade_no}")
            return PlainTextResponse("SUCCESS", status_code=200)

        # 保存支付平台数据
        order.payment_data = {"pay_no": result.get("pay_no"), "raw": post_data}

        await _activate_subscription(order, db)
        logger.info(f"支付回调处理成功, 订单: {out_trade_no}, 金额: {result.get('money')}")

    return PlainTextResponse("SUCCESS", status_code=200)


async def _activate_subscription(order: PaymentOrder, db: AsyncSession):
    """
    激活订阅：将订单标记为已支付并更新订阅信息

    加量包类型会写入 quota_addons 表，永久有效。
    订阅类型会更新用户/公司的订阅套餐和到期时间。

    Args:
        order: 支付订单对象
        db: 数据库会话
    """
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)

    # 查询订单所属用户
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        logger.error(f"订单用户不存在: {order.user_id}")
        await db.commit()
        return

    # 获取套餐信息
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == order.product_id)
    )
    plan = plan_result.scalar_one_or_none()

    # 加量包：写入 QuotaAddon 表，永久有效
    if order.product_type == "addon":
        addon = QuotaAddon(
            order_id=order.order_id,
            user_id=user.id,
            company_id=user.company_id,
            addon_resumes=plan.addon_resumes if plan else 0,
            addon_jobs=plan.addon_jobs if plan else 0,
        )
        db.add(addon)
        await db.commit()
        await db.refresh(order)
        return

    # 订阅类型：更新订阅信息
    expires = None
    quantity = 1
    if plan and plan.duration_days > 0:
        # 从订单名称中解析购买月数（格式: "基础版 x3个月"）
        match = re.search(r"x(\d+)个月", order.product_name or "")
        if match:
            quantity = int(match.group(1))
        expires = datetime.now(timezone.utc) + timedelta(days=plan.duration_days * quantity)

    # 如果已有付费订阅，在原到期时间基础上续期
    if user.company_id:
        company_result = await db.execute(
            select(Company).where(Company.id == user.company_id)
        )
        company = company_result.scalar_one_or_none()
        if company:
            base = company.subscription_expires or datetime.now(timezone.utc)
            if base < datetime.now(timezone.utc):
                base = datetime.now(timezone.utc)
            company.subscription_plan = order.product_id
            company.subscription_expires = (
                base + timedelta(days=plan.duration_days * quantity)
                if plan else None
            )
    else:
        base = user.subscription_expires or datetime.now(timezone.utc)
        if base < datetime.now(timezone.utc):
            base = datetime.now(timezone.utc)
        user.subscription_plan = order.product_id
        user.subscription_expires = (
            base + timedelta(days=plan.duration_days * quantity)
            if plan else None
        )

    await db.commit()
    await db.refresh(order)


@router.post("/confirm/{order_id}")
async def confirm_payment(
    order_id: str,
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """手动确认支付（测试用，实际应由支付平台回调）"""
    result = await db.execute(select(PaymentOrder).where(PaymentOrder.order_id == order_id))
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")

    if order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问此订单")

    if order.status == "paid":
        return {"order": order.to_dict(), "message": "订单已支付"}

    await _activate_subscription(order, db)

    return {"order": order.to_dict(), "message": "支付确认成功"}


@router.get("/orders", response_model=List[dict])
async def get_user_orders(
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """获取用户支付订单"""
    result = await db.execute(
        select(PaymentOrder)
        .where(PaymentOrder.user_id == current_user.id)
        .order_by(PaymentOrder.created_at.desc())
    )
    orders = result.scalars().all()
    return [order.to_dict() for order in orders]


@router.get("/user-info")
async def get_user_payment_info(
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """获取用户支付信息（含公司订阅）"""
    info = await get_subscription_info(current_user, db)
    return {
        "balance": current_user.balance,
        "subscription_plan": info["subscription_plan"],
        "subscription_expires": info["subscription_expires"],
        "is_company_plan": info["is_company_plan"],
        "company_name": info["company_name"],
        "can_use_ai_screening": info["plan"].get("ai_screening", False),
        "plan": info["plan"],
        "usage": info["usage"],
    }