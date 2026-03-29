import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Card, Button, Badge, Space, Spin, Empty, Typography, Tag,
    InputNumber, Tooltip, Divider, Modal
} from 'antd';
import {
    CheckCircleOutlined, LoadingOutlined,
    ClockCircleOutlined, AppstoreOutlined, FileTextOutlined,
    PlusCircleOutlined, AlipayCircleOutlined,
    WechatOutlined, CrownOutlined, CloseCircleOutlined
} from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/api';

const { Title, Text, Paragraph } = Typography;

/** 支付方式图标映射 */
const METHOD_ICON_MAP = {
    alipay_qrcode: <AlipayCircleOutlined style={{ fontSize: 32, color: '#1677ff' }} />,
    wechat_qrcode: <WechatOutlined style={{ fontSize: 32, color: '#07c160' }} />,
    bank: <CreditCardOutlined style={{ fontSize: 32, color: '#faad14' }} />,
    default: <QrcodeOutlined style={{ fontSize: 32, color: '#8c8c8c' }} />,
};

/** 支付方式背景色 */
const METHOD_BG_MAP = {
    alipay_qrcode: 'linear-gradient(135deg, #e6f4ff 0%, #bae0ff 100%)',
    wechat_qrcode: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
    bank: 'linear-gradient(135deg, #fffbe6 0%, #fff1b8 100%)',
    default: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
};

const PaymentPage = () => {
    const [plans, setPlans] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [orderId, setOrderId] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [userInfo, setUserInfo] = useState(null);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('plans');
    const pollTimerRef = useRef(null);

    const API_BASE = getApiBaseUrl();
    const TOKEN = localStorage.getItem('token');

    const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    const fetchPlans = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/plans`, { headers });
            const data = await response.json();
            setPlans(data);
        } catch (error) {
            console.error('获取套餐失败:', error);
        }
    };

    const fetchPaymentMethods = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/methods`);
            const data = await response.json();
            setPaymentMethods(data.methods);
        } catch (error) {
            console.error('获取支付方式失败:', error);
        }
    };

    const fetchUserInfo = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/user-info`, { headers });
            const data = await response.json();
            setUserInfo(data);
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
    };

    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/orders`, { headers });
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('获取订单失败:', error);
        }
    };

    const activateFreePlan = async (plan) => {
        if (userInfo?.subscription_plan === plan.id) return;
        try {
            await fetch(
                `${API_BASE}/payment/create-qrcode?plan_id=${plan.id}&payment_method=free`,
                { method: 'POST', headers }
            );
            await fetchUserInfo();
        } catch (error) {
            console.error('激活免费套餐失败:', error);
        }
    };

    const createPayment = async () => {
        if (!selectedPlan || !selectedMethod) {
            alert('请选择套餐和支付方式');
            return;
        }

        try {
            setPaymentStatus('processing');
            const url = `${API_BASE}/payment/create-qrcode?plan_id=${selectedPlan.id}&payment_method=${selectedMethod.code}&quantity=${quantity}`;
            const response = await fetch(url, { method: 'POST', headers });
            const data = await response.json();

            if (response.ok) {
                setOrderId(data.order_id);
                // 跳转到 YunGouOS 收银台支付页面
                window.open(data.pay_url, '_blank');
                startPolling(data.order_id);
            } else {
                setPaymentStatus('failed');
                setPaymentStatus('idle');
                alert(data.detail || '创建支付失败');
            }
        } catch (error) {
            setPaymentStatus('idle');
            console.error('创建支付失败:', error);
            alert('创建支付失败');
        }
    };

    const startPolling = (oid) => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/payment/verify/${oid}`, {
                    method: 'POST', headers
                });
                const data = await response.json();
                if (data.payment_status?.paid) {
                    clearInterval(pollTimerRef.current);
                    pollTimerRef.current = null;
                    setPaymentStatus('success');
                    await fetchUserInfo();
                    await fetchOrders();
                }
            } catch (error) {
                console.error('验证支付失败:', error);
            }
        }, 3000);
    };

    const cancelPayment = () => {
        if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
        setOrderId(null);
        setPaymentStatus('idle');
    };

    const verifyPayment = async () => {
        if (!orderId) return;
        try {
            const response = await fetch(`${API_BASE}/payment/verify/${orderId}`, {
                method: 'POST', headers
            });
            const data = await response.json();
            if (data.payment_status?.paid) {
                setPaymentStatus('success');
                await fetchUserInfo();
                await fetchOrders();
                alert('支付验证成功！');
            } else {
                alert('支付未完成，请继续扫码支付');
            }
        } catch (error) {
            console.error('验证支付失败:', error);
        }
    };

    useEffect(() => {
        fetchPlans();
        fetchPaymentMethods();
        fetchUserInfo();
        fetchOrders();
    }, []);

    const resetPayment = () => {
        cancelPayment();
        setSelectedPlan(null);
        setSelectedMethod(null);
        setQuantity(1);
    };

    // 组件卸载时清除轮询
    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        };
    }, []);

    const planNameMap = {
        free: '免费版', basic: '基础版',
        professional: '专业版', enterprise: '企业版',
        pro: '专业版'
    };

    const currentPlanDetail = useMemo(() => {
        if (!userInfo?.subscription_plan || !plans.length) return null;
        return plans.find(p => p.id === userInfo.subscription_plan);
    }, [userInfo, plans]);

    /** 计算总价 */
    const totalPrice = useMemo(() => {
        if (!selectedPlan) return 0;
        return selectedPlan.price * quantity;
    }, [selectedPlan, quantity]);

    /** 折扣提醒 */
    const discountHint = useMemo(() => {
        if (!selectedPlan || selectedPlan.price === 0) return null;
        const unit = selectedPlan.price;
        if (quantity >= 12) return { months: 12, saving: unit * 12, label: '年付' };
        if (quantity >= 6) return { months: 6, saving: 0, label: '半年付' };
        if (quantity >= 3) return { months: 3, saving: 0, label: '季付' };
        return null;
    }, [selectedPlan, quantity]);

    const getStatusBadge = (status) => {
        const statusMap = {
            'pending': { text: '待支付', color: 'gold' },
            'paid': { text: '已支付', color: 'green' },
            'failed': { text: '支付失败', color: 'red' },
            'cancelled': { text: '已取消', color: 'default' }
        };
        const s = statusMap[status] || { text: status, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <Title level={2} style={{ marginBottom: '24px' }}>
                <CrownOutlined style={{ color: '#faad14', marginRight: 8 }} />
                会员订阅
            </Title>

            {/* 当前套餐概览 */}
            <Card style={{ marginBottom: '24px' }}>
                <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', flexWrap: 'wrap', gap: 16
                }}>
                    <div>
                        <Text type="secondary">当前套餐</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: '4px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>
                                {planNameMap[userInfo?.subscription_plan] || '未知'}
                            </span>
                            {userInfo?.is_company_plan && (
                                <Tag color="blue">{userInfo.company_name}（公司订阅）</Tag>
                            )}
                        </div>
                        {currentPlanDetail && (
                            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileTextOutlined style={{ color: '#4f46e5' }} />
                                    <Text type="secondary">
                                        筛选简历 <Text strong>{userInfo?.usage?.screening_used ?? 0}</Text> / <Text strong>{currentPlanDetail.max_resumes}</Text> 份/月
                                        {userInfo?.is_company_plan && '（公司合计）'}
                                    </Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <PlusCircleOutlined style={{ color: '#4f46e5' }} />
                                    <Text type="secondary">
                                        新增岗位 <Text strong>{userInfo?.usage?.jobs_used ?? 0}</Text> / <Text strong>{currentPlanDetail.max_jobs}</Text> 个/月
                                        {userInfo?.is_company_plan && '（公司合计）'}
                                    </Text>
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                            {userInfo?.is_company_plan
                                ? '公司所有成员共享配额，由公司管理员统一购买套餐'
                                : '筛选简历：AI 每次筛选的 Top K 份简历数量按月累计'}
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <Text type="secondary">订阅到期</Text>
                        <div style={{ fontSize: '14px', marginTop: '4px' }}>
                            {userInfo?.subscription_expires
                                ? new Date(userInfo.subscription_expires).toLocaleDateString()
                                : '永久有效'}
                        </div>
                    </div>
                </div>
            </Card>

            <Space style={{ marginBottom: '24px' }}>
                <Button
                    type={activeTab === 'plans' ? 'primary' : 'default'}
                    onClick={() => setActiveTab('plans')}
                    icon={<AppstoreOutlined />}
                >
                    套餐订阅
                </Button>
                <Button
                    type={activeTab === 'orders' ? 'primary' : 'default'}
                    onClick={() => setActiveTab('orders')}
                    icon={<ClockCircleOutlined />}
                >
                    订单记录
                </Button>
            </Space>

            {activeTab === 'plans' ? (
                <>
                    {/* 套餐卡片 */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '16px', marginBottom: '24px'
                    }}>
                        {plans.map((plan) => {
                            const isCurrent = userInfo?.subscription_plan === plan.id;
                            const isSelected = selectedPlan?.id === plan.id;
                            return (
                                <Card
                                    key={plan.id}
                                    hoverable
                                    style={{
                                        cursor: 'pointer',
                                        border: isSelected
                                            ? '2px solid #1890ff'
                                            : isCurrent
                                                ? '2px solid #52c41a'
                                                : '1px solid #f0f0f0',
                                        transition: 'all 0.3s',
                                        position: 'relative',
                                        borderRadius: 12,
                                    }}
                                    onClick={() => {
                                        setSelectedPlan(plan);
                                        setQuantity(1);
                                        if (plan.price === 0) {
                                            activateFreePlan(plan);
                                        } else {
                                            setTimeout(() => {
                                                document.getElementById('payment-section')
                                                    ?.scrollIntoView({ behavior: 'smooth' });
                                            }, 100);
                                        }
                                    }}
                                >
                                    {isCurrent && (
                                        <Tag color="green" style={{
                                            position: 'absolute', top: 12, right: 12, margin: 0
                                        }}>
                                            当前
                                        </Tag>
                                    )}
                                    <Title level={4} style={{ marginBottom: '8px' }}>
                                        {plan.name}
                                    </Title>
                                    <Paragraph type="secondary" style={{ marginBottom: 16, minHeight: 44 }}>
                                        {plan.description}
                                    </Paragraph>
                                    <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
                                        ¥{plan.price}
                                        {plan.price > 0 && (
                                            <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '4px' }}>
                                                / 月
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ listStyle: 'none', padding: 0 }}>
                                        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                                            <span>{plan.max_resumes} 份筛选简历/月</span>
                                        </div>
                                        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                                            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                                            <span>{plan.max_jobs} 个新增岗位/月</span>
                                        </div>
                                        {plan.priority_support && (
                                            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                                                <CheckCircleOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
                                                优先支持
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>

                    {/* 数量选择 + 支付方式 + 支付按钮 */}
                    {selectedPlan && selectedPlan.price > 0 && (
                        <Card id="payment-section" style={{ marginBottom: '24px' }}>
                            <Title level={4} style={{ marginBottom: '20px' }}>
                                购买方案
                            </Title>

                            {/* 订阅时长 */}
                            <div style={{ marginBottom: 24 }}>
                                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                                    订阅时长
                                </Text>
                                <Space size="middle">
                                    {[1, 3, 6, 12].map((n) => (
                                        <Button
                                            key={n}
                                            type={quantity === n ? 'primary' : 'default'}
                                            shape="round"
                                            onClick={() => setQuantity(n)}
                                            style={{ minWidth: 72 }}
                                        >
                                            {n} 个月
                                        </Button>
                                    ))}
                                    <InputNumber
                                        min={1}
                                        max={12}
                                        value={quantity}
                                        onChange={(val) => val && setQuantity(val)}
                                        style={{ width: 80 }}
                                        addonAfter="月"
                                    />
                                </Space>
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary">
                                        预计到期：
                                        {(() => {
                                            const exp = new Date();
                                            exp.setMonth(exp.getMonth() + quantity);
                                            return exp.toLocaleDateString();
                                        })()}
                                    </Text>
                                </div>
                            </div>

                            <Divider style={{ margin: '24px 0' }} />

                            {/* 支付方式 */}
                            <div>
                                <Text strong style={{ display: 'block', marginBottom: 12 }}>
                                    选择支付方式
                                </Text>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '12px'
                                }}>
                                    {paymentMethods.map((method) => {
                                        const isSelected = selectedMethod?.code === method.code;
                                        const icon = METHOD_ICON_MAP[method.code] || METHOD_ICON_MAP.default;
                                        const bg = METHOD_BG_MAP[method.code] || METHOD_BG_MAP.default;
                                        const isAlipay = method.code === 'alipay_qrcode';
                                        const card = (
                                            <Card
                                                key={method.code}
                                                hoverable={!isAlipay}
                                                onClick={() => {
                                                    if (isAlipay) return;
                                                    setSelectedMethod(method);
                                                }}
                                                style={{
                                                    cursor: isAlipay ? 'not-allowed' : 'pointer',
                                                    border: isSelected
                                                        ? '2px solid #1890ff'
                                                        : '1px solid #f0f0f0',
                                                    borderRadius: 12,
                                                    background: isAlipay
                                                        ? 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)'
                                                        : bg,
                                                    opacity: isAlipay ? 0.5 : 1,
                                                    transition: 'all 0.3s',
                                                    textAlign: 'center',
                                                }}
                                                bodyStyle={{ padding: '16px 12px' }}
                                            >
                                                <div style={{ marginBottom: 8 }}>
                                                    {icon}
                                                    {isAlipay && (
                                                        <Tag
                                                            color="default"
                                                            style={{
                                                                marginLeft: 6,
                                                                fontSize: 11,
                                                                verticalAlign: 'middle',
                                                            }}
                                                        >
                                                            暂不可用
                                                        </Tag>
                                                    )}
                                                </div>
                                                <div style={{
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                    color: isAlipay ? '#bfbfbf' : undefined,
                                                }}>
                                                    {method.name}
                                                </div>
                                                {method.description && (
                                                    <div style={{
                                                        fontSize: 12,
                                                        color: isAlipay ? '#d9d9d9' : '#8c8c8c',
                                                        marginTop: 4,
                                                    }}>
                                                        {method.description}
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                        if (isAlipay) {
                                            return (
                                                <Tooltip
                                                    key={method.code}
                                                    title="当前不支持支付宝，请使用微信支付"
                                                >
                                                    {card}
                                                </Tooltip>
                                            );
                                        }
                                        return card;
                                    })}
                                </div>
                            </div>

                            <Divider style={{ margin: '24px 0' }} />

                            {/* 支付汇总 */}
                            <div style={{
                                display: 'flex', justifyContent: 'space-between',
                                alignItems: 'center', flexWrap: 'wrap', gap: 12
                            }}>
                                <div>
                                    <Space size="large">
                                        <span>
                                            <Text type="secondary">{selectedPlan.name}</Text>
                                            {' x '}{quantity} 个月
                                        </span>
                                        <span style={{ fontSize: 24, fontWeight: 'bold', color: '#f5222d' }}>
                                            ¥{totalPrice}
                                        </span>
                                    </Space>
                                    {discountHint && (
                                        <Tooltip title={`购买 ${discountHint.months} 个月，平均每月 ¥${(totalPrice / quantity).toFixed(0)}`}>
                                            <Tag color="orange" style={{ marginLeft: 8 }}>
                                                {discountHint.label}
                                            </Tag>
                                        </Tooltip>
                                    )}
                                </div>
                                {selectedMethod && paymentStatus === 'idle' && (
                                    <Button
                                        type="primary"
                                        size="large"
                                        onClick={createPayment}
                                        style={{
                                            borderRadius: 8,
                                            height: 48,
                                            paddingInline: 48,
                                            fontWeight: 600,
                                            fontSize: 16
                                        }}
                                    >
                                        立即支付 ¥{totalPrice}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* 等待支付弹窗 */}
                    <Modal
                        open={paymentStatus === 'processing' && !!orderId}
                        footer={null}
                        closable={true}
                        onCancel={cancelPayment}
                        width={420}
                        centered
                        destroyOnHidden
                    >
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <WechatOutlined style={{ fontSize: 48, color: '#07c160', display: 'block', marginBottom: 16 }} />
                            <Title level={4} style={{ marginBottom: 8 }}>
                                等待支付
                            </Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                                已在新窗口打开收银台，请完成支付
                            </Text>
                            <Text strong style={{ display: 'block', marginBottom: 20, fontSize: 18, color: '#f5222d' }}>
                                ¥{totalPrice}
                            </Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 20 }}>
                                订单号: {orderId}
                            </Text>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 16,
                            }}>
                                <Button
                                    style={{
                                        background: '#fff1f0',
                                        color: '#ff4d4f',
                                        border: '1px solid #ffa39e',
                                        borderRadius: 8,
                                        height: 40,
                                        paddingInline: 24
                                    }}
                                    icon={<CloseCircleOutlined />}
                                    onClick={cancelPayment}
                                >
                                    取消支付
                                </Button>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />
                                    <span style={{ marginLeft: 6, color: '#1890ff', fontSize: 13 }}>
                                        等待支付中
                                    </span>
                                </div>
                                <Button
                                    type="primary"
                                    style={{
                                        borderRadius: 8,
                                        height: 40,
                                        paddingInline: 24
                                    }}
                                    onClick={verifyPayment}
                                >
                                    已完成支付
                                </Button>
                            </div>
                        </div>
                    </Modal>

                    {/* 支付成功弹窗 */}
                    <Modal
                        open={paymentStatus === 'success'}
                        footer={null}
                        onCancel={resetPayment}
                        width={400}
                        centered
                        destroyOnHidden
                    >
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <CheckCircleOutlined
                                style={{ fontSize: 64, color: '#52c41a', display: 'block', marginBottom: 16 }}
                            />
                            <Title level={3} style={{ color: '#52c41a', marginBottom: 8 }}>
                                支付成功！
                            </Title>
                            <Paragraph type="secondary">
                                您已成功订阅 {selectedPlan?.name} x{quantity} 个月
                            </Paragraph>
                            <Button type="primary" onClick={resetPayment} style={{ marginTop: 16 }}>
                                继续购买
                            </Button>
                        </div>
                    </Modal>
                </>
            ) : (
                <Card>
                    <Title level={4} style={{ marginBottom: '16px' }}>
                        订单记录
                    </Title>
                    {orders.length === 0 ? (
                        <Empty description="暂无订单记录" />
                    ) : (
                        <div>
                            {orders.map((order) => (
                                <Card
                                    key={order.order_id}
                                    style={{ marginBottom: '12px' }}
                                >
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', flexWrap: 'wrap', gap: 12
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <Space style={{ marginBottom: '8px' }}>
                                                <Text strong>{order.product_name}</Text>
                                                {getStatusBadge(order.status)}
                                            </Space>
                                            <div>
                                                <Text type="secondary" style={{ display: 'block' }}>
                                                    订单号: {order.order_id}
                                                </Text>
                                                <Text type="secondary">
                                                    时间: {new Date(order.created_at).toLocaleString()}
                                                </Text>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Text style={{ fontSize: '20px', fontWeight: 'bold', color: '#f5222d' }}>
                                                ¥{order.amount}
                                            </Text>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
};

export default PaymentPage;
