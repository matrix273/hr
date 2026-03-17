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
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <div style={styles.header}>
          <button 
            type="button" 
            style={styles.backButton} 
            onClick={handleBack}
          >
            ← 返回
          </button>
          <h2 style={styles.title}>登录</h2>
          <div style={{ width: '60px' }}></div>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>用户名</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              style={styles.input}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>密码</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              placeholder="请输入密码"
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            style={styles.submitButton}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p style={styles.registerHint}>
          还没有账号？<a href="/register" style={styles.link}>立即注册</a>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    width: '100%',
    padding: '20px',
  },
  loginBox: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px',
    minWidth: '320px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '30px',
  },
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#667eea',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '8px 12px',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  title: {
    fontSize: '28px',
    textAlign: 'center',
    color: '#333',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    color: '#e74c3c',
    fontSize: '14px',
    textAlign: 'center',
    margin: '-10px 0',
  },
  submitButton: {
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'backgroundColor 0.2s',
    width: '100%',
  },
  registerHint: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: '#666',
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
};

export default Login;
