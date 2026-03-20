import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Permission, 
  hasPermission, 
  getButtonStyle, 
  isButtonDisabled,
  shouldShowElement,
  getPermissionHint 
} from '../utils/permissions';
import { Typography } from 'antd';

const { Title } = Typography;

const ResumeList = ({ onUploadSuccess }) => {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewResume, setPreviewResume] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedResumes, setSelectedResumes] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const getEmbeddingStatus = (status) => {
    switch (status) {
      case 'pending':
        return { text: '等待处理', color: '#f39c12', icon: '⏳' };
      case 'processing':
        return { text: '处理中...', color: '#3498db', icon: '🔄' };
      case 'completed':
        return { text: '已完成', color: '#2ecc71', icon: '✅' };
      case 'failed':
        return { text: '处理失败', color: '#e74c3c', icon: '❌' };
      default:
        return { text: '未知', color: '#95a5a6', icon: '❓' };
    }
  };

  // 检查是否有正在处理的简历
  const hasProcessingResumes = () => {
    return resumes.some(r => r.embedding_status === 'pending' || r.embedding_status === 'processing');
  };

  const fetchResumes = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get('/api/resumes/list');

      if (response.data.success) {
        setResumes(response.data.resumes);
      } else {
        setError('获取简历列表失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '获取简历列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumes();
  }, []);

  // 自动刷新处理中的简历状态
  useEffect(() => {
    if (!hasProcessingResumes()) return;

    const interval = setInterval(() => {
      fetchResumes();
    }, 3000); // 每 3 秒刷新一次

    return () => clearInterval(interval);
  }, [resumes]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && previewResume) {
        handleClosePreview();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [previewResume]);

  const handleDelete = async (resumeId) => {
    if (!window.confirm('确定要删除这个简历吗？')) {
      return;
    }

    try {
      const response = await api.delete(`/api/resumes/${resumeId}`);

      if (response.data.success) {
        setResumes(resumes.filter(r => r.resume_id !== resumeId));
      } else {
        setError('删除失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '删除失败');
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedResumes([]);
    } else {
      setSelectedResumes(resumes.map(r => r.resume_id));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectResume = (resumeId) => {
    if (selectedResumes.includes(resumeId)) {
      setSelectedResumes(selectedResumes.filter(id => id !== resumeId));
    } else {
      setSelectedResumes([...selectedResumes, resumeId]);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedResumes.length === 0) {
      setError('请先选择要删除的简历');
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedResumes.length} 个简历吗？`)) {
      return;
    }

    try {
      const response = await api.post('/api/resumes/batch-delete', {
        resume_ids: selectedResumes
      });

      if (response.data.success) {
        setResumes(resumes.filter(r => !selectedResumes.includes(r.resume_id)));
        setSelectedResumes([]);
        setSelectAll(false);
      } else {
        setError('批量删除失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '批量删除失败');
    }
  };

  const handleView = async (resume) => {
    // 获取 PDF 文件并转换为 blob URL
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:8000/api/resumes/${resume.resume_id}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewResume(resume);
      } else if (response.status === 401) {
        // Token 失效，自动跳转到登录页
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else {
        setError('加载简历失败');
      }
    } catch (err) {
      setError('加载简历失败');
    }
  };

  const handleClosePreview = () => {
    setPreviewResume(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const truncateText = (text, maxLength = 200) => {
    if (text && text.length > maxLength) {
      return text.substring(0, maxLength) + '...';
    }
    return text || '';
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (loading) {
    return <div style={styles.loading}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Title level={2} style={{ margin: 0, color: '#262626' }}>简历管理</Title>
        <div style={styles.headerActions}>
          {shouldShowElement(Permission.RESUME_DELETE) && selectedResumes.length > 0 && (
            <button 
              style={getButtonStyle(Permission.RESUME_DELETE, styles.batchDeleteButton)}
              onClick={handleBatchDelete}
              disabled={isButtonDisabled(Permission.RESUME_DELETE)}
              title={getPermissionHint(Permission.RESUME_DELETE)}
            >
              删除选中 ({selectedResumes.length})
            </button>
          )}
          {shouldShowElement(Permission.RESUME_READ) && (
            <button 
              style={getButtonStyle(Permission.RESUME_READ, styles.refreshButton)}
              onClick={fetchResumes}
              disabled={isButtonDisabled(Permission.RESUME_READ)}
              title={getPermissionHint(Permission.RESUME_READ)}
            >
              刷新
            </button>
          )}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.content}>
        <div style={styles.listContainer}>
          <div style={styles.listHeader}>
            <h3 style={styles.listTitle}>简历列表 ({resumes.length})</h3>
            {shouldShowElement(Permission.RESUME_DELETE) && resumes.length > 0 && (
              <div style={styles.selectAllLabel} onClick={handleSelectAll}>
                <div
                  style={{
                    ...styles.customCheckbox,
                    ...(selectAll ? styles.customCheckboxChecked : {})
                  }}
                >
                  {selectAll && '✓'}
                </div>
                全选
              </div>
            )}
          </div>

          {resumes.length === 0 ? (
            <div style={styles.empty}>
              <div style={styles.emptyIcon}>📭</div>
              <p style={styles.emptyText}>暂无上传的简历</p>
            </div>
          ) : (
            <div style={styles.resumeList}>
              {resumes.map((resume) => (
                <div
                  key={resume.resume_id}
                  style={{
                    ...styles.resumeItem,
                    ...(selectedResumes.includes(resume.resume_id) ? styles.resumeItemSelected : {})
                  }}
                >
                  <div style={styles.resumeMain}>
                    {shouldShowElement(Permission.RESUME_DELETE) && (
                      <div
                        style={{
                          ...styles.customCheckbox,
                          ...(selectedResumes.includes(resume.resume_id) ? styles.customCheckboxChecked : {})
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectResume(resume.resume_id);
                        }}
                      >
                        {selectedResumes.includes(resume.resume_id) && '✓'}
                      </div>
                    )}
                    <div style={styles.resumeIcon}>📄</div>
                    <div style={styles.resumeInfo}>
                      <div style={styles.resumeName}>{resume.filename}</div>
                      <div style={styles.resumeMeta}>
                        <span style={styles.metaItem}>{formatSize(resume.size)}</span>
                        <span style={styles.metaSeparator}>•</span>
                        <span style={styles.metaItem}>{formatDate(resume.created_at)}</span>
                      </div>
                      <div style={styles.embeddingStatus}>
                        <span style={styles.statusIcon}>{getEmbeddingStatus(resume.embedding_status).icon}</span>
                        <span style={{ ...styles.statusText, color: getEmbeddingStatus(resume.embedding_status).color }}>
                          {getEmbeddingStatus(resume.embedding_status).text}
                        </span>
                      </div>
                      <div style={styles.resumePreview}>
                        {truncateText(resume.resume_text)}
                      </div>
                    </div>
                  </div>
                  <div style={styles.actionButtons}>
                    {shouldShowElement(Permission.RESUME_READ) && (
                      <button
                        style={getButtonStyle(Permission.RESUME_READ, styles.viewButton)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(resume);
                        }}
                        disabled={isButtonDisabled(Permission.RESUME_READ)}
                        title={getPermissionHint(Permission.RESUME_READ)}
                      >
                        查看
                      </button>
                    )}
                    {shouldShowElement(Permission.RESUME_DELETE) && (
                      <button
                        style={getButtonStyle(Permission.RESUME_DELETE, styles.deleteButton)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(resume.resume_id);
                        }}
                        disabled={isButtonDisabled(Permission.RESUME_DELETE)}
                        title={getPermissionHint(Permission.RESUME_DELETE)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF 预览模态框 */}
      {previewResume && (
        <div style={styles.modalOverlay} onClick={handleClosePreview}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{previewResume.filename}</h3>
              <button style={styles.closeButton} onClick={handleClosePreview}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  style={styles.pdfFrame}
                  title="PDF 预览"
                  type="application/pdf"
                />
              ) : (
                <div style={styles.loading}>加载中...</div>
              )}
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
    flexDirection: 'column',
    gap: '16px',
    minHeight: '100vh',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
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
  batchDeleteButton: {
    padding: '8px 16px',
    backgroundColor: '#e74c3c',
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
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  listTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  selectAllLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
  },
  customCheckbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d0d0d0',
    backgroundColor: 'white',
  },
  customCheckboxChecked: {
    backgroundColor: '#667eea',
    color: 'white',
    borderColor: '#667eea',
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
  resumeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resumeItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    transition: 'all 0.2s',
  },
  resumeItemSelected: {
    backgroundColor: '#f0f7ff',
    borderColor: '#667eea',
  },
  resumeMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  resumeIcon: {
    fontSize: '32px',
  },
  resumeInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  resumeName: {
    fontSize: '15px',
    fontWeight: '500',
    color: '#333',
  },
  resumeMeta: {
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
  resumePreview: {
    fontSize: '13px',
    color: '#666',
    marginTop: '8px',
    lineHeight: '1.4',
    maxWidth: '600px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
  },
  embeddingStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
    marginTop: '4px',
  },
  statusIcon: {
    fontSize: '14px',
  },
  statusText: {
    fontWeight: '500',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
  },
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'backgroundColor 0.2s',
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
    transition: 'backgroundColor 0.2s',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    color: '#999',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
    ':hover': {
      color: '#333',
    },
  },
  modalBody: {
    flex: 1,
    padding: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  pdfFrame: {
    width: '100%',
    height: 'calc(90vh - 80px)',
    border: 'none',
    borderRadius: '4px',
  },
};

export default ResumeList;
