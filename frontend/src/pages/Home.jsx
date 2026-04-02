import React, { useState } from 'react';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Typography,
  Space,
  Modal,
  Form,
  Input,
  message,
  Divider
} from 'antd';
import {
  SearchOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  BankOutlined,
  TeamOutlined,
  FileSearchOutlined,
  ContactsOutlined
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const Home = () => {
  const navigate = useNavigate();
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm] = Form.useForm();
  const [contactLoading, setContactLoading] = useState(false);

  const handleContactSubmit = async () => {
    try {
      const values = await contactForm.validateFields();
      setContactLoading(true);
      
      try {
        const response = await api.post('/messages', values);
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
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Hero Section */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          padding: '80px 0',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <Title 
            level={1} 
            style={{ 
              fontSize: 'clamp(2.2rem, 4vw, 3rem)',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: 'white'
            }}
          >
            AI 简历筛选系统
          </Title>
          <Paragraph 
            style={{ 
              marginBottom: '32px',
              opacity: 0.9,
              fontSize: 'clamp(1.1rem, 1.8vw, 1.3rem)'
            }}
          >
            基于大语言模型的智能简历筛选解决方案
          </Paragraph>
          <Space size={16}>
            <Button 
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={() => window.location.href = '/login'}
              style={{
                background: 'linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)',
                border: 'none',
                height: '42px',
                padding: '0 28px',
                fontSize: '15px',
                fontWeight: 'bold'
              }}
            >
              立即登录
            </Button>
            <Button 
              size="large"
              icon={<ContactsOutlined />}
              onClick={() => navigate('/help')}
              style={{
                border: '2px solid white',
                color: 'white',
                background: 'transparent',
                height: '42px',
                padding: '0 24px',
                fontSize: '15px',
                fontWeight: 'bold'
              }}
            >
              了解更多
            </Button>
          </Space>
        </div>
      </div>

      {/* Features Section */}
      <div style={{ padding: '60px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: '48px' }}>
            核心功能
          </Title>
          <Row gutter={[32, 32]} justify="center">
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '24px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <SearchOutlined style={{ fontSize: '40px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  智能匹配
                </Title>
                <Paragraph style={{ lineHeight: '1.5', color: '#666', fontSize: '14px' }}>
                  基于向量检索和重排序模型<br />精准匹配职位要求
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <RobotOutlined style={{ fontSize: '40px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  AI 评估
                </Title>
                <Paragraph style={{ lineHeight: '1.5', color: '#666', fontSize: '14px' }}>
                  利用大语言模型进行<br />深度简历分析和评估
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <ThunderboltOutlined style={{ fontSize: '40px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  高效处理
                </Title>
                <Paragraph style={{ lineHeight: '1.5', color: '#666', fontSize: '14px' }}>
                  支持批量处理<br />快速筛选大量简历
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <SafetyOutlined style={{ fontSize: '40px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  安全可靠
                </Title>
                <Paragraph style={{ lineHeight: '1.5', color: '#666', fontSize: '14px' }}>
                  RBAC 权限控制<br />保障数据安全
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      {/* Use Cases Section */}
      <div style={{ padding: '60px 0', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: '48px' }}>
            应用场景
          </Title>
          <Row gutter={[32, 32]} justify="center">
            <Col xs={24} md={8}>
              <div 
                style={{ 
                  padding: '24px',
                  borderLeft: '4px solid #4f46e5',
                  height: '100%',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                <BankOutlined style={{ fontSize: '36px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  企业招聘
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '14px' }}>
                  大规模简历筛选，快速找到合适候选人
                </Paragraph>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div 
                style={{ 
                  padding: '32px',
                  borderLeft: '4px solid #4f46e5',
                  height: '100%',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                <TeamOutlined style={{ fontSize: '36px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  猎头服务
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '14px' }}>
                  精准匹配候选人，提升推荐质量
                </Paragraph>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div 
                style={{ 
                  padding: '32px',
                  borderLeft: '4px solid #4f46e5',
                  height: '100%',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  background: 'white',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                <FileSearchOutlined style={{ fontSize: '36px', color: '#4f46e5', marginBottom: '12px', display: 'block', margin: '0 auto 12px' }} />
                <Title level={4} style={{ marginBottom: '12px' }}>
                  HR 部门
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '14px' }}>
                  自动化筛选流程，减少人工工作量
                </Paragraph>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Technology Stack Section */}
      <div style={{ padding: '60px 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <Title level={2} style={{ textAlign: 'center', marginBottom: '48px' }}>
            技术栈
          </Title>
          <Row gutter={[32, 32]} justify="center">
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '24px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <Title level={4} style={{ marginBottom: '12px', color: '#4f46e5' }}>
                  AI 模型
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '14px', fontWeight: '500' }}>
                  Qwen3-Embedding / Qwen3-Reranker
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <Title level={4} style={{ marginBottom: '16px', color: '#4f46e5' }}>
                  向量数据库
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '16px', fontWeight: '500' }}>
                  Milvus
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <Title level={4} style={{ marginBottom: '16px', color: '#4f46e5' }}>
                  后端
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '16px', fontWeight: '500' }}>
                  FastAPI / Python
                </Paragraph>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card 
                hoverable
                style={{ 
                  height: '100%',
                  borderRadius: '16px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                  transition: 'all 0.3s ease'
                }}
                styles={{
                  body: { 
                    padding: '32px',
                    textAlign: 'center',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }
                }}
              >
                <Title level={4} style={{ marginBottom: '16px', color: '#4f46e5' }}>
                  前端
                </Title>
                <Paragraph style={{ color: '#666', fontSize: '16px', fontWeight: '500' }}>
                  React / Ant Design
                </Paragraph>
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      {/* CTA Section */}
      <div 
        style={{ 
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          padding: '60px 0',
          textAlign: 'center'
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
          <Title level={2} style={{ marginBottom: '16px', color: 'white' }}>
            立即开始使用
          </Title>
          <Paragraph style={{ marginBottom: '32px', opacity: 0.9, fontSize: '1.1rem' }}>
            注册账号，体验智能简历筛选的强大功能
          </Paragraph>
          <div style={{ textAlign: 'center' }}>
            <Button 
              type="primary"
              size="large"
              onClick={() => window.location.href = '/login'}
              style={{
                background: 'linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)',
                border: 'none',
                height: '42px',
                padding: '0 36px',
                fontSize: '15px',
                fontWeight: 'bold'
              }}
            >
              立即登录
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ background: '#141414', color: '#f0f0f0', padding: '24px 0', textAlign: 'center' }}>
        <Paragraph style={{ marginBottom: '8px', fontSize: '14px', color: '#cccccc' }}>
          &copy; 2025 AI 简历筛选系统. All rights reserved.
        </Paragraph>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#999999', textDecoration: 'none' }}
        >
          粤ICP备19036803号-2
        </a>
        <Paragraph 
          style={{ 
            color: '#4f46e5',
            cursor: 'pointer',
            fontWeight: 'bold',
            margin: 0,
            fontSize: '16px'
          }}
          onClick={() => setShowContactModal(true)}
        >
          联系我
        </Paragraph>
      </div>

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



export default Home;
