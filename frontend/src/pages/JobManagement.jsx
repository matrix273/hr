import React, { useState } from 'react';
import api from '../utils/api';

const JobManagement = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    requirements: '',
    experience_years: '',
    education: '',
    certifications: '',
    salary_range: '',
    location: ''
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let response;
      if (editingJob) {
        // 更新岗位
        response = await api.put(
          `/api/jobs/${editingJob.job_id}`,
          formData
        );
      } else {
        // 创建岗位
        response = await api.post(
          '/api/jobs/create',
          formData
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
    setFormData({
      title: job.title,
      description: job.description,
      requirements: job.requirements || '',
      experience_years: job.experience_years || '',
      education: job.education || '',
      certifications: job.certifications || '',
      salary_range: job.salary_range || '',
      location: job.location || ''
    });
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
    setFormData({
      title: '',
      description: '',
      requirements: '',
      experience_years: '',
      education: '',
      certifications: '',
      salary_range: '',
      location: ''
    });
  };

  React.useEffect(() => {
    fetchJobs();
  }, []);

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>岗位管理</h2>
        <div style={styles.headerButtons}>
          <button style={styles.refreshButton} onClick={fetchJobs}>
            刷新
          </button>
          <button
            style={styles.createButton}
            onClick={() => {
              setEditingJob(null);
              setFormData({
                title: '',
                description: '',
                requirements: '',
                experience_years: '',
                education: '',
                certifications: '',
                salary_range: '',
                location: ''
              });
              setShowForm(true);
            }}
          >
            新建岗位
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showForm && (
        <div style={styles.formContainer}>
          <div style={styles.formHeader}>
            <h3 style={styles.formTitle}>
              {editingJob ? '编辑岗位' : '新建岗位'}
            </h3>
            <button style={styles.closeButton} onClick={handleCloseForm}>
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>岗位标题 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                style={styles.input}
                placeholder="请输入岗位标题"
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>岗位描述 *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                style={styles.textarea}
                placeholder="请输入岗位描述"
                rows={6}
                required
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>岗位要求</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                style={styles.textarea}
                placeholder="请输入岗位要求"
                rows={4}
              />
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>工作经验（年）</label>
                <input
                  type="number"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                  style={styles.input}
                  placeholder="例如：3"
                  min="0"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>学历要求</label>
                <select
                  value={formData.education}
                  onChange={(e) => setFormData({...formData, education: e.target.value})}
                  style={styles.input}
                >
                  <option value="">请选择</option>
                  <option value="不限">不限</option>
                  <option value="高中">高中</option>
                  <option value="大专">大专</option>
                  <option value="本科">本科</option>
                  <option value="硕士">硕士</option>
                  <option value="博士">博士</option>
                </select>
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>资格证书</label>
              <textarea
                value={formData.certifications}
                onChange={(e) => setFormData({...formData, certifications: e.target.value})}
                style={styles.textarea}
                placeholder="请输入要求的资格证书，例如：PMP认证、CPA证书等"
                rows={3}
              />
            </div>
            <div style={styles.formRow}>
              <div style={styles.formGroup}>
                <label style={styles.label}>薪资范围</label>
                <input
                  type="text"
                  value={formData.salary_range}
                  onChange={(e) => setFormData({...formData, salary_range: e.target.value})}
                  style={styles.input}
                  placeholder="例如：15K-25K"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>工作地点</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  style={styles.input}
                  placeholder="例如：北京、上海"
                />
              </div>
            </div>
            <div style={styles.formActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={handleCloseForm}
              >
                取消
              </button>
              <button type="submit" style={styles.submitButton}>
                {editingJob ? '更新' : '创建'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={styles.content}>
        <div style={styles.listContainer}>
          <h3 style={styles.listTitle}>岗位列表 ({jobs.length})</h3>

          {jobs.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>💼</div>
              <p style={styles.emptyText}>暂无岗位</p>
            </div>
          ) : (
            <div style={styles.jobList}>
              {jobs.map((job) => (
                <div key={job.job_id} style={styles.jobItem}>
                  <div style={styles.jobMain}>
                    <div style={styles.jobIcon}>💼</div>
                    <div style={styles.jobInfo}>
                      <div style={styles.jobTitle}>{job.title}</div>
                      <div style={styles.jobMeta}>
                        {job.location && (
                          <>
                            <span style={styles.metaItem}>📍 {job.location}</span>
                            <span style={styles.metaSeparator}>•</span>
                          </>
                        )}
                        {job.salary_range && (
                          <>
                            <span style={styles.metaItem}>💰 {job.salary_range}</span>
                            <span style={styles.metaSeparator}>•</span>
                          </>
                        )}
                        {job.experience_years && (
                          <>
                            <span style={styles.metaItem}>📅 {job.experience_years}年经验</span>
                            <span style={styles.metaSeparator}>•</span>
                          </>
                        )}
                        {job.education && (
                          <>
                            <span style={styles.metaItem}>🎓 {job.education}</span>
                            <span style={styles.metaSeparator}>•</span>
                          </>
                        )}
                        <span style={styles.metaItem}>{formatDate(job.created_at)}</span>
                      </div>
                      <div style={styles.jobDescription}>
                        {job.description.substring(0, 200)}...
                      </div>
                    </div>
                  </div>
                  <div style={styles.actionButtons}>
                    <button
                      style={styles.editButton}
                      onClick={() => handleEdit(job)}
                    >
                      编辑
                    </button>
                    <button
                      style={styles.deleteButton}
                      onClick={() => handleDelete(job.job_id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButtons: {
    display: 'flex',
    gap: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  createButton: {
    padding: '8px 16px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#999',
  },
  error: {
    padding: '12px 16px',
    backgroundColor: '#fee',
    color: '#e74c3c',
    borderRadius: '6px',
    fontSize: '14px',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '24px',
  },
  formHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  closeButton: {
    backgroundColor: '#f5f5f5',
    border: 'none',
    borderRadius: '4px',
    width: '32px',
    height: '32px',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
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
  textarea: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '8px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f5f5f5',
    color: '#333',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  content: {
    display: 'flex',
    gap: '24px',
    minHeight: '600px',
  },
  listContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '24px',
  },
  listTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '20px',
  },
  empty: {
    textAlign: 'center',
    padding: '64px 32px',
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#999',
  },
  jobList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  jobItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  jobMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  jobIcon: {
    fontSize: '32px',
  },
  jobInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  jobTitle: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#333',
  },
  jobMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#999',
  },
  metaItem: {
    fontSize: '13px',
  },
  metaSeparator: {
    color: '#ddd',
  },
  jobDescription: {
    fontSize: '13px',
    color: '#666',
    marginTop: '8px',
    lineHeight: '1.4',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  editButton: {
    padding: '6px 12px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
  deleteButton: {
    padding: '6px 12px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
  },
};

export default JobManagement;
