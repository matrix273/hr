"""消息管理路由 - 联系表单/用户反馈"""

import asyncio
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..auth.rbac import check_permission, Permission
from ..auth.jwt import get_current_active_user
from ..database import get_db
from ..models.user import Contact
from ..utils.logger import logger

router = APIRouter(prefix="/api/messages", tags=["Messages"])


class MessageCreateRequest(BaseModel):
    """提交消息请求"""
    name: str
    email: EmailStr
    message: str


class MessageResponse(BaseModel):
    """消息响应"""
    id: int
    name: str
    email: str
    message: str
    status: str
    created_at: Optional[str] = None


class MessageReplyRequest(BaseModel):
    """回复消息请求"""
    reply_content: str


@router.post("", status_code=status.HTTP_200_OK)
async def submit_message(
    message_data: MessageCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """提交消息给管理员（无需认证）"""
    logger.info(f"收到消息: 姓名={message_data.name}, 邮箱={message_data.email}, 留言={message_data.message[:50]}...")

    new_contact = Contact(
        name=message_data.name,
        email=message_data.email,
        message=message_data.message,
        status="pending"
    )
    db.add(new_contact)
    await db.commit()
    await db.refresh(new_contact)

    logger.info(f"消息已保存: ID={new_contact.id}")

    # 异步发送邮件通知管理员
    from ..services.email_service import _send_email_async
    admin_email = os.getenv("ADMIN_EMAIL", "")

    async def _notify_admin():
        if not admin_email:
            logger.info("未配置 ADMIN_EMAIL，跳过邮件通知")
            return
        subject = f"【用户反馈】{message_data.name} 提交了新消息"
        html_body = f"""
        <div style="max-width: 480px; margin: 0 auto; font-family: Arial, sans-serif;
                    background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <div style="background: #4f46e5; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">AI简历筛选系统 - 用户反馈</h1>
            </div>
            <div style="padding: 24px; background: white;">
                <p><strong>联系人：</strong>{message_data.name}</p>
                <p><strong>邮箱：</strong><a href="mailto:{message_data.email}">{message_data.email}</a></p>
                <p><strong>时间：</strong>{new_contact.created_at.strftime('%Y-%m-%d %H:%M:%S') if new_contact.created_at else '-'}</p>
                <div style="margin-top: 16px; padding: 16px; background: #f5f5f5;
                            border-radius: 6px; border-left: 4px solid #4f46e5;">
                    <p style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                        {message_data.message}
                    </p>
                </div>
            </div>
        </div>
        """
        await _send_email_async(admin_email, subject, html_body)

    asyncio.create_task(_notify_admin())

    return {
        "success": True,
        "message": "感谢您的留言，我们会尽快与您联系！"
    }


@router.get("", response_model=List[MessageResponse])
async def list_messages(
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """获取消息列表（需要系统管理权限）"""
    if not check_permission(Permission.SYSTEM_ADMIN, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SYSTEM_ADMIN.value}"
        )

    result = await db.execute(select(Contact).order_by(Contact.created_at.desc()))
    contacts = result.scalars().all()

    return [
        MessageResponse(
            id=c.id,
            name=c.name,
            email=c.email,
            message=c.message,
            status=c.status,
            created_at=c.created_at.isoformat() if c.created_at else None
        )
        for c in contacts
    ]


@router.post("/{message_id}/reply")
async def reply_message(
    message_id: int,
    reply_data: MessageReplyRequest,
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """管理员通过邮件回复用户反馈（需要系统管理权限）"""
    if not check_permission(Permission.SYSTEM_ADMIN, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SYSTEM_ADMIN.value}"
        )

    if not reply_data.reply_content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="回复内容不能为空"
        )

    # 查询联系记录
    result = await db.execute(select(Contact).where(Contact.id == message_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消息记录不存在"
        )

    # 异步发送回复邮件
    import os
    from ..services.email_service import _send_email_async
    admin_email = os.getenv("ADMIN_EMAIL", "")
    reply_content = reply_data.reply_content.strip()

    async def _send_reply():
        if not admin_email:
            logger.error("未配置 ADMIN_EMAIL，无法发送回复邮件")
            return False

        created_at = contact.created_at.strftime('%Y-%m-%d %H:%M:%S') if contact.created_at else '-'
        subject = f"【回复】关于您的反馈 - AI简历筛选系统"
        html_body = f"""
        <div style="max-width: 480px; margin: 0 auto; font-family: Arial, sans-serif;
                    background: #f9f9f9; border-radius: 8px; overflow: hidden;">
            <div style="background: #4f46e5; padding: 24px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 22px;">AI简历筛选系统 - 回复通知</h1>
            </div>
            <div style="padding: 24px; background: white;">
                <p>尊敬的 <strong>{contact.name}</strong>，您好！</p>
                <p style="color: #666; margin-bottom: 16px;">以下是您之前提交的反馈内容：</p>
                <div style="padding: 16px; background: #f5f5f5; border-radius: 6px;
                            border-left: 4px solid #e5e7eb; margin-bottom: 20px;">
                    <p style="margin: 0 0 8px; color: #999; font-size: 13px;">
                        提交时间：{created_at}
                    </p>
                    <p style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                        {contact.message}
                    </p>
                </div>
                <p style="color: #666; margin-bottom: 12px;">管理员回复：</p>
                <div style="padding: 16px; background: #f0eeff; border-radius: 6px;
                            border-left: 4px solid #4f46e5;">
                    <p style="margin: 0; white-space: pre-wrap; word-break: break-all;">
                        {reply_content}
                    </p>
                </div>
            </div>
            <div style="padding: 16px; text-align: center; background: #f9f9f9;">
                <p style="font-size: 12px; color: #ccc; margin: 0;">
                    此邮件由 AI简历筛选系统 自动发送，请勿直接回复。
                </p>
            </div>
        </div>
        """
        return await _send_email_async(contact.email, subject, html_body)

    sent = await _send_reply()
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="邮件发送失败，请检查邮箱配置后重试"
        )

    # 标记为已处理
    contact.status = "processed"
    await db.commit()

    logger.info(f"回复消息: ID={message_id}, 回复人: {current_user['username']}")
    return {"success": True, "message": "回复邮件已发送"}


@router.put("/{message_id}")
async def update_message_status(
    message_id: int,
    status: str = "processed",
    current_user: dict = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """更新消息状态（需要系统管理权限）"""
    if not check_permission(Permission.SYSTEM_ADMIN, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少所需权限: {Permission.SYSTEM_ADMIN.value}"
        )

    result = await db.execute(select(Contact).where(Contact.id == message_id))
    contact = result.scalar_one_or_none()

    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="消息记录不存在"
        )

    contact.status = status
    await db.commit()

    logger.info(f"更新消息状态: ID={message_id}, 状态={status}, 操作者: {current_user['username']}")

    return {"success": True, "message": "状态已更新"}
