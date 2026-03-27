"""支付服务 - 个人开发者简化版"""

import hashlib
import time
import qrcode
import base64
from io import BytesIO
from typing import Dict, Optional
from loguru import logger
from ..config import settings


class SimplePaymentService:
    """简化支付服务 - 适合个人开发者"""
    
    def __init__(self):
        self.payment_methods = ["wechat_qrcode", "alipay_qrcode"]
    
    def create_payment_qrcode(self, order_id: str, amount: float, description: str, payment_method: str) -> Dict:
        """生成支付二维码"""
        try:
            # 生成支付链接（实际中应该调用支付API）
            if payment_method == "wechat_qrcode":
                payment_url = self._generate_wechat_payment_url(order_id, amount, description)
            elif payment_method == "alipay_qrcode":
                payment_url = self._generate_alipay_payment_url(order_id, amount, description)
            else:
                return {"success": False, "error": "不支持的支付方式"}
            
            # 生成二维码
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(payment_url)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_str = base64.b64encode(buffered.getvalue()).decode()
            
            return {
                "success": True,
                "qrcode_data": f"data:image/png;base64,{img_str}",
                "payment_url": payment_url,
                "order_id": order_id,
                "amount": amount
            }
            
        except Exception as e:
            logger.error(f"生成支付二维码失败: {e}")
            return {"success": False, "error": str(e)}
    
    def _generate_wechat_payment_url(self, order_id: str, amount: float, description: str) -> str:
        """生成微信支付链接（简化版）"""
        # 实际应用中应该调用微信支付API
        # 这里返回一个示例URL，实际应该替换为真实的支付链接
        return f"weixin://wxpay/bizpayurl?order_id={order_id}&amount={amount}&description={description}"
    
    def _generate_alipay_payment_url(self, order_id: str, amount: float, description: str) -> str:
        """生成支付宝支付链接（简化版）"""
        # 实际应用中应该调用支付宝API
        return f"alipays://platformapi/startapp?appId=20000067&orderId={order_id}&amount={amount}&subject={description}"
    
    def verify_payment(self, order_id: str) -> Dict:
        """验证支付状态（模拟实现）"""
        # 在实际应用中，这里应该查询支付平台API或数据库
        # 模拟支付成功
        return {
            "success": True,
            "paid": True,
            "order_id": order_id,
            "paid_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
    
    def get_available_payment_methods(self) -> Dict:
        """获取可用的支付方式"""
        return {
            "methods": [
                {
                    "code": "wechat_qrcode",
                    "name": "微信扫码支付",
                    "description": "使用微信扫描二维码支付",
                    "icon": "wechat"
                },
                {
                    "code": "alipay_qrcode", 
                    "name": "支付宝扫码支付",
                    "description": "使用支付宝扫描二维码支付",
                    "icon": "alipay"
                }
            ]
        }