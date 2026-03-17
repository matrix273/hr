import React, { useState } from 'react';
import axios from 'axios';

const Home = () => {
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [contactLoading, setContactLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  // 邮箱格式校验
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleContactChange = (e) => {
    const { name, value } = e.target;
    setContactForm({
      ...contactForm,
      [name]: value,
    });

    // 实时校验邮箱格式
    if (name === 'email') {
      if (value && !validateEmail(value)) {
        setEmailError('请输入有效的邮箱格式');
      } else {
        setEmailError('');
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
        setEmailError('');
      }
    } catch (err) {
      alert('提交失败，请稍后重试');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.title}>
            AI 简历筛选系统
          </h1>
          <p style={styles.subtitle}>
            基于大语言模型的智能简历筛选解决方案
          </p>
          <div style={styles.ctaButtons}>
            <button style={styles.primaryButton} onClick={() => window.location.href = '/login'}>
              登录
            </button>
            <button style={styles.secondaryButton}>
              了解更多
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={styles.features}>
        <h2 style={styles.sectionTitle}>核心功能</h2>
        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🔍</div>
            <h3 style={styles.featureTitle}>智能匹配</h3>
            <p style={styles.featureDescription}>
              基于向量检索和重排序模型，精准匹配职位要求
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🤖</div>
            <h3 style={styles.featureTitle}>AI 评估</h3>
            <p style={styles.featureDescription}>
              利用大语言模型进行深度简历分析和评估
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>⚡</div>
            <h3 style={styles.featureTitle}>高效处理</h3>
            <p style={styles.featureDescription}>
              支持批量处理，快速筛选大量简历
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🔒</div>
            <h3 style={styles.featureTitle}>安全可靠</h3>
            <p style={styles.featureDescription}>
              RBAC 权限控制，保障数据安全
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section style={styles.useCases}>
        <h2 style={styles.sectionTitle}>应用场景</h2>
        <div style={styles.useCaseGrid}>
          <div style={styles.useCaseCard}>
            <h3 style={styles.useCaseTitle}>企业招聘</h3>
            <p style={styles.useCaseDescription}>
              大规模简历筛选，快速找到合适候选人
            </p>
          </div>
          <div style={styles.useCaseCard}>
            <h3 style={styles.useCaseTitle}>猎头服务</h3>
            <p style={styles.useCaseDescription}>
              精准匹配候选人，提升推荐质量
            </p>
          </div>
          <div style={styles.useCaseCard}>
            <h3 style={styles.useCaseTitle}>HR 部门</h3>
            <p style={styles.useCaseDescription}>
              自动化筛选流程，减少人工工作量
            </p>
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section style={styles.techStack}>
        <h2 style={styles.sectionTitle}>技术栈</h2>
        <div style={styles.techGrid}>
          <div style={styles.techItem}>
            <strong style={styles.techItemTitle}>AI 模型</strong>
            <p style={styles.techItemText}>Qwen3-Embedding / Qwen3-Reranker</p>
          </div>
          <div style={styles.techItem}>
            <strong style={styles.techItemTitle}>向量数据库</strong>
            <p style={styles.techItemText}>Milvus</p>
          </div>
          <div style={styles.techItem}>
            <strong style={styles.techItemTitle}>后端</strong>
            <p style={styles.techItemText}>FastAPI / Python</p>
          </div>
          <div style={styles.techItem}>
            <strong style={styles.techItemTitle}>前端</strong>
            <p style={styles.techItemText}>React / Vite</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <h2 style={styles.ctaTitle}>立即开始使用</h2>
        <p style={styles.ctaDescription}>
          注册账号，体验智能简历筛选的强大功能
        </p>
        <button style={styles.ctaButton} onClick={() => window.location.href = '/login'}>
          立即登录
        </button>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p>&copy; 2025 AI 简历筛选系统. All rights reserved.</p>
        <p style={styles.contactLink} onClick={() => setShowContactModal(true)}>
          联系我
        </p>
      </footer>

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
                  borderColor: emailError ? '#e74c3c' : '#ddd',
                }}
                placeholder="请输入您的邮箱"
              />
              {emailError && <span style={styles.emailError}>{emailError}</span>}
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  hero: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '120px 20px',
    textAlign: 'center',
  },
  heroContent: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  title: {
    fontSize: '48px',
    fontWeight: 'bold',
    marginBottom: '20px',
  },
  subtitle: {
    fontSize: '24px',
    marginBottom: '40px',
    opacity: 0.9,
  },
  ctaButtons: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '15px 40px',
    fontSize: '18px',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: 'white',
    border: '2px solid white',
    padding: '13px 38px',
    fontSize: '18px',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  features: {
    padding: '80px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: '36px',
    textAlign: 'center',
    marginBottom: '60px',
    color: '#333',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '30px',
  },
  featureCard: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    transition: 'transform 0.2s',
  },
  featureIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  featureTitle: {
    fontSize: '24px',
    marginBottom: '15px',
    color: '#333',
  },
  featureDescription: {
    color: '#666',
    lineHeight: '1.6',
  },
  useCases: {
    backgroundColor: 'white',
    padding: '80px 20px',
  },
  useCaseGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '30px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  useCaseCard: {
    padding: '30px',
    borderLeft: '4px solid #667eea',
  },
  useCaseTitle: {
    fontSize: '24px',
    marginBottom: '15px',
    color: '#333',
  },
  useCaseDescription: {
    color: '#666',
    lineHeight: '1.6',
  },
  techStack: {
    padding: '80px 20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  techGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '30px',
  },
  techItem: {
    textAlign: 'center',
  },
  techItemText: {
    color: '#333',
    fontSize: '16px',
    marginTop: '8px',
    fontWeight: '500',
  },
  techItemTitle: {
    color: '#222',
    fontSize: '18px',
    fontWeight: 'bold',
  },
  ctaSection: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '80px 20px',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: '36px',
    marginBottom: '20px',
  },
  ctaDescription: {
    fontSize: '18px',
    marginBottom: '40px',
    opacity: 0.9,
  },
  ctaButton: {
    backgroundColor: 'white',
    color: '#667eea',
    border: 'none',
    padding: '15px 50px',
    fontSize: '20px',
    fontWeight: 'bold',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  footer: {
    backgroundColor: '#333',
    color: 'white',
    textAlign: 'center',
    padding: '30px 20px',
  },
  contactLink: {
    marginTop: '15px',
    cursor: 'pointer',
    color: '#667eea',
    fontSize: '18px',
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
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
    marginBottom: '6px',
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
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    resize: 'vertical',
    fontFamily: 'inherit',
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

export default Home;
