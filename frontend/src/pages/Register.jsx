import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Typography,
  Space,
  Select,
  Modal
} from 'antd';
import { ArrowLeftOutlined, MailOutlined, CopyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const Register = () => {
  const [form] = Form.useForm();
  const [contactForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [codeLoading, setCodeLoading] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const availableRoles = [
    { value: 'user', label: '普通用户' },
    { value: 'interviewer', label: '面试官' },
    { value: 'recruiter', label: '招聘专员' },
    { value: 'hr', label: '人力资源' },
  ];

  const handleSendCode = async () => {
    try {
      const values = await form.validateFields(['email']);
      setCodeLoading(true);
      await api.post('/auth/send-code', { email: values.email });
      setSentTo(values.email);
      message.success('验证码已发送');
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.detail || '发送失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const data = { ...values };
      // HR 传 company_name，其他角色传 invite_code
      if (data.role !== 'hr') {
        delete data.company_name;
      } else {
        delete data.invite_code;
      }
      delete data.confirmPassword;

      const response = await api.post('/auth/register', data);
      const result = response.data;

      // HR 注册成功，弹窗显示邀请码
      if (result.invite_code) {
        Modal.success({
          title: '注册成功',
          width: 420,
          centered: true,
          content: (
            <div>
              <p>您的公司邀请码为：</p>
              <div style={{
                fontSize: 32,
                fontWeight: 'bold',
                textAlign: 'center',
                letterSpacing: 8,
                color: '#4f46e5',
                padding: '12px 0',
                fontFamily: 'monospace'
              }}>
                {result.invite_code}
              </div>
              <p style={{ color: '#999', fontSize: 13 }}>
                请将此邀请码分享给同事，同事注册时输入即可加入同一公司
              </p>
            </div>
          ),
          okText: '复制邀请码并登录',
          onOk: () => {
            navigator.clipboard?.writeText(result.invite_code);
            message.success('邀请码已复制');
            navigate('/login');
          }
        });
      } else {
        message.success('注册成功！即将跳转到登录页...');
        setTimeout(() => navigate('/login'), 800);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async () => {
    try {
      const values = await contactForm.validateFields();
      setContactLoading(true);
      try {
        const response = await api.post('/users/contact', values);
        if (response.data.success) {
          message.success(response.data.message);
          setShowContactModal(false);
          contactForm.resetFields();
        }
      } catch (err) {
        message.error('提交失败，请稍后重试');
      } finally {
        setContactLoading(false);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    // 切换角色时清空邀请码和公司名
    form.setFieldsValue({ invite_code: '', company_name: '' });
  };

  const formItemStyle = { marginBottom: 16 };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        styles={{ body: { padding: '32px' } }}
      >
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{
              position: 'absolute',
              left: 0,
              color: '#4f46e5',
              fontWeight: 'bold'
            }}
          >
            返回
          </Button>
          <Title level={3} style={{ textAlign: 'center', margin: 0, color: '#262626' }}>
            注册账号
          </Title>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
        >
          {/* 用户名 & 姓名 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input placeholder="用户名" />
            </Form.Item>
            <Form.Item
              name="full_name"
              label="姓名"
              rules={[{ required: true, message: '请输入姓名' }]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input placeholder="真实姓名" />
            </Form.Item>
          </div>

          {/* 邮箱 & 验证码 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '格式不正确' }
              ]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input placeholder="邮箱地址" prefix={<MailOutlined />} />
            </Form.Item>
            <Form.Item
              name="verification_code"
              label="验证码"
              rules={[{ required: true, message: '请输入验证码' }]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input
                placeholder="6位验证码"
                maxLength={6}
                suffix={
                  <Button
                    type="link"
                    size="small"
                    disabled={countdown > 0}
                    loading={codeLoading}
                    onClick={handleSendCode}
                    style={{ padding: 0, fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </Button>
                }
              />
            </Form.Item>
          </div>
          {sentTo && (
            <div style={{ marginTop: -12, marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                验证码已发送至 {sentTo}，5分钟内有效
              </Text>
            </div>
          )}

          {/* 密码 & 确认密码 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '至少6位' }
              ]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input.Password placeholder="密码" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次密码不一致'));
                  },
                }),
              ]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Input.Password placeholder="再次输入" />
            </Form.Item>
          </div>

          {/* 角色 & 公司/邀请码 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              name="role"
              label="角色"
              rules={[{ required: true, message: '请选择角色' }]}
              style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
            >
              <Select placeholder="选择角色" onChange={handleRoleChange}>
                {availableRoles.map((role) => (
                  <Option key={role.value} value={role.value}>
                    {role.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedRole === 'hr' ? (
              <Form.Item
                name="company_name"
                label="公司名称"
                rules={[{ required: true, message: '请输入公司名称' }]}
                style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
                tooltip="注册后将自动生成邀请码，可分享给同事"
              >
                <Input placeholder="请输入公司名称" />
              </Form.Item>
            ) : selectedRole ? (
              <Form.Item
                name="invite_code"
                label="公司邀请码"
                rules={[{ required: true, message: '请输入邀请码' }]}
                style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
                tooltip="向HR同事索取邀请码"
              >
                <Input placeholder="请输入邀请码" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            ) : (
              <Form.Item
                label="公司"
                style={{ flex: 1, marginBottom: formItemStyle.marginBottom }}
              >
                <Input placeholder="请先选择角色" disabled />
              </Form.Item>
            )}
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {loading ? '注册中...' : '注册'}
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <Space split={<span style={{ color: '#ddd' }}>|</span>}>
            <Text style={{ color: '#666', fontSize: 13 }}>
              已有账号？<a href="/login" style={{ color: '#4f46e5', fontWeight: 500 }}>登录</a>
            </Text>
            <Text style={{ color: '#666', fontSize: 13 }}>
              有问题？<span
                style={{ color: '#4f46e5', cursor: 'pointer', fontWeight: 500 }}
                onClick={() => setShowContactModal(true)}
              >联系我</span>
            </Text>
          </Space>
        </div>
      </Card>

      {/* 联系我对话框 */}
      <Modal
        title={
          <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: '#262626' }}>
            联系我
          </div>
        }
        open={showContactModal}
        onCancel={() => setShowContactModal(false)}
        footer={null}
        width={450}
        centered
        styles={{
          body: { padding: '24px' }
        }}
      >
        <Form
          form={contactForm}
          layout="vertical"
          onFinish={handleContactSubmit}
          size="large"
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
            style={{ marginBottom: 16 }}
            labelCol={{ style: { paddingBottom: 4 } }}
          >
            <Input placeholder="请输入您的姓名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱格式' }
            ]}
            style={{ marginBottom: 16 }}
            labelCol={{ style: { paddingBottom: 4 } }}
          >
            <Input placeholder="请输入您的邮箱地址" type="email" />
          </Form.Item>
          <Form.Item
            name="message"
            label="留言"
            rules={[{ required: true, message: '请输入留言内容' }]}
            style={{ marginBottom: 24 }}
            labelCol={{ style: { paddingBottom: 4 } }}
          >
            <Input.TextArea
              rows={4}
              placeholder="请输入您的问题或建议..."
              style={{ resize: 'vertical' }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
              <Button
                size="large"
                onClick={() => setShowContactModal(false)}
                style={{
                  flex: 1,
                  height: '44px',
                  border: '2px solid #d9d9d9',
                  fontSize: '16px'
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={contactLoading}
                style={{
                  flex: 1,
                  height: '44px',
                  background: 'linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                提交
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Register;
