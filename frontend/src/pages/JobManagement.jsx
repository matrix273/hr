import React, { useState } from 'react';
import api from '../utils/api';
import {
  Button,
  Card,
  Form,
  Input,
  Select,
  message,
  Modal,
  Space,
  Typography,
  Divider
} from 'antd';

const { Title, Text } = Typography;
const { TextArea } = Input;

const JobManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [form] = Form.useForm();

  const fetchJobs = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/api/jobs/list');

      if (response.data.success) {
        setJobs(response.data.jobs);
      } else {
        setError('获取岗位列表失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '获取岗位列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    setError('');

    try {
      let response;
      if (editingJob) {
        // 更新岗位
        response = await api.put(
          `/api/jobs/${editingJob.job_id}`,
          values
        );
      } else {
        // 创建岗位
        response = await api.post(
          '/api/jobs/create',
          values
        );
      }

      if (response.data.success) {
        handleCloseForm();
        fetchJobs();
      } else {
        setError('操作失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '操作失败');
    }
  };

  const handleEdit = (job) => {
    setEditingJob(job);
    const jobData = {
      title: job.title,
      description: job.description,
      requirements: job.requirements || '',
      experience_years: job.experience_years || '',
      education: job.education || '',
      certifications: job.certifications || '',
      salary_range: job.salary_range || '',
      location: job.location || ''
    };
    form.setFieldsValue(jobData); // 设置表单值
    setShowForm(true);
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('确定要删除这个岗位吗？')) {
      return;
    }

    try {
      const response = await api.delete(`/api/jobs/${jobId}`);

      if (response.data.success) {
        setJobs(jobs.filter(j => j.job_id !== jobId));
      } else {
        setError('删除失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '删除失败');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingJob(null);
    form.resetFields(); // 重置表单
  };

  React.useEffect(() => {
    fetchJobs();
  }, []);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
        加载中...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* 头部 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <Title level={2} style={{ margin: 0, color: '#262626' }}>
          岗位管理
        </Title>
        <Space>
          <Button 
            type="primary"
            onClick={fetchJobs}
          >
            刷新
          </Button>
          <Button
            type="primary"
            style={{ background: '#10b981', borderColor: '#10b981' }}
            onClick={() => {
              setEditingJob(null);
              form.resetFields();
              setShowForm(true);
            }}
          >
            新建岗位
          </Button>
        </Space>
      </div>

      {/* 错误提示 */}
      {error && (
        <div style={{ 
          background: '#fff2f0', 
          border: '1px solid #ffccc7', 
          color: '#a8071a', 
          padding: '12px 16px', 
          borderRadius: '6px',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      {/* 表单弹窗 */}
      <Modal
        title={editingJob ? '编辑岗位' : '新建岗位'}
        open={showForm}
        onCancel={handleCloseForm}
        footer={null}
        width={600}
        transitionName=""
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          {/* 岗位标题 */}
          <Form.Item
            label="岗位标题"
            name="title"
            rules={[{ required: true, message: '请输入岗位标题' }]}
          >
            <Input
              placeholder="请输入岗位标题"
            />
          </Form.Item>

          {/* 岗位描述 */}
          <Form.Item
            label="岗位描述"
            name="description"
            rules={[{ required: true, message: '请输入岗位描述' }]}
          >
            <TextArea
              placeholder="请输入岗位描述"
              rows={6}
            />
          </Form.Item>

          {/* 岗位要求 */}
          <Form.Item
            label="岗位要求"
            name="requirements"
          >
            <TextArea
              placeholder="请输入岗位要求"
              rows={4}
            />
          </Form.Item>

          {/* 工作经验 & 学历要求 */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              label="工作经验（年）"
              name="experience_years"
              style={{ flex: 1 }}
            >
              <Input
                type="number"
                placeholder="例如：3"
                min="0"
              />
            </Form.Item>
            <Form.Item
              label="学历要求"
              name="education"
              style={{ flex: 1 }}
            >
              <Select
                placeholder="请选择"
              >
                <Select.Option value="">请选择</Select.Option>
                <Select.Option value="不限">不限</Select.Option>
                <Select.Option value="高中">高中</Select.Option>
                <Select.Option value="大专">大专</Select.Option>
                <Select.Option value="本科">本科</Select.Option>
                <Select.Option value="硕士">硕士</Select.Option>
                <Select.Option value="博士">博士</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {/* 资格证书 */}
          <Form.Item
            label="资格证书"
            name="certifications"
          >
            <TextArea
              placeholder="请输入要求的资格证书，例如：PMP认证、CPA证书等"
              rows={3}
            />
          </Form.Item>

          {/* 薪资范围 & 工作地点 */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <Form.Item
              label="薪资范围"
              name="salary_range"
              style={{ flex: 1 }}
            >
              <Input
                placeholder="例如：15K-25K"
              />
            </Form.Item>
            <Form.Item
              label="工作地点"
              name="location"
              style={{ flex: 1 }}
            >
              <Input
                placeholder="例如：北京、上海"
              />
            </Form.Item>
          </div>

          {/* 表单操作按钮 */}
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleCloseForm}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingJob ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 岗位列表 */}
      <Card
        title={`岗位列表 (${jobs.length})`}
        style={{ marginBottom: '24px' }}
      >
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>💼</div>
            <Text type="secondary" style={{ fontSize: '18px' }}>
              暂无岗位
            </Text>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {jobs.map((job) => (
              <Card 
                key={job.job_id}
                style={{ 
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px',
                  transition: 'all 0.3s'
                }}
                styles={{
                  body: { padding: '16px' }
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                    <div style={{ fontSize: '24px' }}>💼</div>
                    <div style={{ flex: 1 }}>
                      <Title level={4} style={{ margin: '0 0 8px 0' }}>
                        {job.title}
                      </Title>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontSize: '14px',
                        color: '#666',
                        marginBottom: '8px'
                      }}>
                        {job.location && <span>📍 {job.location}</span>}
                        {job.salary_range && <span>💰 {job.salary_range}</span>}
                        {job.experience_years && <span>📅 {job.experience_years}年经验</span>}
                        {job.education && <span>🎓 {job.education}</span>}
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      <Text type="secondary" style={{ fontSize: '14px', lineHeight: '1.5' }}>
                        {job.description.substring(0, 200)}...
                      </Text>
                    </div>
                  </div>
                  
                  <Space>
                    <Button
                      size="small"
                      style={{ background: '#10b981', borderColor: '#10b981' }}
                      onClick={() => handleEdit(job)}
                    >
                      编辑
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => handleDelete(job.job_id)}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default JobManagement;
