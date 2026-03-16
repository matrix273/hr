import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// localStorage key for saving screening config
const STORAGE_KEY = 'screening_config';

const Screening = () => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [selectedModel, setSelectedModel] = useState('qwen-plus');
  const [currentProgress, setCurrentProgress] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});

  const [useJobId, setUseJobId] = useState(true);

  // 历史记录状态
  const [showHistory, setShowHistory] = useState(false);
  const [historyResults, setHistoryResults] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // PDF预览状态
  const [previewResume, setPreviewResume] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const models = [
    { value: 'qwen-plus', label: '通义千问 Qwen Plus' },
    { value: 'deepseek-chat', label: 'DeepSeek Chat' }
  ];

  // 加载保存的配置
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.topK) setTopK(config.topK);
        if (config.selectedModel) setSelectedModel(config.selectedModel);
        if (config.useJobId !== undefined) setUseJobId(config.useJobId);
        if (config.jobDescription) setJobDescription(config.jobDescription);
      } catch (e) {
        console.error('加载配置失败:', e);
      }
    }
  }, []);

  // 保存配置
  const saveConfig = () => {
    const config = {
      topK,
      selectedModel,
      useJobId,
      jobDescription,
      selectedJobId: selectedJob?.job_id
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  };

  const fetchJobs = async () => {
    try {
      const response = await api.get('/api/jobs/list');
      if (response.data.success) {
        setJobs(response.data.jobs);
        // 恢复之前选择的岗位
        const savedConfig = localStorage.getItem(STORAGE_KEY);
        if (savedConfig) {
          const config = JSON.parse(savedConfig);
          if (config.selectedJobId) {
            const job = response.data.jobs.find(j => j.job_id === config.selectedJobId);
            if (job) {
              setSelectedJob(job);
              fetchHistory(job.job_id);
              setShowHistory(true);
            }
          }
        }
      }
    } catch (err) {
      console.error('获取岗位列表失败:', err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  // ESC键关闭预览
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && previewResume) {
        handleClosePreview();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [previewResume]);

  const handleScreen = async () => {
    saveConfig();  // 保存配置
    setError('');
    setResults([]);
    setCurrentProgress(null);
    setLoading(true);
    setShowHistory(false);  // 筛选时隐藏历史记录

    try {
      if (useJobId) {
        if (!selectedJob) {
          setError('请选择岗位');
          setLoading(false);
          return;
        }
        await streamScreeningResults(selectedJob.job_id);
      } else {
        if (!jobDescription.trim()) {
          setError('请输入职位描述');
          setLoading(false);
          return;
        }
        const response = await api.post(
          '/api/screening/screen',
          {
            job_description: jobDescription,
            top_k: topK,
            model: selectedModel
          }
        );
        setResults(response.data.results || []);
        if (!response.data.results || response.data.results.length === 0) {
          setError('未找到匹配的简历');
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || '筛选失败');
      setLoading(false);
    }
  };

  const streamScreeningResults = async (jobId) => {
    const token = localStorage.getItem('token');
    const url = `http://localhost:8000/api/screening/screen_by_job/${jobId}?top_k=${topK}&model=${selectedModel}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('筛选请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'error') {
                setError(data.message);
                setLoading(false);
                setCurrentProgress(null);
                return;
              }

              if (data.type === 'done') {
                setLoading(false);
                setCurrentProgress(null);
                if (data.count === 0) {
                  setError('未找到匹配的简历');
                }
                return;
              }

              if (data.type === 'result') {
                setCurrentProgress({
                  current: data.index,
                  total: data.total,
                  filename: data.filename
                });
                setResults(prev => [...prev, data]);
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || '筛选失败');
      setLoading(false);
      setCurrentProgress(null);
    }
  };

  // 获取历史记录
  const fetchHistory = async (jobId) => {
    if (!jobId) return;
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/screening/history/${jobId}`);
      if (response.data.success) {
        setHistoryResults(response.data.results || []);
      }
    } catch (err) {
      console.error('获取历史记录失败:', err);
      setHistoryResults([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN');
  };

  const formatSize = (bytes) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const toggleExpand = (resumeId) => {
    setExpandedItems(prev => ({
      ...prev,
      [resumeId]: !prev[resumeId]
    }));
  };

  // PDF预览功能
  const handleViewResume = async (resumeId, filename) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`http://localhost:8000/api/resumes/${resumeId}/file?token=${token}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewResume({ resume_id: resumeId, filename });
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

  // Markdown表格组件
  const MarkdownTable = ({ children }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        borderCollapse: 'collapse',
        width: '100%',
        border: '1px solid #d0d7de',
        marginBottom: '8px',
      }}>
        {children}
      </table>
    </div>
  );

  const MarkdownTh = ({ children }) => (
    <th style={{
      border: '1px solid #d0d7de',
      padding: '8px 12px',
      backgroundColor: '#f5f7fa',
      fontWeight: 'bold',
      textAlign: 'left',
    }}>
      {children}
    </th>
  );

  const MarkdownTd = ({ children }) => (
    <td style={{
      border: '1px solid #d0d7de',
      padding: '8px 12px',
    }}>
      {children}
    </td>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>简历筛选</h2>
      </div>

      <div style={styles.content}>
        <div style={styles.leftPanel}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>筛选配置</h3>
            </div>

            <div style={styles.cardBody}>
              <div style={styles.formGroup}>
                <label style={styles.label}>筛选方式</label>
                <div style={styles.toggleContainer}>
                  <button
                    style={{
                      ...styles.toggleButton,
                      backgroundColor: useJobId ? '#667eea' : '#f5f5f5',
                      color: useJobId ? 'white' : '#333'
                    }}
                    onClick={() => setUseJobId(true)}
                  >
                    选择岗位
                  </button>
                  <button
                    style={{
                      ...styles.toggleButton,
                      backgroundColor: !useJobId ? '#667eea' : '#f5f5f5',
                      color: !useJobId ? 'white' : '#333'
                    }}
                    onClick={() => setUseJobId(false)}
                  >
                    自定义描述
                  </button>
                </div>
              </div>

              {useJobId && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>选择岗位</label>
                  <select
                    style={styles.select}
                    value={selectedJob?.job_id || ''}
                    onChange={(e) => {
                      const job = jobs.find(j => j.job_id === e.target.value);
                      setSelectedJob(job);
                      if (job) {
                        fetchHistory(job.job_id);
                        setShowHistory(true);  // 选择岗位后自动显示历史记录
                      } else {
                        setHistoryResults([]);
                        setShowHistory(false);
                      }
                      setResults([]);  // 清空新结果
                      setError('');
                    }}
                  >
                    <option value="">请选择岗位</option>
                    {jobs.map((job) => (
                      <option key={job.job_id} value={job.job_id}>
                        {job.title} {job.location ? `(${job.location})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!useJobId && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>职位描述</label>
                  <textarea
                    style={styles.textarea}
                    placeholder="请输入详细的职位描述，包括岗位要求、技能要求等..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={10}
                  />
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>返回数量 (Top K)</label>
                <input
                  type="number"
                  style={styles.input}
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>评估模型</label>
                <select
                  style={styles.select}
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {models.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <div style={styles.error}>{error}</div>}

              <button
                style={styles.screenButton}
                onClick={handleScreen}
                disabled={loading}
              >
                {loading ? '筛选中...' : '开始筛选'}
              </button>

              {currentProgress && (
                <div style={styles.progressContainer}>
                  <div style={styles.progressText}>
                    正在评估: <strong>{currentProgress.filename}</strong>
                    ({currentProgress.current}/{currentProgress.total})
                  </div>
                  <div style={styles.progressBar}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${(currentProgress.current / currentProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {useJobId && selectedJob && (
            <div style={styles.stickyCard}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>岗位信息</h3>
              </div>
              <div style={styles.cardBody}>
                <div style={styles.jobInfo}>
                  <div style={styles.jobTitle}>{selectedJob.title}</div>
                  <div style={styles.jobMeta}>
                    {selectedJob.location && (
                      <span style={styles.metaItem}>📍 {selectedJob.location}</span>
                    )}
                    {selectedJob.salary_range && (
                      <span style={styles.metaItem}>💰 {selectedJob.salary_range}</span>
                    )}
                  </div>
                  <div style={styles.jobSection}>
                    <h4 style={styles.sectionTitle}>岗位描述</h4>
                    <p style={styles.sectionText}>{selectedJob.description}</p>
                  </div>
                  {selectedJob.requirements && (
                    <div style={styles.jobSection}>
                      <h4 style={styles.sectionTitle}>岗位要求</h4>
                      <p style={styles.sectionText}>{selectedJob.requirements}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderRow}>
                <h3 style={styles.cardTitle}>
                  {showHistory ? '历史记录' : '筛选结果'} 
                  {showHistory && historyResults.length > 0 && ` (${historyResults.length})`}
                  {!showHistory && results.length > 0 && ` (${results.length})`}
                </h3>
                {selectedJob && (historyResults.length > 0 || results.length > 0) && (
                  <button
                    style={{
                      ...styles.historyToggle,
                      backgroundColor: showHistory ? '#667eea' : '#f5f5f5',
                      color: showHistory ? 'white' : '#333'
                    }}
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? '查看新结果' : '查看历史'}
                  </button>
                )}
              </div>
            </div>
            <div style={styles.cardBody}>
              {/* 使用函数式条件渲染，避免嵌套三元运算符 */}
              {(() => {
                // 筛选进行中
                if (loading) {
                  return <div style={styles.loading}>筛选中...</div>;
                }
                
                // 显示历史记录
                if (showHistory) {
                  if (historyLoading) {
                    return <div style={styles.loading}>加载历史记录...</div>;
                  }
                  if (historyResults.length === 0) {
                    return (
                      <div style={styles.empty}>
                        <div style={styles.emptyIcon}>📋</div>
                        <p style={styles.emptyText}>暂无历史记录</p>
                      </div>
                    );
                  }
                  return (
                    <div style={styles.resultsList}>
                      {historyResults.map((result, index) => {
                        const isExpanded = expandedItems[`history-${result.result_id}`] || false;
                        return (
                          <div 
                            key={`history-${result.result_id}`} 
                            style={isExpanded ? styles.resultItemExpanded : styles.resultItem}
                          >
                            <div
                              style={{ ...(isExpanded ? styles.resultHeaderSticky : styles.resultHeader), cursor: 'pointer' }}
                              onClick={() => toggleExpand(`history-${result.result_id}`)}
                            >
                              <div style={styles.resultRank}>
                                <span style={styles.rankNumber}>#{index + 1}</span>
                              </div>
                              <div style={styles.resultInfo}>
                                <div style={styles.resultTitle}>
                                  {result.filename || '未知文件名'}
                                  <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                    {isExpanded ? '▼ 点击收起' : '▶ 点击展开'}
                                  </span>
                                </div>
                                <div style={styles.resultMeta}>
                                  <span style={styles.metaItem} title="重排序相似度分数">
                                    🎯 相似度: {(result.rerank_score * 100).toFixed(1)}%
                                  </span>
                                  <span style={styles.metaSeparator}>•</span>
                                  <span style={styles.metaItem}>
                                    📅 {formatDate(result.screening_created_at || result.created_at)}
                                  </span>
                                </div>
                              </div>
                              <button
                                style={styles.viewButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewResume(result.resume_id, result.filename);
                                }}
                              >
                                查看简历
                              </button>
                            </div>
                            {isExpanded && (
                              <div style={styles.evaluationSection}>
                                <div style={styles.stickyHeader}>
                                  <h4 style={styles.evaluationTitle}>
                                    AI 评估
                                    <span style={styles.scoreHint}>（整体评分见下方评估内容）</span>
                                  </h4>
                                  <button
                                    style={styles.collapseButton}
                                    onClick={() => toggleExpand(`history-${result.result_id}`)}
                                  >
                                    ▲ 收起
                                  </button>
                                </div>
                                <div style={styles.evaluationContent}>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      table: MarkdownTable,
                                      th: MarkdownTh,
                                      td: MarkdownTd,
                                    }}
                                  >
                                    {result.llm_evaluation}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                
                // 显示新结果
                if (results.length === 0) {
                  return (
                    <div style={styles.empty}>
                      <div style={styles.emptyIcon}>🔍</div>
                      <p style={styles.emptyText}>
                        {error ? '未找到匹配的简历' : '选择岗位或输入描述后开始筛选'}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div style={styles.resultsList}>
                    {results.map((result, index) => {
                      const isExpanded = expandedItems[result.resume_id] || false;
                      return (
                        <div 
                          key={result.resume_id} 
                          style={isExpanded ? styles.resultItemExpanded : styles.resultItem}
                        >
                          <div
                            style={{ ...(isExpanded ? styles.resultHeaderSticky : styles.resultHeader), cursor: 'pointer' }}
                            onClick={() => toggleExpand(result.resume_id)}
                          >
                            <div style={styles.resultRank}>
                              <span style={styles.rankNumber}>#{index + 1}</span>
                            </div>
                            <div style={styles.resultInfo}>
                              <div style={styles.resultTitle}>
                                {result.filename || '未知文件名'}
                                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                                  {isExpanded ? '▼ 点击收起' : '▶ 点击展开'}
                                </span>
                              </div>
                              <div style={styles.resultMeta}>
                                <span style={styles.metaItem} title="重排序相似度分数">
                                  🎯 相似度: {(result.rerank_score * 100).toFixed(1)}%
                                </span>
                                <span style={styles.metaSeparator}>•</span>
                                <span style={styles.metaItem}>
                                  📅 {formatDate(result.created_at)}
                                </span>
                                <span style={styles.metaSeparator}>•</span>
                                <span style={styles.metaItem}>
                                  📦 {formatSize(result.file_size)}
                                </span>
                              </div>
                            </div>
                            <button
                              style={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewResume(result.resume_id, result.filename);
                              }}
                            >
                              查看简历
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={styles.evaluationSection}>
                              <div style={styles.stickyHeader}>
                                <h4 style={styles.evaluationTitle}>
                                  AI 评估
                                  <span style={styles.scoreHint}>（整体评分见下方评估内容）</span>
                                </h4>
                                <button
                                  style={styles.collapseButton}
                                  onClick={() => toggleExpand(result.resume_id)}
                                >
                                  ▲ 收起
                                </button>
                              </div>
                              <div style={styles.evaluationContent}>
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    table: MarkdownTable,
                                    th: MarkdownTh,
                                    td: MarkdownTd,
                                  }}
                                >
                                  {result.llm_evaluation}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* PDF预览模态框 */}
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
  content: {
    display: 'grid',
    gridTemplateColumns: '400px 1fr',
    gap: '24px',
    minHeight: '600px',
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  stickyCard: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    position: 'sticky',
    top: '80px',  // 考虑顶部导航栏高度（约60px）+ 间距
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    zIndex: 10,
  },
  cardHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
  },
  cardHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyToggle: {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  cardBody: {
    padding: '24px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
    marginBottom: '8px',
  },
  toggleContainer: {
    display: 'flex',
    gap: '8px',
  },
  toggleButton: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    appearance: 'auto',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    padding: '10px 14px',
    backgroundColor: '#fee',
    color: '#e74c3c',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  screenButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'backgroundColor 0.2s',
  },
  jobInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  jobTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
  },
  jobMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#999',
  },
  metaItem: {
    fontSize: '13px',
  },
  metaSeparator: {
    color: '#ddd',
  },
  jobSection: {
    marginTop: '8px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
    margin: '0 0 8px 0',
  },
  sectionText: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.6',
    margin: 0,
    whiteSpace: 'pre-wrap',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#999',
    fontSize: '16px',
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
    margin: 0,
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  resultItem: {
    padding: '20px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  resultItemExpanded: {
    padding: '20px',
    border: '2px solid #667eea',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  resultHeader: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    transition: 'background-color 0.2s',
  },
  resultHeaderSticky: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
    transition: 'background-color 0.2s',
    position: 'sticky',
    top: '0',  // 相对于整个右侧面板的顶部
    backgroundColor: '#fafafa',
    padding: '16px 20px',
    margin: '-20px -20px 12px -20px',  // 抵消卡片的padding
    borderBottom: '2px solid #667eea',
    zIndex: 20,
  },
  resultRank: {
    flexShrink: 0,
  },
  rankNumber: {
    display: 'inline-block',
    width: '36px',
    height: '36px',
    lineHeight: '36px',
    textAlign: 'center',
    borderRadius: '50%',
    backgroundColor: '#667eea',
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#999',
  },
  evaluationSection: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #e0e0e0',
    animation: 'fadeIn 0.3s ease-in-out',
  },
  stickyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: '12px 0',
    borderBottom: '1px solid #e0e0e0',
    marginBottom: '12px',
  },
  collapseButton: {
    padding: '6px 12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'backgroundColor 0.2s',
    flexShrink: 0,
  },
  evaluationTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#555',
    margin: '0 0 8px 0',
  },
  evaluationContent: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.6',
    backgroundColor: 'white',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
  },
  progressContainer: {
    marginTop: '16px',
  },
  progressText: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '8px',
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
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
    flexShrink: 0,
  },
  scoreHint: {
    fontSize: '12px',
    fontWeight: 'normal',
    color: '#999',
    marginLeft: '8px',
  },
  // PDF预览模态框样式
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

const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (!document.querySelector('style[data-animations]')) {
  style.setAttribute('data-animations', 'true');
  document.head.appendChild(style);
}

export default Screening;
