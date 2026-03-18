import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 联系我对话框状态
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactEmailError, setContactEmailError] = useState('');

  // 邮箱格式校验
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 可选角色（排除 admin 和 manager）
  const availableRoles = [
    { value: 'user', label: '普通用户', desc: '查看简历和岗位' },
    { value: 'interviewer', label: '面试官', desc: '查看简历、岗位和筛选结果' },
    { value: 'recruiter', label: '招聘专员', desc: '简历管理、岗位查看、执行筛选' },
    { value: 'hr', label: '人力资源', desc: '简历和岗位管理、筛选执行' },
  ];

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

    // 验证密码
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/api/users/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
      });

      if (response.data) {
        alert('注册成功！请登录');
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 联系我相关处理
  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm({
      ...contactForm,
      [name]: value,
    });

    // 实时校验邮箱格式
    if (name === 'email') {
      if (value && !validateEmail(value)) {
        setContactEmailError('请输入有效的邮箱格式');
      } else {
        setContactEmailError('');
      }
    }
  };

  const handleContactSubmit = async () => {
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      alert('请填写完整信息');
      return;
    }

    if (!validateEmail(contactForm.email)) {
      alert('请输入有效的邮箱格式');
      return;
    }

    setContactLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/api/users/contact', contactForm);
      if (response.data.success) {
        alert(response.data.message);
        setShowContactModal(false);
        setContactForm({ name: '', email: '', message: '' });
        setContactEmailError('');
      }
    } catch (err) {
      alert('提交失败，请稍后重试');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 w-full p-5">
      <div className="bg-white p-10 rounded-xl shadow-sm w-full max-w-md min-w-80">
        <div className="relative mb-5">
          <button 
            type="button" 
            className="absolute left-0 bg-transparent border-none text-indigo-500 text-sm cursor-pointer px-3 py-2 rounded font-bold hover:bg-indigo-50" 
            onClick={() => navigate('/')}
          >
            ← 返回
          </button>
          <h2 className="text-2xl text-center text-gray-800 m-0 font-bold">注册</h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">用户名 <span className="text-red-500 ml-0.5">*</span></label>
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
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">邮箱 <span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white text-gray-800"
              placeholder="请输入邮箱"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">姓名 <span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              placeholder="请输入真实姓名"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">密码 <span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              placeholder="请输入密码（至少6位）"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">确认密码 <span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
              placeholder="请再次输入密码"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-gray-600">角色 <span className="text-red-500 ml-0.5">*</span></label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="px-3 py-3 border border-gray-300 rounded-md text-sm w-full box-border bg-gray-50 cursor-pointer text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
            >
              {availableRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-500 mt-1">
              {availableRoles.find(r => r.value === formData.role)?.desc}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm text-center -my-2">{error}</p>}
          <button
            type="submit"
            className="bg-indigo-500 text-white border-none px-3 py-3 rounded-md text-sm font-bold cursor-pointer transition-colors duration-200 w-full mt-2 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="text-center mt-5 text-sm text-gray-600">
          已有账号？<a href="/login" className="text-indigo-500 no-underline font-bold">立即登录</a>
        </p>
        <p className="text-center mt-2.5 text-sm text-gray-600">
          有问题？<span className="text-indigo-500 cursor-pointer font-bold" onClick={() => setShowContactModal(true)}>联系我</span>
        </p>
      </div>

      {/* 联系我对话框 */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-xl w-11/12 max-w-md shadow-lg">
            <h3 className="text-xl mb-5 text-center text-gray-800">联系我</h3>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-600 mb-1">姓名 <span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="text"
                name="name"
                value={contactForm.name}
                onChange={handleContactChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                placeholder="请输入您的姓名"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-600 mb-1">邮箱 <span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="email"
                name="email"
                value={contactForm.email}
                onChange={handleContactChange}
                className={`w-full px-3 py-3 border rounded-md text-sm box-border bg-gray-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white ${
                  contactEmailError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="请输入您的邮箱"
              />
              {contactEmailError && <span className="text-red-500 text-xs mt-1 block">{contactEmailError}</span>}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-600 mb-1">留言 <span className="text-red-500 ml-0.5">*</span></label>
              <textarea
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                className="w-full px-3 py-3 border border-gray-300 rounded-md text-sm box-border bg-gray-50 resize-vertical font-sans focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                placeholder="请输入您想咨询的内容..."
                rows={4}
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                className="flex-1 bg-gray-100 text-gray-600 border-none px-3 py-3 rounded-md text-sm cursor-pointer"
                onClick={() => setShowContactModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="flex-1 bg-indigo-500 text-white border-none px-3 py-3 rounded-md text-sm cursor-pointer disabled:opacity-50"
                onClick={handleContactSubmit}
                disabled={contactLoading}
              >
                {contactLoading ? '提交中...' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default Register;
