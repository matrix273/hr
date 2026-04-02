import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Button, Typography, Space, message } from 'antd';
import { LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import ResumeUpload from './ResumeUpload';
import ResumeList from '../components/ResumeList';
import JobManagement from './JobManagement';
import Screening from './Screening';
import UserManagement from './UserManagement';
import CompanyManagement from './CompanyManagement';
import Payment from './Payment';
import PlanManagement from '../components/PlanManagement';
import AuditLog from './AuditLog';
import MessageManagement from './MessageManagement';
import Sidebar from '../components/Sidebar';
import { Permission, hasPermission } from '../utils/permissions';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState(() => {
    // 从 localStorage 读取保存的 tab，如果没有则默认为 'upload'
    let savedTab = localStorage.getItem('activeTab') || 'upload';

    // 检查用户是否有权限访问保存的 tab（用户管理、会员订阅对所有用户开放）
    const tabPermissions = {
      'companies': [Permission.COMPANY_READ],
      'plan-manage': [Permission.SYSTEM_ADMIN],
      'contacts': [Permission.SYSTEM_ADMIN],
      'audit': [Permission.SYSTEM_ADMIN],
    };

    const requiredPermissions = tabPermissions[savedTab];
    if (requiredPermissions) {
      const hasAccess = requiredPermissions.some(p => hasPermission(p));
      if (!hasAccess) {
        savedTab = 'upload'; // 无权限则切换到默认页面
        localStorage.setItem('activeTab', 'upload');
      }
    }

    return savedTab;
  });
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [refreshList, setRefreshList] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [siderHovered, setSiderHovered] = useState(false);
  const siderCollapsed = collapsed && !siderHovered;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
    message.success('已退出登录');
  };

  const handleUploadSuccess = (data) => {
    setUploadedResumes([...uploadedResumes, data]);
    // 触发列表刷新
    setRefreshList(prev => prev + 1);
  };

  const handleSidebarClick = (itemId) => {
    setActiveTab(itemId);
    // 保存当前 tab 到 localStorage
    localStorage.setItem('activeTab', itemId);
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  // 监听子组件触发的 tab 切换事件
  useEffect(() => {
    const handleSwitchTab = (e) => {
      setActiveTab(e.detail);
      localStorage.setItem('activeTab', e.detail);
    };
    window.addEventListener('switchTab', handleSwitchTab);
    return () => window.removeEventListener('switchTab', handleSwitchTab);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{ 
        background: 'white', 
        padding: '0 32px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{ 
          maxWidth: '100%', 
          width: '100%', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          height: '64px'
        }}>
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
              style={{ fontSize: '16px' }}
            />
            <Title level={3} style={{ margin: 0, color: '#4f46e5' }}>
              AI 简历筛选系统
            </Title>
          </Space>
          <Space>
            <Text>欢迎, {user.username || '用户'}</Text>
            <Button 
              type="primary" 
              danger
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="middle"
            >
              退出登录
            </Button>
          </Space>
        </div>
      </Header>

      <Layout>
        <Sider
          width={200}
          collapsedWidth={80}
          collapsible
          collapsed={siderCollapsed}
          trigger={null}
          onMouseEnter={() => collapsed && setSiderHovered(true)}
          onMouseLeave={() => setSiderHovered(false)}
          style={{
            background: 'white',
            boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
            overflow: 'auto',
            transition: 'all 0.2s'
          }}
        >
          <Sidebar activeItem={activeTab} onItemClick={handleSidebarClick} collapsed={siderCollapsed} />
        </Sider>

        <Content style={{ 
          padding: '32px', 
          overflowY: 'auto',
          background: '#f5f5f5'
        }}>
          <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
            <ResumeUpload onUploadSuccess={handleUploadSuccess} />
          </div>

          <div style={{ display: activeTab === 'list' ? 'block' : 'none' }}>
            <ResumeList key={refreshList} onUploadSuccess={handleUploadSuccess} />
          </div>

          <div style={{ display: activeTab === 'jobs' ? 'block' : 'none' }}>
            <JobManagement />
          </div>

          <div style={{ display: activeTab === 'screening' ? 'block' : 'none' }}>
            <Screening />
          </div>

          <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
            <UserManagement />
          </div>

          <div style={{ display: activeTab === 'companies' ? 'block' : 'none' }}>
            {hasPermission(Permission.COMPANY_READ) && <CompanyManagement />}
          </div>

          <div style={{ display: activeTab === 'payment' ? 'block' : 'none' }}>
            <Payment />
          </div>

          <div style={{ display: activeTab === 'plan-manage' ? 'block' : 'none' }}>
            {hasPermission(Permission.SYSTEM_ADMIN) && <PlanManagement />}
          </div>

          <div style={{ display: activeTab === 'contacts' ? 'block' : 'none' }}>
            {hasPermission(Permission.SYSTEM_ADMIN) && <MessageManagement />}
          </div>

          <div style={{ display: activeTab === 'audit' ? 'block' : 'none' }}>
            <AuditLog />
          </div>

        </Content>
      </Layout>
    </Layout>
  );
};



export default Dashboard;
