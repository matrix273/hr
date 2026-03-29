"""支付服务 - 基于 YunGouOS 微信收银台支付"""

import hashlib
import os
from typing import Dict
import httpx
from ..utils.logger import logger

# YunGouOS 配置
YUNGOUOS_MCH_ID = os.getenv("YUNGOUOS_MCH_ID", "")
YUNGOUOS_KEY = os.getenv("YUNGOUOS_KEY", "")
YUNGOUOS_NOTIFY_URL = os.getenv("YUNGOUOS_NOTIFY_URL", "")

# YunGouOS API 地址
WXPAY_CASHIER_URL = "https://api.pay.yungouos.com/api/pay/wxpay/cashierPay"


def _remove_empty(params: dict) -> dict:
    """去除字典中的空值"""
    return {k: v for k, v in params.items() if v is not None and v != ""}


def _key_sort(params: dict) -> dict:
    """按字典键名排序"""
    return dict(sorted(params.items()))


def _get_sign(params_dict: dict, key: str) -> str:
    """
    生成支付签名

    Args:
        params_dict: 需要签名的参数字典
        key: 商户密钥

    Returns:
        大写 MD5 签名字符串
    """
    params_dict = _remove_empty(params_dict)
    params_dict.pop("sign", None)
    params_dict = _key_sort(params_dict)
    params_str = "&".join(
        f"{k}={params_dict[k]}" for k in params_dict.keys()
    ) + "&key=" + key
    return hashlib.md5(params_str.encode("utf-8")).hexdigest().upper()


def _check_notify_sign(post_data: dict, key: str) -> bool:
    """
    验证回调签名

    Args:
        post_data: 回调 POST 参数
        key: 商户密钥

    Returns:
        签名是否正确
    """
    sign = post_data.get("sign", "")
    if not sign:
        return False
    # 只有文档中标注"是"的必传参数才参与签名
    params_dict = {
        "code": post_data.get("code"),
        "money": post_data.get("money"),
        "mchId": post_data.get("mchId"),
        "orderNo": post_data.get("orderNo"),
        "outTradeNo": post_data.get("outTradeNo"),
        "payNo": post_data.get("payNo"),
    }
    # 调试：计算签名并记录，便于排查签名不一致问题
    cleaned = _remove_empty(params_dict)
    sorted_params = _key_sort(cleaned)
    sign_str = "&".join(f"{k}={sorted_params[k]}" for k in sorted_params) + f"&key={key}"
    computed_sign = hashlib.md5(sign_str.encode("utf-8")).hexdigest().upper()
    logger.info(f"签名调试 | 待签名字符串: {sign_str}")
    logger.info(f"签名调试 | 计算签名: {computed_sign} | 收到签名: {sign}")
    return computed_sign == sign


class YunGouOSService:
    """YunGouOS 聚合支付服务"""

    def __init__(self):
        if not YUNGOUOS_MCH_ID or not YUNGOUOS_KEY:
            logger.warning("YunGouOS 未配置 YUNGOUOS_MCH_ID 或 YUNGOUOS_KEY")

    def create_cashier_pay(
        self,
        order_id: str,
        total_fee: float,
        body: str
    ) -> Dict:
        """
        发起微信收银台支付

        Args:
            order_id: 商户订单号
            total_fee: 金额（元）
            body: 商品描述

        Returns:
            dict: {"success": True, "pay_url": "..."} 或 {"success": False, "error": "..."}
        """
        try:
            if not YUNGOUOS_MCH_ID or not YUNGOUOS_KEY:
                return {"success": False, "error": "支付未配置，请联系管理员"}

            params_dict = {
                "mch_id": YUNGOUOS_MCH_ID,
                "out_trade_no": order_id,
                "total_fee": str(total_fee),
                "body": body,
            }

            # 参与签名的参数生成签名
            sign = _get_sign(params_dict, YUNGOUOS_KEY)
            params_dict["sign"] = sign

            # 不参与签名的参数
            if YUNGOUOS_NOTIFY_URL:
                params_dict["notify_url"] = YUNGOUOS_NOTIFY_URL

            # 发起请求
            resp = httpx.post(WXPAY_CASHIER_URL, data=params_dict, timeout=10)
            logger.info(f"YunGouOS 响应状态码: {resp.status_code}, 内容: {resp.text[:500]}")
            ret = resp.json()

            # API 可能返回非 dict（如错误时返回纯文本）
            if not isinstance(ret, dict):
                logger.error(f"YunGouOS 返回非 JSON 对象: {resp.text[:500]}")
                return {"success": False, "error": f"支付平台返回异常: {str(ret)[:200]}"}

            if ret.get("code") != 0:
                logger.error(f"YunGouOS 创建支付失败: {ret.get('msg')}")
                return {"success": False, "error": ret.get("msg", "支付创建失败")}

            data = ret.get("data", "")
            # data 可能直接是 URL 字符串，也可能是包含 pay_url 的字典
            if isinstance(data, str) and data.startswith("http"):
                pay_url = data
            elif isinstance(data, dict):
                pay_url = data.get("pay_url", data.get("code_url", ""))
            else:
                pay_url = ""
            if not pay_url:
                logger.error(f"YunGouOS 返回数据中无 pay_url: {data}")
                return {"success": False, "error": "支付平台未返回支付链接"}

            return {
                "success": True,
                "pay_url": pay_url,
                "order_id": order_id,
                "amount": total_fee,
            }

        except httpx.TimeoutException:
            logger.error("YunGouOS 请求超时")
            return {"success": False, "error": "支付服务超时，请稍后重试"}
        except Exception as e:
            logger.error(f"YunGouOS 创建支付异常: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def verify_notify(post_data: dict) -> Dict:
        """
        验证回调通知并提取关键信息

        Args:
            post_data: 回调 POST 参数

        Returns:
            dict: {"success": True, "out_trade_no": "...", "money": "0.01"}
                  或 {"success": False, "error": "..."}
        """
        try:
            if not _check_notify_sign(post_data, YUNGOUOS_KEY):
                logger.warning(f"YunGouOS 回调签名验证失败: {post_data}")
                return {"success": False, "error": "签名验证失败"}

            code = post_data.get("code")
            # code=1 支付成功，code=0 支付失败
            if str(code) != "1":
                logger.warning(f"YunGouOS 回调支付失败, code={code}")
                return {"success": False, "error": f"支付失败, code={code}"}

            return {
                "success": True,
                "out_trade_no": post_data.get("outTradeNo", ""),
                "pay_no": post_data.get("payNo", ""),
                "money": post_data.get("money", ""),
                "mch_id": post_data.get("mchId", ""),
            }
        except Exception as e:
            logger.error(f"YunGouOS 回调处理异常: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_available_payment_methods() -> Dict:
        """获取可用的支付方式"""
        return {
            "methods": [
                {
                    "code": "wechat_qrcode",
                    "name": "微信支付",
                    "description": "微信收银台扫码支付",
                    "icon": "wechat",
                },
            ]
        }
