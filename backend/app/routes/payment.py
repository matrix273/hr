"""支付路由 - 基于 YunGouOS 微信收银台支付"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..auth.jwt import get_current_user
from ..database import AsyncSessionLocal, get_db
from ..models.user import User, Company
from ..models.payment import PaymentOrder, SubscriptionPlan
from ..services.payment import YunGouOSService
from ..services.subscription import get_user_plan, get_subscription_info
from ..utils.logger import logger

router = APIRouter(prefix="/api/payment", tags=["payment"])

# 默认套餐定义
DEFAULT_PLANS = [
    {
        "id": "free",
        "name": "免费版",
        "description": "适合个人体验，基础功能免费使用",
        "price": 0,
        "duration_days": 36500,
        "max_resumes": 10,
        "max_jobs": 3,
        "ai_screening": True,
        "priority_support": False,
    },
    {
        "id": "basic",
        "name": "基础版",
        "description": "适合小型团队，满足日常招聘需求",
        "price": 99,
        "duration_days": 30,
        "max_resumes": 100,
        "max_jobs": 10,
        "ai_screening": True,
        "priority_support": False,
    },
    {
        "id": "pro",
        "name": "专业版",
        "description": "适合中型企业，高效批量处理简历",
        "price": 299,
        "duration_days": 30,
        "max_resumes": 500,
        "max_jobs": 50,
        "ai_screening": True,
        "priority_support": True,
    },
    {
        "id": "test",
        "name": "测试套餐",
        "description": "仅管理员可见，用于测试支付流程",
        "price": 0.01,
        "duration_days": 1,
        "max_resumes": 10,
        "max_jobs": 3,
        "ai_screening": True,
        "priority_support": False,
        "is_test": True,
    },
]


async def init_default_plans():
    """初始化默认套餐数据（数据库为空时自动填充）"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SubscriptionPlan))
        existing = result.scalars().all()

        if not existing:
            for plan_data in DEFAULT_PLANS:
                plan = SubscriptionPlan(**plan_data)
                db.add(plan)
            await db.commit()
            logger.info(f"已初始化 {len(DEFAULT_PLANS)} 个默认套餐")


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
    
    total_amount = plan.price * quantity
    
    # 免费套餐直接创建订单并确认
    if plan.price == 0 or payment_method == "free":
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
        product_type="subscription",
        product_id=plan_id,
        product_name=f"{plan.name} x{quantity}个月"
    )
    
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    # 调用 YunGouOS 创建收银台支付
    payment_service = YunGouOSService()
    result = payment_service.create_cashier_pay(
        order_id=order.order_id,
        total_fee=total_amount,
        body=f"购买套餐: {plan.name} x{quantity}个月"
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "支付创建失败"))
    
    return {
        "order_id": order.order_id,
        "pay_url": result["pay_url"],
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
        post_data = dict(form_data)
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

    Args:
        order: 支付订单对象
        db: 数据库会话
    """
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)

    # 根据套餐有效期设置到期时间
    plan_result = await db.execute(
        select(SubscriptionPlan).where(SubscriptionPlan.id == order.product_id)
    )
    plan = plan_result.scalar_one_or_none()
    expires = None
    if plan and plan.duration_days > 0:
        expires = datetime.now(timezone.utc) + timedelta(days=plan.duration_days)

    # 查询订单所属用户
    user_result = await db.execute(select(User).where(User.id == order.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        logger.error(f"订单用户不存在: {order.user_id}")
        await db.commit()
        return

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
            company.subscription_expires = base + timedelta(days=plan.duration_days) if plan else None
    else:
        base = user.subscription_expires or datetime.now(timezone.utc)
        if base < datetime.now(timezone.utc):
            base = datetime.now(timezone.utc)
        user.subscription_plan = order.product_id
        user.subscription_expires = base + timedelta(days=plan.duration_days) if plan else None

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