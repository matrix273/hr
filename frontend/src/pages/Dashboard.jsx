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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm px-8 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-500 m-0">AI 简历筛选系统</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">欢迎, {user.username || '用户'}</span>
            <button 
              className="px-4 py-2 bg-red-500 text-white border-none rounded-md cursor-pointer text-sm font-bold transition-colors duration-200 hover:bg-red-600"
              onClick={handleLogout}
            >
              退出登录
            </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        <Sidebar activeItem={activeTab} onItemClick={handleSidebarClick} />

        <main className="flex-1 p-8 overflow-y-auto">
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
            <div className="bg-white rounded-xl p-16 text-center shadow-sm">
              <div className="text-6xl mb-6">📊</div>
              <h3 className="text-2xl font-bold text-gray-800 mb-3">数据分析</h3>
              <p className="text-base text-gray-500">功能开发中...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};



export default Dashboard;
