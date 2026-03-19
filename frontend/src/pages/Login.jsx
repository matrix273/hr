import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Form, Input, Button, Card, message, Typography, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      console.log('开始登录，用户名:', values.username);
      const response = await axios.post('http://localhost:8000/api/auth/login', values);
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
          maxWidth: '400px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        styles={{
          body: { padding: '40px' }
        }}
      >
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
        
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
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
      </Card>
    </div>
  );
};



export default Login;
