import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  return (
    <Routes>
      {/* 门户页面 - 默认路由 */}
      <Route path="/" element={<Home />} />
      
      {/* 登录页面 */}
      <Route path="/login" element={<Login />} />
      
      {/* 应用页面（需要认证） */}
      <Route
        path="/app"
        element={
          isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
        }
      />
      
      {/* 404 重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
