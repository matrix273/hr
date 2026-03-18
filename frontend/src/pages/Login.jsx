import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('开始登录，用户名:', formData.username);
      const response = await axios.post('http://localhost:8000/api/auth/login', formData);
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
      setError(err.response?.data?.detail || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 w-full p-5">
      <div className="bg-white p-10 rounded-xl shadow-sm w-full max-w-md min-w-80">
        <div className="relative mb-7">
          <button 
            type="button" 
            className="absolute left-0 bg-transparent border-none text-indigo-500 text-sm cursor-pointer px-3 py-2 rounded font-bold hover:bg-indigo-50" 
            onClick={handleBack}
          >
            ← 返回
          </button>
          <h2 className="text-2xl text-center text-gray-800 m-0 font-bold">登录</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">用户名</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white text-gray-800"
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-600">密码</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white text-gray-800"
              placeholder="请输入密码"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center -my-2.5">{error}</p>}
          <button
            type="submit"
            className="bg-indigo-500 text-white border-none px-3 py-3 rounded-md text-sm font-bold cursor-pointer transition-colors duration-200 w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="text-center mt-5 text-sm text-gray-600">
          还没有账号？<a href="/register" className="text-indigo-500 no-underline font-bold">立即注册</a>
        </p>
      </div>
    </div>
  );
};



export default Login;
