"""支付路由 - 个人开发者简化版"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from ..auth.jwt import get_current_user
from ..database import get_db
from ..models.user import User
from ..models.payment import PaymentOrder, SubscriptionPlan
from ..services.payment import SimplePaymentService

router = APIRouter(prefix="/payment", tags=["payment"])


async def get_current_user_object(
    user_dict: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> User:
    """获取当前用户的数据库对象"""
    result = await db.execute(select(User).where(User.username == user_dict["username"]))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    return user


@router.get("/plans", response_model=List[dict])
async def get_subscription_plans(
    db: AsyncSession = Depends(get_db)
):
    """获取订阅套餐列表"""
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.is_active == True))
    plans = result.scalars().all()
    return [plan.to_dict() for plan in plans]


@router.get("/methods")
async def get_payment_methods():
    """获取可用的支付方式"""
    payment_service = SimplePaymentService()
    return payment_service.get_available_payment_methods()


@router.post("/create-qrcode")
async def create_payment_qrcode(
    plan_id: str,
    payment_method: str,
    current_user: User = Depends(get_current_user_object),
    db: AsyncSession = Depends(get_db)
):
    """创建支付二维码（简化版）"""
    # 获取套餐信息
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="套餐不存在")
    
    # 创建支付订单
    order = PaymentOrder(
        user_id=current_user.id,
        amount=plan.price,
        payment_method=payment_method,
        product_type="subscription",
        product_id=plan_id,
        product_name=plan.name
    )
    
    db.add(order)
    await db.commit()
    await db.refresh(order)
    
    # 生成支付二维码
    payment_service = SimplePaymentService()
    result = payment_service.create_payment_qrcode(
        order_id=order.order_id,
        amount=plan.price,
        description=f"购买套餐: {plan.name}",
        payment_method=payment_method
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "支付创建失败"))
    
    return {
        "order_id": order.order_id,
        "qrcode_data": result["qrcode_data"],
        "payment_url": result["payment_url"],
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
    
    # 验证支付状态
    payment_service = SimplePaymentService()
    payment_result = payment_service.verify_payment(order_id)
    
    if payment_result.get("paid"):
        # 更新订单状态
        order.status = "paid"
        
        # 更新用户订阅信息
        current_user.subscription_plan = order.product_id
        current_user.balance += order.amount
        
        await db.commit()
    
    return {
        "order": order.to_dict(),
        "payment_status": payment_result
    }


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
    current_user: User = Depends(get_current_user_object)
):
    """获取用户支付信息"""
    return {
        "balance": current_user.balance,
        "subscription_plan": current_user.subscription_plan,
        "subscription_expires": current_user.subscription_expires,
        "can_use_ai_screening": current_user.subscription_plan != "free"
    }