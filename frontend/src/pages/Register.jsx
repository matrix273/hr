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
    <div style={styles.container}>
      <div style={styles.registerBox}>
        <div style={styles.header}>
          <button 
            type="button" 
            style={styles.backButton} 
            onClick={() => navigate('/')}
          >
            ← 返回
          </button>
          <h2 style={styles.title}>注册</h2>
          <div style={{ width: '60px' }}></div>
        </div>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.label}>用户名 <span style={styles.required}>*</span></label>
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
            <label style={styles.label}>邮箱 <span style={styles.required}>*</span></label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              placeholder="请输入邮箱"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>姓名 <span style={styles.required}>*</span></label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              style={styles.input}
              placeholder="请输入真实姓名"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>密码 <span style={styles.required}>*</span></label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              placeholder="请输入密码（至少6位）"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>确认密码 <span style={styles.required}>*</span></label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              style={styles.input}
              placeholder="请再次输入密码"
              required
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>角色 <span style={styles.required}>*</span></label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={styles.select}
            >
              {availableRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <div style={styles.roleHint}>
              {availableRoles.find(r => r.value === formData.role)?.desc}
            </div>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button
            type="submit"
            style={styles.submitButton}
            disabled={loading}
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p style={styles.loginHint}>
          已有账号？<a href="/login" style={styles.link}>立即登录</a>
        </p>
        <p style={styles.contactHint}>
          有问题？<span style={styles.contactLink} onClick={() => setShowContactModal(true)}>联系我</span>
        </p>
      </div>

      {/* 联系我对话框 */}
      {showContactModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>联系我</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>姓名 <span style={styles.required}>*</span></label>
              <input
                type="text"
                name="name"
                value={contactForm.name}
                onChange={handleContactChange}
                style={styles.input}
                placeholder="请输入您的姓名"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>邮箱 <span style={styles.required}>*</span></label>
              <input
                type="email"
                name="email"
                value={contactForm.email}
                onChange={handleContactChange}
                style={{
                  ...styles.input,
                  borderColor: contactEmailError ? '#e74c3c' : '#ddd',
                }}
                placeholder="请输入您的邮箱"
              />
              {contactEmailError && <span style={styles.emailError}>{contactEmailError}</span>}
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>留言 <span style={styles.required}>*</span></label>
              <textarea
                name="message"
                value={contactForm.message}
                onChange={handleContactChange}
                style={styles.textarea}
                placeholder="请输入您想咨询的内容..."
                rows={4}
              />
            </div>
            <div style={styles.modalButtons}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setShowContactModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                style={styles.confirmButton}
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
  registerBox: {
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
    marginBottom: '20px',
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
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
  },
  required: {
    color: '#e74c3c',
  },
  emailError: {
    color: '#e74c3c',
    fontSize: '12px',
    marginTop: '4px',
    display: 'block',
  },
  input: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'white',
    cursor: 'pointer',
    color: '#333', // 确保文本颜色可见
    outline: 'none',
  },
  textarea: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  roleHint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '4px',
  },
  error: {
    color: '#e74c3c',
    fontSize: '14px',
    textAlign: 'center',
    margin: '-8px 0',
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
    marginTop: '8px',
  },
  loginHint: {
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
  contactHint: {
    textAlign: 'center',
    marginTop: '10px',
    fontSize: '14px',
    color: '#666',
  },
  contactLink: {
    color: '#667eea',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  // 对话框样式
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '400px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  },
  modalTitle: {
    fontSize: '22px',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#333',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    color: '#666',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '16px',
    cursor: 'pointer',
  },
};

export default Register;
