import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Form, Input, Button, Card, message, Typography, Space, Steps } from 'antd';
import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState(0);
  const [forgotForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [codeSendEnabled, setCodeSendEnabled] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [forgotInfo, setForgotInfo] = useState({ username: '', email: '' });
  const usernameWatch = Form.useWatch('username', forgotForm);
  const navigate = useNavigate();

  // 忘记密码 - 校验用户名是否存在（失焦触发）
  const verifyUsernameExists = async (_, value) => {
    if (!value) return Promise.resolve();
    try {
      await api.post('/auth/forgot-password/check-username', { username: value });
      setUsernameValid(true);
      return Promise.resolve();
    } catch (err) {
      setUsernameValid(false);
      setCodeSendEnabled(false);
      return Promise.reject(new Error(err.response?.data?.detail || '用户名不存在'));
    }
  };

  // 忘记密码 - 邮箱格式校验（前端校验）
  const validateEmailFormat = (_, value) => {
    if (!value) return Promise.resolve();
    
    // 更严格的邮箱格式校验，匹配 Pydantic EmailStr 标准
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(value)) {
      return Promise.reject(new Error('请输入有效的邮箱格式（如：user@example.com）'));
    }
    
    return Promise.resolve();
  };

  // 忘记密码 - 发送验证码
  const handleSendForgotCode = async () => {
    try {
      // 使用 getFieldsValue 获取字段值，确保能获取到数据
      const values = forgotForm.getFieldsValue();
      console.log('发送验证码请求参数:', values); // 调试日志
      
      // 检查字段是否为空
      if (!values.username || !values.email) {
        message.error('请填写用户名和邮箱');
        return;
      }
      
      setCodeLoading(true);
      try {
        const response = await api.post('/auth/forgot-password/send-code', {
          username: values.username,
          email: values.email
        });
        if (response.data.success) {
          message.success('验证码已发送');
          setForgotInfo({ username: values.username, email: values.email });
          setForgotStep(1);
          startCountdown();
        }
      } catch (err) {
        console.error('发送验证码失败:', err);
        
        // 处理422错误 - 后端验证失败
        if (err.response?.status === 422) {
          const errorDetail = err.response?.data?.detail;
          if (Array.isArray(errorDetail)) {
            // 处理字段验证错误
            const firstError = errorDetail[0];
            message.error(firstError.msg || '表单验证失败');
          } else if (typeof errorDetail === 'string') {
            message.error(errorDetail);
          } else {
            message.error('用户名和邮箱不匹配');
          }
        } else {
          message.error(err.response?.data?.detail || '发送失败');
        }
      } finally {
        setCodeLoading(false);
      }
    } catch (error) {
      console.error('表单验证失败:', error);
      message.error('请检查表单填写是否正确');
    }
  };

  // 忘记密码 - 重置密码
  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      setResetLoading(true);
      try {
        const response = await api.post('/auth/forgot-password/reset', {
          username: forgotInfo.username,
          email: forgotInfo.email,
          verification_code: values.verification_code,
          new_password: values.new_password
        });
        if (response.data.success) {
          message.success('密码重置成功，请使用新密码登录');
          setShowForgot(false);
          setForgotStep(0);
          forgotForm.resetFields();
          resetForm.resetFields();
        }
      } catch (err) {
        message.error(err.response?.data?.detail || '重置失败');
      } finally {
        setResetLoading(false);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  // 倒计时
  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      console.log('开始登录，用户名:', values.username);
      const response = await api.post('/auth/login', values);
      console.log('登录响应:', response.data);
      const { access_token, user } = response.data;

      // 保存 token 和用户信息
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));
      console.log('Token 已保存，准备跳转...');

      // 使用 window.location.href 强制页面刷新，确保 App.jsx 重新读取 token
      window.location.href = '/app';
    } catch (err) {
      console.error('登录失败:', err);
      message.error(err.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: '460px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        styles={{
          body: { padding: '40px' }
        }}
      >
        {showForgot ? (
          /* 忘记密码界面 */
          <>
            <div style={{ marginBottom: '28px' }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => { setShowForgot(false); setForgotStep(0); setCodeSendEnabled(false); setUsernameValid(false); }}
                style={{ color: '#4f46e5', fontWeight: 'bold', padding: 0, marginBottom: 8 }}
              >
                返回登录
              </Button>
              <Title level={2} style={{ margin: 0, color: '#262626' }}>
                忘记密码
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {forgotStep === 0
                  ? '请输入用户名和注册邮箱，我们将发送验证码'
                  : `验证码已发送至 ${forgotInfo.email}`}
              </Text>
            </div>

            {forgotStep === 0 ? (
              /* 步骤1：输入用户名和邮箱 */
              <Form
                form={forgotForm}
                layout="vertical"
                size="large"
                onValuesChange={(changed, allValues) => {
                  // 监听字段值变化，检查是否应该启用发送按钮
                  const hasUsername = allValues.username && allValues.username.trim() !== '';
                  const hasEmail = allValues.email && allValues.email.trim() !== '';
                  
                  // 当两个字段都有值时，启用发送按钮
                  // 具体校验错误会在点击发送时由后端处理
                  if (hasUsername && hasEmail) {
                    setCodeSendEnabled(true);
                  } else {
                    setCodeSendEnabled(false);
                  }
                }}
              >
                <Form.Item
                  name="username"
                  label="用户名"
                  rules={[
                    { required: true, message: '请输入用户名' }
                  ]}
                  style={{ marginBottom: 12 }}
                  labelCol={{ style: { paddingBottom: 4 } }}
                >
                  <Input placeholder="请输入用户名" />
                </Form.Item>
                <Form.Item
                  name="email"
                  label="邮箱"
                  rules={[
                    { required: true, message: '请输入邮箱' },
                    { validator: validateEmailFormat }
                  ]}
                  validateTrigger={['onBlur']}
                  style={{ marginBottom: 12 }}
                  labelCol={{ style: { paddingBottom: 4 } }}
                >
                  <Input placeholder="请输入注册时使用的邮箱" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={handleSendForgotCode}
                    loading={codeLoading}
                    disabled={!codeSendEnabled}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {codeLoading ? '发送中...' : '发送验证码'}
                  </Button>
                </Form.Item>
              </Form>
            ) : (
              /* 步骤2：输入验证码和新密码 */
              <Form form={resetForm} layout="vertical" size="large">
                <Form.Item
                  name="verification_code"
                  label="验证码"
                  rules={[{ required: true, message: '请输入验证码' }]}
                  extra={
                    countdown > 0
                      ? <Text type="secondary" style={{ fontSize: 12 }}>{countdown}秒后可重新发送</Text>
                      : <a onClick={handleSendForgotCode} style={{ fontSize: 12 }}>重新发送</a>
                  }
                  style={{ marginBottom: 12 }}
                  labelCol={{ style: { paddingBottom: 4 } }}
                >
                  <Input placeholder="请输入6位验证码" maxLength={6} />
                </Form.Item>
                <Form.Item
                  name="new_password"
                  label="新密码"
                  rules={[
                    { required: true, message: '请输入新密码' },
                    { min: 6, message: '密码至少6个字符' }
                  ]}
                  style={{ marginBottom: 12 }}
                  labelCol={{ style: { paddingBottom: 4 } }}
                >
                  <Input.Password placeholder="请输入新密码" />
                </Form.Item>
                <Form.Item
                  name="confirm_password"
                  label="确认密码"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: '请确认新密码' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('new_password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('两次密码输入不一致'));
                      }
                    })
                  ]}
                  style={{ marginBottom: 12 }}
                  labelCol={{ style: { paddingBottom: 4 } }}
                >
                  <Input.Password placeholder="请再次输入新密码" />
                </Form.Item>
                <Form.Item>
                  <Button
                    type="primary"
                    onClick={handleResetPassword}
                    loading={resetLoading}
                    style={{ width: '100%', height: '40px' }}
                  >
                    {resetLoading ? '重置中...' : '重置密码'}
                  </Button>
                </Form.Item>
              </Form>
            )}
          </>
        ) : (
          /* 正常登录界面 */
          <>
            <div style={{ position: 'relative', marginBottom: '28px' }}>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                style={{
                  position: 'absolute',
                  left: 0,
                  color: '#4f46e5',
                  fontWeight: 'bold'
                }}
              >
                返回
              </Button>
              <Title level={2} style={{ textAlign: 'center', margin: 0, color: '#262626' }}>
                登录
              </Title>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              size="large"
            >
              <Form.Item
                name="username"
                label="用户名"
                rules={[{ required: true, message: '请输入用户名' }]}
                style={{ marginBottom: 12 }}
                labelCol={{ style: { paddingBottom: 4 } }}
              >
                <Input placeholder="请输入用户名" />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
                style={{ marginBottom: 12 }}
                labelCol={{ style: { paddingBottom: 4 } }}
              >
                <Input.Password placeholder="请输入密码" />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  style={{ width: '100%', height: '40px' }}
                >
                  {loading ? '登录中...' : '登录'}
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center', marginTop: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <Text>
                <a
                  href="/forgot-password"
                  style={{
                    color: '#4f46e5',
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  忘记密码？
                </a>
              </Text>
              <Text style={{ color: '#666' }}>
                还没有账号？
                <a
                  href="/register"
                  style={{
                    color: '#4f46e5',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    marginLeft: '4px'
                  }}
                >
                  立即注册
                </a>
              </Text>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};



export default Login;
