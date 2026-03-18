import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Container,
  Grid,
  Modal,
  TextField,
  Stack,
  Paper,
  IconButton
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Search as SearchIcon,
  SmartToy as AIIcon,
  Bolt as BoltIcon,
  Security as SecurityIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  Work as WorkIcon,
  ContactMail as ContactIcon
} from '@mui/icons-material';

// 样式化组件
const GradientButton = styled(Button)(({ theme }) => ({
  background: 'linear-gradient(45deg, #4f46e5 30%, #7c3aed 90%)',
  color: 'white',
  fontWeight: 'bold',
  padding: '12px 32px',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '16px',
  '&:hover': {
    background: 'linear-gradient(45deg, #4338ca 30%, #6d28d9 90%)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.3)',
  },
  transition: 'all 0.3s ease',
}));

const OutlineButton = styled(Button)(({ theme }) => ({
  border: '2px solid white',
  color: 'white',
  fontWeight: 'bold',
  padding: '10px 28px',
  borderRadius: '8px',
  textTransform: 'none',
  fontSize: '16px',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '2px solid white',
    transform: 'translateY(-2px)',
  },
  transition: 'all 0.3s ease',
}));

const FeatureCard = styled(Card)(({ theme }) => ({
  height: '100%',
  borderRadius: '16px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.3s ease',
  '&:hover': {
    transform: 'translateY(-8px)',
    boxShadow: '0 12px 40px rgba(99, 102, 241, 0.15)',
  },
}));

const HeroSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  color: 'white',
  padding: '120px 0',
  textAlign: 'center',
}));

const Section = styled(Box)(({ theme }) => ({
  padding: '80px 0',
}));

const Home = () => {
  const navigate = useNavigate();
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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <HeroSection>
        <Container maxWidth="lg">
          <Typography variant="h1" sx={{ 
            fontSize: { xs: '2.5rem', md: '3.5rem' }, 
            fontWeight: 'bold', 
            mb: 3 
          }}>
            AI 简历筛选系统
          </Typography>
          <Typography variant="h5" sx={{ 
            mb: 6, 
            opacity: 0.9, 
            fontSize: { xs: '1.2rem', md: '1.5rem' }
          }}>
            基于大语言模型的智能简历筛选解决方案
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="center">
            <GradientButton 
              startIcon={<SearchIcon />}
              onClick={() => window.location.href = '/login'}
              size="large"
            >
              立即登录
            </GradientButton>
            <OutlineButton 
              startIcon={<ContactIcon />}
              onClick={() => navigate('/help')}
              size="large"
            >
              了解更多
            </OutlineButton>
          </Stack>
        </Container>
      </HeroSection>

      {/* Features Section */}
      <Section>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ mb: 8, fontWeight: 'bold', color: 'text.primary' }}>
            核心功能
          </Typography>
          <Grid container spacing={4} justifyContent="center" alignItems="stretch">
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <SearchIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, mx: 'auto' }} />
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                    智能匹配
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {`基于向量检索和重排序模型
精准匹配职位要求`}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <AIIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, mx: 'auto' }} />
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                    AI 评估
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {`利用大语言模型进行
深度简历分析和评估`}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <BoltIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, mx: 'auto' }} />
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                    高效处理
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {`支持批量处理
快速筛选大量简历`}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FeatureCard sx={{ height: '100%' }}>
                <CardContent sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <SecurityIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2, mx: 'auto' }} />
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                    安全可靠
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {`RBAC 权限控制
保障数据安全`}
                  </Typography>
                </CardContent>
              </FeatureCard>
            </Grid>
          </Grid>
        </Container>
      </Section>

      {/* Use Cases Section */}
      <Section sx={{ bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ 
            mb: 8, 
            fontWeight: 'bold', 
            color: 'text.primary',
            fontSize: { xs: '2rem', md: '2.5rem' }
          }}>
            应用场景
          </Typography>
          <Grid container spacing={4} justifyContent="center" alignItems="stretch">
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, borderLeft: 4, borderColor: 'primary.main', height: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <BusinessIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2, mx: 'auto' }} />
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                  企业招聘
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  大规模简历筛选，快速找到合适候选人
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, borderLeft: 4, borderColor: 'primary.main', height: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2, mx: 'auto' }} />
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                  猎头服务
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  精准匹配候选人，提升推荐质量
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 4, borderLeft: 4, borderColor: 'primary.main', height: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <WorkIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2, mx: 'auto' }} />
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                  HR 部门
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  自动化筛选流程，减少人工工作量
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Section>

      {/* Technology Stack Section */}
      <Section>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ 
            mb: 8, 
            fontWeight: 'bold', 
            color: 'text.primary',
            fontSize: { xs: '2rem', md: '2.5rem' }
          }}>
            技术栈
          </Typography>
          <Grid container spacing={4} justifyContent="center" alignItems="stretch">
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
                  AI 模型
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ color: 'grey.700' }}>
                  Qwen3-Embedding / Qwen3-Reranker
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
                  向量数据库
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ color: 'grey.700' }}>
                  Milvus
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
                  后端
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ color: 'grey.700' }}>
                  FastAPI / Python
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: 'text.primary' }}>
                  前端
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ color: 'grey.700' }}>
                  React / Vite
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Section>

      {/* CTA Section */}
      <HeroSection>
        <Container maxWidth="md">
          <Typography variant="h3" align="center" sx={{ mb: 3, fontWeight: 'bold' }}>
            立即开始使用
          </Typography>
          <Typography variant="h6" align="center" sx={{ mb: 5, opacity: 0.9 }}>
            注册账号，体验智能简历筛选的强大功能
          </Typography>
          <Box sx={{ textAlign: 'center' }}>
            <GradientButton 
              size="large"
              onClick={() => window.location.href = '/login'}
              sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
            >
              立即登录
            </GradientButton>
          </Box>
        </Container>
      </HeroSection>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.900', color: 'white', py: 6, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          &copy; 2025 AI 简历筛选系统. All rights reserved.
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'primary.main', 
            cursor: 'pointer', 
            fontWeight: 'bold',
            '&:hover': { textDecoration: 'underline' }
          }}
          onClick={() => setShowContactModal(true)}
        >
          联系我
        </Typography>
      </Box>

      {/* 联系我对话框 */}
      <Modal
        open={showContactModal}
        onClose={() => setShowContactModal(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Paper sx={{ p: 4, maxWidth: 400, width: '90%', mx: 'auto' }}>
          <Typography variant="h5" align="center" sx={{ mb: 3, fontWeight: 'bold' }}>
            联系我
          </Typography>
          <Stack spacing={3}>
            <TextField
              label="姓名"
              name="name"
              value={contactForm.name}
              onChange={handleContactChange}
              required
              fullWidth
              variant="outlined"
            />
            <TextField
              label="邮箱"
              name="email"
              type="email"
              value={contactForm.email}
              onChange={handleContactChange}
              error={!!emailError}
              helperText={emailError}
              required
              fullWidth
              variant="outlined"
            />
            <TextField
              label="留言"
              name="message"
              value={contactForm.message}
              onChange={handleContactChange}
              required
              multiline
              rows={4}
              fullWidth
              variant="outlined"
            />
            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={() => setShowContactModal(false)}
                sx={{ py: 1.5 }}
              >
                取消
              </Button>
              <Button 
                variant="contained" 
                fullWidth 
                onClick={handleContactSubmit}
                disabled={contactLoading}
                sx={{ py: 1.5 }}
              >
                {contactLoading ? '提交中...' : '提交'}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Modal>
    </Box>
  );
};



export default Home;
