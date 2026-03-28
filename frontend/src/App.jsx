import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import HelpPage from './pages/HelpPage';
import Payment from './pages/Payment';
import ForgotPassword from './pages/ForgotPassword';

function App() {
  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  return (
    <Routes>
      {/* 门户页面 - 默认路由 */}
      <Route path="/" element={<Home />} />
      
      {/* 登录页面 */}
      <Route path="/login" element={<Login />} />
      
      {/* 注册页面 */}
      <Route path="/register" element={<Register />} />
      
      {/* 忘记密码页面 */}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* 帮助页面 */}
      <Route path="/help" element={<HelpPage />} />

      {/* 支付页面 */}
      <Route path="/payment" element={<Payment />} />

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
