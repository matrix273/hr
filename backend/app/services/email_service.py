"""邮件发送服务 - 基于 SMTP 异步发送邮件"""

import random
import string
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from email.header import Header
import redis
import os

from ..config import REDIS_HOST, REDIS_PORT, REDIS_DB
from ..utils.logger import logger

# 邮件配置（从环境变量读取）
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.qq.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "AI简历筛选系统")

# 验证码配置
CODE_LENGTH = 6
CODE_EXPIRE_SECONDS = 300  # 5分钟过期
SEND_INTERVAL_SECONDS = 60  # 同一邮箱60秒内不可重发

# Redis key 前缀
_PREFIX = "email_code:"


def _get_redis() -> redis.Redis:
    """获取 Redis 连接"""
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)


def _generate_code() -> str:
    """生成随机数字验证码"""
    return "".join(random.choices(string.digits, k=CODE_LENGTH))


def _build_email(to_addr: str, subject: str, html_body: str) -> MIMEMultipart:
    """构建邮件对象"""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = formataddr((str(Header(SMTP_FROM_NAME, "utf-8")), SMTP_USER))
    msg["To"] = to_addr
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    return msg


async def _send_email_async(to_addr: str, subject: str, html_body: str) -> bool:
    """异步发送邮件"""
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("SMTP 配置不完整，请检查 SMTP_USER 和 SMTP_PASSWORD 环境变量")
        return False

    msg = _build_email(to_addr, subject, html_body)

    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            use_tls=True,
            timeout=10,
        )
        logger.info(f"邮件发送成功: {to_addr}")
        return True
    except Exception as e:
        logger.error(f"邮件发送失败: {to_addr}, 错误: {e}")
        return False


async def send_verification_code(email: str, purpose: str = "register") -> dict:
    """
    发送邮箱验证码

    Args:
        email: 目标邮箱地址
        purpose: 验证码用途，可选值："register"（注册）、"reset_password"（重置密码）

    Returns:
        dict: {"success": True} 或 {"success": False, "detail": "原因"}
    """
    r = _get_redis()
    rate_limit_key = f"{_PREFIX}rate:{email}"

    # 检查发送频率限制
    remaining = r.ttl(rate_limit_key)
    if remaining > 0:
        return {"success": False, "detail": f"请{remaining}秒后再试"}

    # 生成验证码
    code = _generate_code()

    # 存储到 Redis，设置过期时间
    code_key = f"{_PREFIX}verify:{email}"
    r.setex(code_key, CODE_EXPIRE_SECONDS, code)

    # 设置发送频率限制
    r.setex(rate_limit_key, SEND_INTERVAL_SECONDS, "1")

    # 根据用途构建邮件内容
    if purpose == "reset_password":
        subject = "【AI简历筛选系统】重置密码验证码"
        action_text = "重置密码"
        description = "您正在重置 AI简历筛选系统 账号的密码，验证码为："
    elif purpose == "change_email":
        subject = "【AI简历筛选系统】修改邮箱验证码"
        action_text = "修改邮箱"
        description = "您正在修改 AI简历筛选系统 账号的邮箱地址，验证码为："
    else:
        subject = "【AI简历筛选系统】注册验证码"
        action_text = "注册账号"
        description = "您正在注册 AI简历筛选系统 账号，验证码为："

    html_body = f"""
    <div style="max-width: 480px; margin: 0 auto; font-family: Arial, sans-serif;
                background: #f9f9f9; border-radius: 8px; overflow: hidden;">
        <div style="background: #4f46e5; padding: 24px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">AI简历筛选系统</h1>
        </div>
        <div style="padding: 32px; background: white;">
            <p style="font-size: 16px; color: #333;">您好！</p>
            <p style="font-size: 16px; color: #333;">
                {description}
            </p>
            <div style="text-align: center; margin: 24px 0;">
                <span style="font-size: 36px; font-weight: bold; color: #4f46e5;
                             letter-spacing: 8px; background: #f0eeff;
                             padding: 12px 24px; border-radius: 8px;">
                    {code}
                </span>
            </div>
            <p style="font-size: 14px; color: #999;">
                验证码 <strong>{CODE_EXPIRE_SECONDS // 60}</strong> 分钟内有效，请勿泄露给他人。
            </p>
        </div>
        <div style="padding: 16px; text-align: center; background: #f9f9f9;">
            <p style="font-size: 12px; color: #ccc; margin: 0;">
                如非本人操作，请忽略此邮件。
            </p>
        </div>
    </div>
    """

    # 发送邮件
    sent = await _send_email_async(email, subject, html_body)

    if not sent:
        # 发送失败，清理 Redis 中的验证码
        r.delete(code_key)
        return {"success": False, "detail": "邮件发送失败，请稍后重试"}

    return {"success": True}


def verify_code(email: str, code: str) -> bool:
    """
    验证邮箱验证码

    Args:
        email: 邮箱地址
        code: 用户输入的验证码

    Returns:
        bool: 验证码是否正确
    """
    r = _get_redis()
    code_key = f"{_PREFIX}verify:{email}"
    stored_code = r.get(code_key)

    if not stored_code:
        return False

    if stored_code != code:
        return False

    # 验证成功后删除验证码（一次性使用）
    r.delete(code_key)
    return True
