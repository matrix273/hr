import React, { useState, useEffect } from 'react';
import {
    Card, Table, Button, Space, Tag, Modal, Form, Input,
    InputNumber, Switch, Select, Popconfirm, message, Typography
} from 'antd';
import {
    PlusOutlined, EditOutlined, StopOutlined,
    PlayCircleOutlined, DeleteOutlined
} from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/api';

const { Text } = Typography;

/** 套餐类型选项 */
const PLAN_TYPE_OPTIONS = [
    { value: 'subscription', label: '月度会员' },
    { value: 'addon', label: '加量包' },
];

const PlanManagement = () => {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [form] = Form.useForm();

    const API_BASE = getApiBaseUrl();
    const headers = {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
    };

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const resp = await fetch(`${API_BASE}/payment/admin/plans`, { headers });
            if (!resp.ok) throw new Error('获取套餐失败');
            const data = await resp.json();
            setPlans(data);
        } catch (error) {
            message.error('获取套餐列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, []);

    /** 打开创建弹窗 */
    const handleCreate = () => {
        setEditingPlan(null);
        form.resetFields();
        form.setFieldsValue({
            plan_type: 'subscription',
            price: 0,
            duration_days: 30,
            max_resumes: 100,
            max_jobs: 10,
            ai_screening: true,
            priority_support: false,
            addon_resumes: 0,
            addon_jobs: 0,
            is_test: false,
        });
        setModalOpen(true);
    };

    /** 打开编辑弹窗 */
    const handleEdit = (record) => {
        setEditingPlan(record);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    /** 提交表单 */
    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const planType = form.getFieldValue('plan_type');

            // 加量包字段校验
            if (planType === 'addon' && values.addon_resumes <= 0 && values.addon_jobs <= 0) {
                message.warning('加量包至少需要设置筛选或岗位配额之一');
                return;
            }
            // 月度会员字段校验
            if (planType === 'subscription' && values.max_resumes <= 0 && values.max_jobs <= 0) {
                message.warning('月度会员至少需要设置筛选或岗位配额之一');
                return;
            }

            const url = editingPlan
                ? `${API_BASE}/payment/admin/plans/${editingPlan.id}`
                : `${API_BASE}/payment/admin/plans`;
            const method = editingPlan ? 'PUT' : 'POST';

            const resp = await fetch(url, {
                method,
                headers,
                body: JSON.stringify(values),
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || '操作失败');
            }

            message.success(editingPlan ? '更新成功' : '创建成功');
            setModalOpen(false);
            fetchPlans();
        } catch (error) {
            message.error(error.message || '操作失败');
        }
    };

    /** 停用/启用套餐 */
    const handleToggleActive = async (record) => {
        try {
            const action = record.is_active ? '停用' : '启用';
            const url = record.is_active
                ? `${API_BASE}/payment/admin/plans/${record.id}`
                : `${API_BASE}/payment/admin/plans/${record.id}/activate`;
            const method = record.is_active ? 'DELETE' : 'PUT';

            const resp = await fetch(url, { method, headers });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.detail || `${action}失败`);
            }

            message.success(`${action}成功`);
            fetchPlans();
        } catch (error) {
            message.error(error.message);
        }
    };

    const isAddonChange = Form.useWatch('plan_type', form) === 'addon';

    const columns = [
        {
            title: 'ID',
            dataIndex: 'id',
            width: 160,
            ellipsis: true,
        },
        {
            title: '名称',
            dataIndex: 'name',
            width: 140,
        },
        {
            title: '类型',
            dataIndex: 'plan_type',
            width: 100,
            render: (type) => {
                const map = {
                    subscription: { text: '月度会员', color: 'blue' },
                    addon: { text: '加量包', color: 'orange' },
                };
                const info = map[type] || { text: type, color: 'default' };
                return <Tag color={info.color}>{info.text}</Tag>;
            },
        },
        {
            title: '价格',
            dataIndex: 'price',
            width: 100,
            render: (price) => (
                <Text strong style={{ color: price > 0 ? '#f5222d' : undefined }}>
                    {price > 0 ? `¥${price}` : '免费'}
                </Text>
            ),
        },
        {
            title: '筛选配额',
            width: 100,
            render: (_, record) => {
                if (record.plan_type === 'addon') {
                    return record.addon_resumes > 0 ? `+${record.addon_resumes}份` : '-';
                }
                return `${record.max_resumes}份/月`;
            },
        },
        {
            title: '岗位配额',
            width: 100,
            render: (_, record) => {
                if (record.plan_type === 'addon') {
                    return record.addon_jobs > 0 ? `+${record.addon_jobs}个` : '-';
                }
                return `${record.max_jobs}个/月`;
            },
        },
        {
            title: '状态',
            dataIndex: 'is_active',
            width: 80,
            render: (active) => (
                <Tag color={active ? 'green' : 'default'}>
                    {active ? '启用' : '停用'}
                </Tag>
            ),
        },
        {
            title: '测试',
            dataIndex: 'is_test',
            width: 70,
            render: (isTest) => isTest ? <Tag color="purple">测试</Tag> : '-',
        },
        {
            title: '操作',
            width: 180,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    {record.id !== 'free' && (
                        <Popconfirm
                            title={record.is_active ? '确定停用该套餐？' : '确定启用该套餐？'}
                            onConfirm={() => handleToggleActive(record)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                danger={record.is_active}
                                icon={record.is_active ? <StopOutlined /> : <PlayCircleOutlined />}
                            >
                                {record.is_active ? '停用' : '启用'}
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Card
                title="套餐管理"
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleCreate}
                    >
                        新建套餐
                    </Button>
                }
            >
                <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={plans}
                    loading={loading}
                    pagination={false}
                    size="middle"
                    scroll={{ x: 1000 }}
                />
            </Card>

            {/* 创建/编辑弹窗 */}
            <Modal
                title={editingPlan ? '编辑套餐' : '新建套餐'}
                open={modalOpen}
                onOk={handleSubmit}
                onCancel={() => setModalOpen(false)}
                okText="保存"
                cancelText="取消"
                width={560}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    style={{ marginTop: 16 }}
                >
                    <Form.Item
                        name="id"
                        label="套餐ID"
                        rules={[{ required: true, message: '请输入套餐ID' }]}
                        extra="唯一标识，创建后不可修改（如 basic、addon_resume_50）"
                    >
                        <Input
                            placeholder="如 basic, pro, addon_resume_50"
                            disabled={!!editingPlan}
                            maxLength={50}
                        />
                    </Form.Item>

                    <Form.Item
                        name="name"
                        label="套餐名称"
                        rules={[{ required: true, message: '请输入套餐名称' }]}
                    >
                        <Input placeholder="如 基础版、筛选加量包 50份" maxLength={100} />
                    </Form.Item>

                    <Form.Item name="description" label="描述">
                        <Input.TextArea rows={2} placeholder="套餐描述信息" maxLength={500} />
                    </Form.Item>

                    <Form.Item
                        name="plan_type"
                        label="套餐类型"
                        rules={[{ required: true, message: '请选择套餐类型' }]}
                    >
                        <Select options={PLAN_TYPE_OPTIONS} />
                    </Form.Item>

                    {!isAddonChange && (
                        <Form.Item
                            name="price"
                            label="价格（元/月）"
                            rules={[{ required: true, message: '请输入价格' }]}
                        >
                            <InputNumber min={0} max={99999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {!isAddonChange && (
                        <Form.Item
                            name="duration_days"
                            label="有效天数"
                            rules={[{ required: true, message: '请输入有效天数' }]}
                        >
                            <InputNumber min={1} max={36500} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {!isAddonChange && (
                        <Form.Item
                            name="max_resumes"
                            label="筛选简历配额（份/月）"
                        >
                            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {!isAddonChange && (
                        <Form.Item
                            name="max_jobs"
                            label="新增岗位配额（个/月）"
                        >
                            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {isAddonChange && (
                        <Form.Item
                            name="price"
                            label="价格（元）"
                            rules={[{ required: true, message: '请输入价格' }]}
                        >
                            <InputNumber min={0} max={99999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {isAddonChange && (
                        <Form.Item
                            name="addon_resumes"
                            label="额外筛选配额（份）"
                        >
                            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {isAddonChange && (
                        <Form.Item
                            name="addon_jobs"
                            label="额外岗位配额（个）"
                        >
                            <InputNumber min={0} max={999999} style={{ width: '100%' }} />
                        </Form.Item>
                    )}

                    {!isAddonChange && (
                        <>
                            <Form.Item
                                name="ai_screening"
                                label="AI筛选"
                                valuePropName="checked"
                            >
                                <Switch checkedChildren="支持" unCheckedChildren="不支持" />
                            </Form.Item>

                            <Form.Item
                                name="priority_support"
                                label="优先支持"
                                valuePropName="checked"
                            >
                                <Switch checkedChildren="是" unCheckedChildren="否" />
                            </Form.Item>
                        </>
                    )}

                    <Form.Item
                        name="is_test"
                        label="测试套餐"
                        valuePropName="checked"
                        extra="测试套餐仅管理员可见，用于测试支付流程"
                    >
                        <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default PlanManagement;
