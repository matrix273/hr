import axios from 'axios';

// 根据环境配置API地址
const getApiBaseUrl = () => {
  // 生产环境使用相对路径（通过 nginx 反向代理）
  const hostname = window.location.hostname;
  if (!hostname.includes('localhost') && !hostname.includes('127.0.0.1')) {
    return '/api';
  }
  return 'http://localhost:8000/api';
};

// 导出 getApiBaseUrl 供 fetch 调用使用
export { getApiBaseUrl };

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
      // 登录接口的 401 不跳转，让组件自行处理错误提示
      const requestUrl = error.config?.url || '';
      if (requestUrl.includes('/auth/login')) {
        return Promise.reject(error);
      }
      // Token 过期或无效，清除本地存储并跳转到登录页
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
