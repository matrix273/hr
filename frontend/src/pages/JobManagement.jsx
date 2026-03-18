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
    return <div className="text-center py-12 text-gray-500">加载中...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* 头部 */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">岗位管理</h2>
        <div className="flex gap-3">
          <button 
            className="btn-primary"
            onClick={fetchJobs}
          >
            刷新
          </button>
          <button
            className="btn-success"
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

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 表单弹窗 */}
      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-300">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-xl font-bold text-gray-800">
              {editingJob ? '编辑岗位' : '新建岗位'}
            </h3>
            <button 
              className="w-8 h-8 bg-gray-600 text-white rounded flex items-center justify-center hover:bg-gray-700 transition-colors"
              onClick={handleCloseForm}
            >
              ✕
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 岗位标题 */}
            <div className="flex flex-col gap-2">
              <label className="form-label">岗位标题 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="form-input"
                placeholder="请输入岗位标题"
                required
              />
            </div>

            {/* 岗位描述 */}
            <div className="flex flex-col gap-2">
              <label className="form-label">岗位描述 *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="form-textarea"
                placeholder="请输入岗位描述"
                rows={6}
                required
              />
            </div>

            {/* 岗位要求 */}
            <div className="flex flex-col gap-2">
              <label className="form-label">岗位要求</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({...formData, requirements: e.target.value})}
                className="form-textarea"
                placeholder="请输入岗位要求"
                rows={4}
              />
            </div>

            {/* 工作经验 & 学历要求 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="form-label">工作经验（年）</label>
                <input
                  type="number"
                  value={formData.experience_years}
                  onChange={(e) => setFormData({...formData, experience_years: e.target.value})}
                  className="form-input"
                  placeholder="例如：3"
                  min="0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="form-label">学历要求</label>
                <select
                  value={formData.education}
                  onChange={(e) => setFormData({...formData, education: e.target.value})}
                  className="form-select"
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

            {/* 资格证书 */}
            <div className="flex flex-col gap-2">
              <label className="form-label">资格证书</label>
              <textarea
                value={formData.certifications}
                onChange={(e) => setFormData({...formData, certifications: e.target.value})}
                className="form-textarea"
                placeholder="请输入要求的资格证书，例如：PMP认证、CPA证书等"
                rows={3}
              />
            </div>

            {/* 薪资范围 & 工作地点 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="form-label">薪资范围</label>
                <input
                  type="text"
                  value={formData.salary_range}
                  onChange={(e) => setFormData({...formData, salary_range: e.target.value})}
                  className="form-input"
                  placeholder="例如：15K-25K"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="form-label">工作地点</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="form-input"
                  placeholder="例如：北京、上海"
                />
              </div>
            </div>

            {/* 表单操作按钮 */}
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseForm}
              >
                取消
              </button>
              <button type="submit" className="btn-primary">
                {editingJob ? '更新' : '创建'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 岗位列表 */}
      <div className="flex gap-6 min-h-[600px]">
        <div className="flex-1 card p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-5">
            岗位列表 ({jobs.length})
          </h3>

          {jobs.length === 0 ? (
            <div className="text-center py-16 px-8">
              <div className="text-6xl mb-4">💼</div>
              <p className="text-gray-500 text-lg">暂无岗位</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => (
                <div 
                  key={job.job_id} 
                  className="flex justify-between items-center p-4 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">💼</div>
                    <div className="flex flex-col gap-1">
                      <div className="text-gray-800 font-medium">{job.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        {job.location && (
                          <>
                            <span>📍 {job.location}</span>
                            <span className="text-gray-400">•</span>
                          </>
                        )}
                        {job.salary_range && (
                          <>
                            <span>💰 {job.salary_range}</span>
                            <span className="text-gray-400">•</span>
                          </>
                        )}
                        {job.experience_years && (
                          <>
                            <span>📅 {job.experience_years}年经验</span>
                            <span className="text-gray-400">•</span>
                          </>
                        )}
                        {job.education && (
                          <>
                            <span>🎓 {job.education}</span>
                            <span className="text-gray-400">•</span>
                          </>
                        )}
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {job.description.substring(0, 200)}...
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      className="btn-success px-4 py-1.5 text-xs whitespace-nowrap"
                      onClick={() => handleEdit(job)}
                    >
                      编辑
                    </button>
                    <button
                      className="btn-danger px-4 py-1.5 text-xs whitespace-nowrap"
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

export default JobManagement;
