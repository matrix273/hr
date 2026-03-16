import React from 'react';

const Home = () => {
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
            <strong>AI 模型</strong>
            <p>Qwen3-Embedding / Qwen3-Reranker</p>
          </div>
          <div style={styles.techItem}>
            <strong>向量数据库</strong>
            <p>Milvus</p>
          </div>
          <div style={styles.techItem}>
            <strong>后端</strong>
            <p>FastAPI / Python</p>
          </div>
          <div style={styles.techItem}>
            <strong>前端</strong>
            <p>React / Vite</p>
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
      </footer>
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
};

export default Home;
