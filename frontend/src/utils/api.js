import axios from 'axios';

// 根据环境配置API地址
const getApiBaseUrl = () => {
  // 如果是生产环境，使用相对路径；开发环境使用localhost
  if (window.location.hostname === 'godquant.com') {
    return '/api';
  }
  return 'http://localhost:8000';
};

// 创建 axios 实例
const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 300000, // 5分钟超时,适应LLM评估
});

// 请求拦截器 - 自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token 过期或无效，清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
