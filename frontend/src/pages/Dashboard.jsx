import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ResumeUpload from './ResumeUpload';
import ResumeList from '../components/ResumeList';
import JobManagement from './JobManagement';
import Screening from './Screening';
import UserManagement from './UserManagement';
import Sidebar from '../components/Sidebar';

const Dashboard = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState(() => {
    // 从 localStorage 读取保存的 tab，如果没有则默认为 'upload'
    return localStorage.getItem('activeTab') || 'upload';
  });
  const [uploadedResumes, setUploadedResumes] = useState([]);
  const [refreshList, setRefreshList] = useState(0);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
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

  return (
    <div style={styles.container}>
      <nav style={styles.navbar}>
        <div style={styles.navContent}>
          <h1 style={styles.logo}>AI 简历筛选系统</h1>
          <div style={styles.navItems}>
            <span style={styles.userInfo}>欢迎, {user.username || '用户'}</span>
            <button style={styles.logoutButton} onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <Sidebar activeItem={activeTab} onItemClick={handleSidebarClick} />

        <main style={styles.main}>
          {activeTab === 'upload' && (
            <ResumeUpload onUploadSuccess={handleUploadSuccess} />
          )}

          {activeTab === 'list' && (
            <ResumeList key={refreshList} onUploadSuccess={handleUploadSuccess} />
          )}

          {activeTab === 'jobs' && (
            <JobManagement />
          )}

          {activeTab === 'screening' && (
            <Screening />
          )}

          {activeTab === 'users' && (
            <UserManagement />
          )}

          {activeTab === 'analysis' && (
            <div style={styles.placeholder}>
              <div style={styles.placeholderIcon}>📊</div>
              <h3 style={styles.placeholderTitle}>数据分析</h3>
              <p style={styles.placeholderText}>功能开发中...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  },
  navbar: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    padding: '16px 32px',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#667eea',
    margin: 0,
  },
  navItems: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    fontSize: '14px',
    color: '#666',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'backgroundColor 0.2s',
  },
  mainContent: {
    display: 'flex',
    flex: 1,
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
  placeholder: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '64px 32px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  placeholderIcon: {
    fontSize: '64px',
    marginBottom: '24px',
  },
  placeholderTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '12px',
  },
  placeholderText: {
    fontSize: '16px',
    color: '#999',
  },
};

export default Dashboard;
