import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Space, Spin, Empty, Typography, Tag } from 'antd';
import { CheckCircleOutlined, LoadingOutlined, QrcodeOutlined, ClockCircleOutlined, AppstoreOutlined, FileTextOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/api';

const { Title, Text } = Typography;

const PaymentPage = () => {
    const [plans, setPlans] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedMethod, setSelectedMethod] = useState(null);
    const [qrcodeData, setQrcodeData] = useState(null);
    const [orderId, setOrderId] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [userInfo, setUserInfo] = useState(null);
    const [orders, setOrders] = useState([]);
    const [activeTab, setActiveTab] = useState('plans');

    const API_BASE = getApiBaseUrl();
    const TOKEN = localStorage.getItem('token');

    const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    };

    // 获取套餐列表
    const fetchPlans = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/plans`, {
                headers
            });
            const data = await response.json();
            setPlans(data);
        } catch (error) {
            console.error('获取套餐失败:', error);
        }
    };

    // 获取支付方式
    const fetchPaymentMethods = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/methods`);
            const data = await response.json();
            setPaymentMethods(data.methods);
        } catch (error) {
            console.error('获取支付方式失败:', error);
        }
    };

    // 获取用户信息
    const fetchUserInfo = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/user-info`, {
                headers
            });
            const data = await response.json();
            setUserInfo(data);
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
    };

    // 获取订单列表
    const fetchOrders = async () => {
        try {
            const response = await fetch(`${API_BASE}/payment/orders`, {
                headers
            });
            const data = await response.json();
            setOrders(data);
        } catch (error) {
            console.error('获取订单失败:', error);
        }
    };

    // 激活免费套餐（静默激活，不显示支付流程）
    const activateFreePlan = async (plan) => {
        if (userInfo?.subscription_plan === plan.id) return;
        try {
            await fetch(`${API_BASE}/payment/create-qrcode?plan_id=${plan.id}&payment_method=free`, {
                method: 'POST',
                headers
            });
            await fetchUserInfo();
        } catch (error) {
            console.error('激活免费套餐失败:', error);
        }
    };

    // 创建支付订单
    const createPayment = async () => {
        if (!selectedPlan || !selectedMethod) {
            alert('请选择套餐和支付方式');
            return;
        }

        try {
            setPaymentStatus('processing');
            
            const response = await fetch(`${API_BASE}/payment/create-qrcode?plan_id=${selectedPlan.id}&payment_method=${selectedMethod.code}`, {
                method: 'POST',
                headers
            });

            const data = await response.json();

            if (response.ok) {
                setQrcodeData(data.qrcode_data);
                setOrderId(data.order_id);
                
                // 开始轮询检查支付状态
                startPolling(data.order_id);
            } else {
                setPaymentStatus('failed');
                alert(data.detail || '创建支付失败');
            }
        } catch (error) {
            setPaymentStatus('failed');
            console.error('创建支付失败:', error);
            alert('创建支付失败');
        }
    };

    // 轮询检查支付状态
    const startPolling = (orderId) => {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE}/payment/verify/${orderId}`, {
                    method: 'POST',
                    headers
                });

                const data = await response.json();

                if (data.payment_status?.paid) {
                    clearInterval(pollInterval);
                    setPaymentStatus('success');
                    await fetchUserInfo(); // 更新用户信息
                    await fetchOrders(); // 更新订单列表
                }
            } catch (error) {
                console.error('验证支付失败:', error);
            }
        }, 3000); // 每3秒检查一次

        // 5分钟后停止轮询
        setTimeout(() => clearInterval(pollInterval), 5 * 60 * 1000);
    };

    // 手动验证支付
    const verifyPayment = async () => {
        if (!orderId) return;

        try {
            const response = await fetch(`${API_BASE}/payment/verify/${orderId}`, {
                method: 'POST',
                headers
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

    // 重置支付状态
    const resetPayment = () => {
        setQrcodeData(null);
        setOrderId(null);
        setPaymentStatus('idle');
        setSelectedPlan(null);
        setSelectedMethod(null);
    };

    // 套餐名称映射
    const planNameMap = {
        free: '免费版', basic: '基础版',
        professional: '专业版', enterprise: '企业版'
    };

    // 当前套餐详情
    const currentPlanDetail = useMemo(() => {
        if (!userInfo?.subscription_plan || !plans.length) return null;
        return plans.find(p => p.id === userInfo.subscription_plan);
    }, [userInfo, plans]);

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
                会员订阅
            </Title>

            <Card style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <Text type="secondary">当前套餐</Text>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '4px', marginBottom: '12px' }}>
                            {planNameMap[userInfo?.subscription_plan] || '未知'}
                        </div>
                        {currentPlanDetail && (
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <FileTextOutlined style={{ color: '#4f46e5' }} />
                                    <Text type="secondary">
                                        筛选简历 <Text strong>{currentPlanDetail.max_resumes}</Text> 份/月
                                    </Text>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <PlusCircleOutlined style={{ color: '#4f46e5' }} />
                                    <Text type="secondary">
                                        新增岗位 <Text strong>{currentPlanDetail.max_jobs}</Text> 个/月
                                    </Text>
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#999' }}>
                            筛选简历：AI 每次筛选的 Top K 份简历数量按月累计
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        {plans.map((plan) => (
                            <Card
                                key={plan.id}
                                hoverable
                                style={{
                                    cursor: 'pointer',
                                    border: selectedPlan?.id === plan.id ? '2px solid #1890ff' : '1px solid #f0f0f0',
                                    transition: 'all 0.3s'
                                }}
                                onClick={() => {
                                    setSelectedPlan(plan);
                                    if (plan.price === 0) {
                                        activateFreePlan(plan);
                                    } else {
                                        // 自动滚动到支付方式区域
                                        setTimeout(() => {
                                            document.getElementById('payment-section')?.scrollIntoView({ behavior: 'smooth' });
                                        }, 100);
                                    }
                                }}
                            >
                                <Title level={4} style={{ marginBottom: '8px' }}>
                                    {plan.name}
                                </Title>
                                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                    {plan.description}
                                </Text>
                                <div style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
                                    ¥{plan.price}
                                    {plan.price > 0 && <span style={{ fontSize: '14px', fontWeight: 'normal', marginLeft: '4px' }}> / 月</span>}
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
                        ))}
                    </div>

                    {selectedPlan && selectedPlan.price > 0 && (
                        <Card id="payment-section" style={{ marginBottom: '24px' }}>
                            <Title level={4} style={{ marginBottom: '16px' }}>
                                选择支付方式
                            </Title>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                                {paymentMethods.map((method) => (
                                    <Card
                                        key={method.code}
                                        hoverable
                                        style={{
                                            cursor: 'pointer',
                                            border: selectedMethod?.code === method.code ? '2px solid #1890ff' : '1px solid #f0f0f0'
                                        }}
                                        onClick={() => setSelectedMethod(method)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px' }}>
                                            <QrcodeOutlined style={{ fontSize: '24px', marginRight: '12px', color: '#1890ff' }} />
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{method.name}</div>
                                                <Text type="secondary">{method.description}</Text>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </Card>
                    )}

                    {selectedPlan && selectedMethod && paymentStatus === 'idle' && (
                        <div style={{ textAlign: 'center' }}>
                            <Button
                                type="primary"
                                size="large"
                                onClick={createPayment}
                                style={{ width: '100%', maxWidth: '400px' }}
                            >
                                支付 ¥{selectedPlan.price}
                            </Button>
                        </div>
                    )}

                    {paymentStatus === 'processing' && qrcodeData && (
                        <Card style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <Title level={4} style={{ marginBottom: '8px' }}>
                                扫码支付
                            </Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                请使用 {selectedMethod.name} 扫描二维码完成支付
                            </Text>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                                <img
                                    src={qrcodeData}
                                    alt="支付二维码"
                                    style={{ width: '256px', height: '256px' }}
                                />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <Text style={{ display: 'block', marginBottom: '8px' }}>
                                    订单号: {orderId}
                                </Text>
                                <Text style={{ display: 'block', marginBottom: '8px' }}>
                                    金额: ¥{selectedPlan?.price}
                                </Text>
                                <div style={{ marginBottom: '16px' }}>
                                    <Spin indicator={<LoadingOutlined style={{ fontSize: '14px' }} spin />} />
                                    <span style={{ marginLeft: '8px', color: '#1890ff' }}>等待支付中...</span>
                                </div>
                                <Button onClick={verifyPayment}>
                                    手动验证支付
                                </Button>
                            </div>
                        </Card>
                    )}

                    {paymentStatus === 'success' && (
                        <Card style={{ maxWidth: '500px', margin: '0 auto' }}>
                            <Title level={4} style={{ color: '#52c41a', marginBottom: '8px' }}>
                                支付成功！
                            </Title>
                            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                                您已成功升级到 {selectedPlan?.name}
                            </Text>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
                                <Button onClick={resetPayment}>
                                    继续购买
                                </Button>
                            </div>
                        </Card>
                    )}
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                            <Text style={{ fontSize: '20px', fontWeight: 'bold' }}>
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
