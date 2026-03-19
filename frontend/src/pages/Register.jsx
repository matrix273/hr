import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  message, 
  Typography, 
  Space, 
  Select, 
  Modal,
  Alert
} from 'antd';
import { ArrowLeftOutlined, ContactsOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const Register = () => {
  const [form] = Form.useForm();
  const [contactForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const navigate = useNavigate();

  // 可选角色（排除 admin 和 manager）
  const availableRoles = [
    { value: 'user', label: '普通用户', desc: '查看简历和岗位' },
    { value: 'interviewer', label: '面试官', desc: '查看简历、岗位和筛选结果' },
    { value: 'recruiter', label: '招聘专员', desc: '简历管理、岗位查看、执行筛选' },
    { value: 'hr', label: '人力资源', desc: '简历和岗位管理、筛选执行' },
  ];

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/api/users/register', values);

      if (response.data) {
        message.success('注册成功！请登录');
        navigate('/login');
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
        const response = await axios.post('http://localhost:8000/api/users/contact', values);
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
          maxWidth: '450px',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        styles={{
          body: { padding: '40px' }
        }}
      >
        <div style={{ position: 'relative', marginBottom: '20px' }}>
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
          <Title level={2} style={{ textAlign: 'center', margin: 0, color: '#262626' }}>
            注册
          </Title>
        </div>
        
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          size="large"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱格式' }
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          
          <Form.Item
            name="full_name"
            label="姓名"
            rules={[{ required: true, message: '请输入真实姓名' }]}
          >
            <Input placeholder="请输入真实姓名" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码长度至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入密码（至少6位）" />
          </Form.Item>
          
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请再次输入密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" />
          </Form.Item>
          
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {availableRoles.map((role) => (
                <Option key={role.value} value={role.value}>
                  {role.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item shouldUpdate style={{ marginBottom: '8px' }}>
            {() => {
              const role = form.getFieldValue('role');
              const roleInfo = availableRoles.find(r => r.value === role);
              return roleInfo ? (
                <Alert 
                  message={roleInfo.desc} 
                  type="info" 
                  showIcon 
                  size="small"
                  style={{ fontSize: '12px' }}
                />
              ) : null;
            }}
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              style={{ width: '100%', height: '40px' }}
            >
              {loading ? '注册中...' : '注册'}
            </Button>
          </Form.Item>
        </Form>
        
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Space direction="vertical" size={8}>
            <Text style={{ color: '#666' }}>
              已有账号？
              <a 
                href="/login" 
                style={{ 
                  color: '#4f46e5', 
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  marginLeft: '4px'
                }}
              >
                立即登录
              </a>
            </Text>
            <Text style={{ color: '#666' }}>
              有问题？
              <span 
                style={{ 
                  color: '#4f46e5', 
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  marginLeft: '4px'
                }}
                onClick={() => setShowContactModal(true)}
              >
                联系我
              </span>
            </Text>
          </Space>
        </div>
      </Card>

      {/* 联系我对话框 */}
      <Modal
        title="联系我"
        open={showContactModal}
        onCancel={() => setShowContactModal(false)}
        footer={null}
        width={400}
        centered
      >
        <Form
          form={contactForm}
          layout="vertical"
          onFinish={handleContactSubmit}
        >
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱格式' }
            ]}
          >
            <Input size="large" type="email" />
          </Form.Item>
          <Form.Item
            name="message"
            label="留言"
            rules={[{ required: true, message: '请输入留言内容' }]}
          >
            <Input.TextArea rows={4} size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space size={16} style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button 
                size="large" 
                onClick={() => setShowContactModal(false)}
                style={{ width: '48%' }}
              >
                取消
              </Button>
              <Button 
                type="primary" 
                size="large" 
                htmlType="submit"
                loading={contactLoading}
                style={{ width: '48%' }}
              >
                提交
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};



export default Register;
