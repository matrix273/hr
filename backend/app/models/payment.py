"""支付模型"""

import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer, Float, JSON
from sqlalchemy.sql import func
from ..database import Base


class PaymentOrder(Base):
    """支付订单模型"""
    __tablename__ = "payment_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(50), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(50), nullable=False, index=True)
    amount = Column(Float, nullable=False, comment="支付金额")
    currency = Column(String(10), default="CNY", comment="货币类型")
    payment_method = Column(String(50), nullable=False, comment="支付方式: wechat, alipay, stripe")
    product_type = Column(String(50), nullable=False, comment="产品类型: subscription-订阅, credit-余额充值")
    product_id = Column(String(50), comment="产品ID")
    product_name = Column(String(255), nullable=False, comment="产品名称")
    status = Column(String(20), default="pending", comment="订单状态: pending-待支付, paid-已支付, failed-支付失败, cancelled-已取消")
    payment_data = Column(JSON, comment="支付平台返回的数据")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    paid_at = Column(DateTime(timezone=True), comment="支付完成时间")

    def to_dict(self):
        """转换为字典"""
        return {
            "order_id": self.order_id,
            "user_id": self.user_id,
            "amount": self.amount,
            "currency": self.currency,
            "payment_method": self.payment_method,
            "product_type": self.product_type,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "paid_at": self.paid_at.isoformat() if self.paid_at else None
        }


class SubscriptionPlan(Base):
    """订阅套餐模型"""
    __tablename__ = "subscription_plans"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False, comment="套餐名称")
    description = Column(Text, comment="套餐描述")
    price = Column(Float, nullable=False, comment="价格")
    duration_days = Column(Integer, nullable=False, comment="有效期（天）")
    max_resumes = Column(Integer, default=100, comment="最大简历数量")
    max_jobs = Column(Integer, default=10, comment="最大岗位数量")
    ai_screening = Column(Boolean, default=True, comment="是否包含AI筛选")
    priority_support = Column(Boolean, default=False, comment="是否优先支持")
    is_active = Column(Boolean, default=True, comment="是否激活")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "duration_days": self.duration_days,
            "max_resumes": self.max_resumes,
            "max_jobs": self.max_jobs,
            "ai_screening": self.ai_screening,
            "priority_support": self.priority_support,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }