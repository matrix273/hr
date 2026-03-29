import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { getApiBaseUrl } from '../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Card, 
  Button, 
  Input, 
  InputNumber,
  Select, 
  Switch, 
  Progress, 
  Modal, 
  Alert, 
  Row, 
  Col, 
  Space,
  Tag,
  Typography,
  Divider,
  Collapse,
  Tooltip,
  Dropdown
} from 'antd';

const { Title, Text } = Typography;
import {
  SearchOutlined,
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckSquareOutlined,
  HistoryOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons';

// Markdown表格组件 - 移到组件外部
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

// localStorage key for saving screening config
const STORAGE_KEY = 'screening_config';

// 岗位选择器组件
const JobSelector = ({ 
  jobs, 
  selectedJob, 
  onJobChange, 
  label = "选择岗位", 
  required = false, 
  placeholder = "请选择岗位",
  helpText 
}) => {
  return (
    <div style={{ marginBottom: 20 }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        {label}{required && ' *'}
      </Typography.Text>
      <Select
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={selectedJob?.job_id || undefined}
        onChange={(value) => {
          const job = jobs.find(j => j.job_id === value);
          onJobChange(job);
        }}
        options={[
          { value: '', label: placeholder, disabled: true },
          ...jobs.map(job => ({
            value: job.job_id,
            label: `${job.title}${job.location ? ` (${job.location})` : ''}`
          }))
        ]}
      />
      {helpText && (
        <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
          {helpText}
        </Typography.Text>
      )}
    </div>
  );
};

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
  const [stickyTitle, setStickyTitle] = useState(null);

  const [useJobId, setUseJobId] = useState(true);

  // 简历过滤状态
  const [filterJob, setFilterJob] = useState(null);

  // 滚动到开始筛选按钮的引用
  const startScreenButtonRef = React.useRef(null);

  // 新增筛选条件
  const [timeRange, setTimeRange] = useState(7); // 默认7天
  const [onlyUnscreened, setOnlyUnscreened] = useState(true); // 只筛选未评估的（默认开启）

  // 排序状态: null=默认顺序, 'asc'=匹配度升序, 'desc'=匹配度降序
  const [sortOrder, setSortOrder] = useState(null);

  // 历史记录状态
  const [showHistory, setShowHistory] = useState(false);
  const [historyResults, setHistoryResults] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // 批量删除状态
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [selectAllHistory, setSelectAllHistory] = useState(false);
  
  // 根据筛选方式自动过滤历史记录
  const filteredHistoryResults = historyResults.filter(result => {
    // 如果使用岗位筛选，只显示岗位筛选类型的历史记录
    if (useJobId && selectedJob) {
      // 检查 screening_type 是否为 'job'，或者 job_id 不以 'custom_' 开头
      return result.screening_type === 'job' || 
             (!result.screening_type && !result.job_id?.startsWith('custom_'));
    }
    // 如果使用自定义描述筛选，只显示自定义筛选类型的历史记录
    else if (!useJobId) {
      // 检查 screening_type 是否为 'custom'，或者 job_id 以 'custom_' 开头
      return result.screening_type === 'custom' || 
             (!result.screening_type && result.job_id?.startsWith('custom_'));
    }
    // 其他情况（如选择岗位但没有选中岗位）
    return false;
  });

  // PDF预览状态
  const [previewResume, setPreviewResume] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // 导出选择状态
  const [selectedResults, setSelectedResults] = useState([]);
  const [selectAllResults, setSelectAllResults] = useState(false);
  const [exportType, setExportType] = useState('pdf');
  const [showExportDropdown, setShowExportDropdown] = useState(false);

  // 合并复选框功能 - 单个复选框同时处理导出和删除
  const handleSelectAllHistory = () => {
    if (selectAllHistory) {
      setSelectedHistory([]);
      setSelectedResults([]);
    } else {
      setSelectedHistory(historyResults.map(r => r.result_id));
      setSelectedResults(historyResults.map(r => r.resume_id));
    }
    setSelectAllHistory(!selectAllHistory);
  };

  // 合并复选框功能 - 单个复选框同时处理导出和删除
  const handleSelectResult = (resumeId, resultId = null) => {
    // 处理新结果（没有resultId）
    if (resultId === null) {
      if (selectedResults.includes(resumeId)) {
        setSelectedResults(selectedResults.filter(id => id !== resumeId));
      } else {
        setSelectedResults([...selectedResults, resumeId]);
      }
      return;
    }
    
    // 处理历史记录（同时处理导出和删除）
    // 注意：同一个简历可能被多次筛选，所以需要根据result_id来判断是否选中
    if (selectedHistory.includes(resultId)) {
      // 如果已选中，则取消选中
      setSelectedHistory(selectedHistory.filter(id => id !== resultId));
      // 同时从导出列表中移除该简历（如果没有其他选中项包含该简历）
      const otherSelectedResumeIds = filteredHistoryResults
        .filter(r => selectedHistory.includes(r.result_id) && r.result_id !== resultId)
        .map(r => r.resume_id);
      if (!otherSelectedResumeIds.includes(resumeId)) {
        setSelectedResults(selectedResults.filter(id => id !== resumeId));
      }
    } else {
      // 如果未选中，则选中
      setSelectedHistory([...selectedHistory, resultId]);
      // 同时添加到导出列表（避免重复）
      if (!selectedResults.includes(resumeId)) {
        setSelectedResults([...selectedResults, resumeId]);
      }
    }
  };

  // 导出结果选择功能
  const handleSelectAllResults = () => {
    if (selectAllResults) {
      setSelectedResults([]);
      if (showHistory) {
        setSelectedHistory([]);
      }
    } else {
      const currentResults = showHistory ? filteredHistoryResults : results;
      setSelectedResults(currentResults.map(r => r.resume_id));
      if (showHistory) {
        setSelectedHistory(currentResults.map(r => r.result_id));
      }
    }
    setSelectAllResults(!selectAllResults);
  };

  // 导出结果功能
  const handleExportResults = async () => {
    // 根据当前视图获取正确的选中数据
    let currentSelectedData = [];
    
    if (showHistory) {
      // 历史记录视图：只导出历史记录中选中的项
      currentSelectedData = filteredHistoryResults.filter(r => 
        selectedHistory.includes(r.result_id)
      );
    } else {
      // 新结果视图：只导出新结果中选中的项
      currentSelectedData = results.filter(r => 
        selectedResults.includes(r.resume_id)
      );
    }
    
    if (currentSelectedData.length === 0) {
      setError('请先选择要导出的结果');
      return;
    }

    try {
      if (exportType === 'pdf') {
        await exportToPDF(currentSelectedData);
      } else {
        await exportToMarkdown(currentSelectedData);
      }
    } catch (error) {
      setError('导出失败：' + error.message);
    }
  };

  // 导出为PDF - 调用后端API
  const exportToPDF = async (data) => {
    try {
      // 从数据中提取result_id列表
      const resultIds = data.map(item => item.result_id).filter(id => id);
      
      // 如果没有result_id（新结果），使用Markdown格式导出
      if (resultIds.length === 0) {
        console.log('新结果导出：使用Markdown格式');
        setError('提示：新筛选结果已导出为Markdown格式（历史记录支持PDF导出）');
        setTimeout(() => setError(''), 3000);
        
        const markdownContent = exportToMarkdownContent(data);
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const jobName = selectedJob?.title || filterJob?.title || '自定义筛选';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        link.download = `${timestamp}_${jobName}_${data.length}份.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
      
      // 调用后端API导出PDF（历史记录）
      const response = await api.post('/screening/export-pdf', {
        result_ids: resultIds
      }, {
        responseType: 'blob' // 重要：指定响应类型为blob
      });
      
      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // 从响应头获取文件名
      const contentDisposition = response.headers['content-disposition'];
      let filename = '简历筛选报告.pdf';
      if (contentDisposition) {
        // 优先解析RFC 5987格式: filename*=UTF-8''encoded_filename
        const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
        if (rfc5987Match && rfc5987Match[1]) {
          filename = decodeURIComponent(rfc5987Match[1]);
        } else {
          // 回退到传统格式: filename="filename"
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch && filenameMatch[1]) {
            filename = decodeURIComponent(filenameMatch[1]);
          }
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setError('');
      
    } catch (error) {
      console.error('PDF导出失败:', error);
      
      // 如果后端导出失败，降级为Markdown格式
      if (error.response?.status === 404) {
        setError('后端PDF服务暂不可用，已切换为Markdown格式');
      } else {
        setError(`PDF导出失败: ${error.response?.data?.detail || error.message}，已切换为Markdown格式`);
      }
      setTimeout(() => setError(''), 5000);
      
      // 降级方案：导出Markdown
      const markdownContent = exportToMarkdownContent(data);
      const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // 生成与PDF一致的文件名
      const jobName = selectedJob?.title || filterJob?.title || '自定义筛选';
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
      const filename = `${timestamp}_${jobName}_${data.length}份.md`;
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  // 将markdown转换为纯文本的辅助函数
  const convertMarkdownToPlainText = (markdown) => {
    if (!markdown) return '';
    
    // 移除markdown标记
    let text = markdown
      // 移除标题标记
      .replace(/^#+\s+/gm, '')
      // 移除粗体标记
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // 移除斜体标记
      .replace(/\*(.*?)\*/g, '$1')
      // 移除代码块标记
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]*)`/g, '$1')
      // 移除链接标记
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 移除图片标记
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // 移除引用标记
      .replace(/^>\s+/gm, '')
      // 移除列表标记
      .replace(/^[-*+]\s+/gm, '')
      // 移除表格标记
      .replace(/\|/g, ' ')
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      // 移除行首尾空格
      .replace(/^\s+|\s+$/gm, '')
      // 移除HTML标签
      .replace(/<[^>]*>/g, '');
    
    return text.trim();
  };

  // 导出为Markdown内容的辅助函数
  const exportToMarkdownContent = (data) => {
    let content = `# AI Resume Screening Report\n\n`;
    content += `**Generated**: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `**Count**: ${data.length} resumes\n\n`;
    
    data.forEach((result, index) => {
      content += `## ${index + 1}. ${result.filename || '未知文件'}\n\n`;
      content += `- **整体匹配度评分**: ${(() => { const s = extractMatchingScore(result.llm_evaluation); return s != null ? s + '/100' : '-'; })()}\n`;
      content += `- **上传时间**: ${formatDate(result.created_at)}\n`;
      content += `- **文件大小**: ${formatSize(result.file_size)}\n\n`;
      
      if (result.llm_evaluation) {
        content += `### AI评估\n\n`;
        content += `${result.llm_evaluation}\n\n`;
      }
      
      content += `---\n\n`;
    });
    
    return content;
  };

  // 导出为Markdown
  const exportToMarkdown = (data) => {
    let markdownContent = `# AI简历筛选结果报告\n\n`;
    markdownContent += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
    markdownContent += `**导出数量**: ${data.length} 份简历\n\n`;
    
    data.forEach((result, index) => {
      markdownContent += `## ${index + 1}. ${result.filename || '未知文件'}\n\n`;
      markdownContent += `- **整体匹配度评分**: ${(() => { const s = extractMatchingScore(result.llm_evaluation); return s != null ? s + '/100' : '-'; })()}\n`;
      markdownContent += `- **上传时间**: ${formatDate(result.created_at)}\n`;
      markdownContent += `- **文件大小**: ${formatSize(result.file_size)}\n\n`;
      
      if (result.llm_evaluation) {
        markdownContent += `### AI评估\n\n`;
        markdownContent += `${result.llm_evaluation}\n\n`;
      }
      
      markdownContent += `---\n\n`;
    });
    
    const jobName = selectedJob?.title || filterJob?.title || '自定义筛选';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
    const filename = `${timestamp}_${jobName}_${data.length}份.md`;
    
    // 创建下载链接
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBatchDeleteHistory = async () => {
    if (selectedHistory.length === 0) {
      setError('请先选择要删除的历史记录');
      return;
    }

    if (!window.confirm(`确定要删除选中的 ${selectedHistory.length} 条历史记录吗？`)) {
      return;
    }

    try {
      const response = await api.post('/screening/batch-delete', {
        result_ids: selectedHistory
      });

      if (response.data.success) {
        setHistoryResults(historyResults.filter(r => !selectedHistory.includes(r.result_id)));
        setSelectedHistory([]);
        setSelectAllHistory(false);
        // 同步清空导出选中状态（复选框共用，删除后导出计数也需清零）
        const deletedResumeIds = historyResults
          .filter(r => selectedHistory.includes(r.result_id))
          .map(r => r.resume_id);
        setSelectedResults(selectedResults.filter(id => !deletedResumeIds.includes(id)));
        setSelectAllResults(false);
        setError('');
      } else {
        setError('批量删除失败');
      }
    } catch (err) {
      setError(err.response?.data?.detail || '批量删除失败');
    }
  };

  const models = [
    { value: 'qwen-plus', label: '通义千问 Qwen Plus (推荐)' },
    { value: 'Doubao-pro-32k', label: '字节豆包 Doubao Pro' },
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
        if (config.jobDescription) setJobDescription(config.jobDescription);
        if (config.exportType) setExportType(config.exportType);
        // 不再从本地存储加载 useJobId，始终默认使用选择岗位模式
      } catch (e) {
        console.error('加载配置失败:', e);
      }
    }
    // 默认使用选择岗位模式
    setUseJobId(true);
  }, []);

  // 保存配置
  const saveConfig = (overrides = {}) => {
    const config = {
      topK,
      selectedModel,
      useJobId,
      jobDescription,
      selectedJobId: selectedJob?.job_id,
      exportType,
      ...overrides
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  };

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs/list');
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

  // 当切换到自定义描述模式时，自动滚动到开始筛选按钮
  useEffect(() => {
    if (!useJobId && startScreenButtonRef.current) {
      // 使用setTimeout确保在DOM更新后执行滚动
      setTimeout(() => {
        startScreenButtonRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }, 100);
    }
  }, [useJobId]);

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

  // 在组件挂载时添加动画样式
  useEffect(() => {
    if (!document.querySelector('style[data-animations]')) {
      const style = document.createElement('style');
      style.setAttribute('data-animations', 'true');
      style.textContent = animationStyles;
      document.head.appendChild(style);
    }
  }, []);

  const handleScreen = async () => {
    saveConfig();  // 保存配置
    setError('');
    setResults([]);
    setCurrentProgress(null);
    setLoading(true);
    setShowHistory(false);  // 筛选时隐藏历史记录

    try {
      // 验证岗位选择
      const currentJob = useJobId ? selectedJob : filterJob;
      if (!currentJob) {
        setError('请选择岗位');
        setLoading(false);
        return;
      }
      
      if (useJobId) {
        await streamScreeningResults(currentJob.job_id, null, timeRange, onlyUnscreened);
      } else {
        if (!jobDescription.trim()) {
          setError('请输入职位描述');
          setLoading(false);
          return;
        }
        await streamScreeningResults(null, jobDescription, timeRange, onlyUnscreened);
      }
    } catch (err) {
      setError(err.response?.data?.detail || '筛选失败');
      setLoading(false);
    }
  };

  const streamScreeningResults = async (jobId, jobDescription = null, timeRange = 7, onlyUnscreened = false) => {
    let url;
    let data = null;
    
    // 构建基础URL参数
    const baseParams = `top_k=${topK}&model=${selectedModel}&time_range=${timeRange}&only_unscreened=${onlyUnscreened}`;
    
    if (jobId) {
      // 选择岗位模式：自动使用选中的岗位进行筛选，不需要额外的filter参数
      url = `${getApiBaseUrl()}/screening/screen_by_job/${jobId}?${baseParams}`;
    } else {
      // 自定义描述模式
      url = `${getApiBaseUrl()}/screening/screen`;
      data = {
        job_description: jobDescription,
        top_k: topK,
        model: selectedModel,
        time_range: timeRange,
        only_unscreened: onlyUnscreened
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: data ? JSON.stringify(data) : null
      });

      if (!response.ok) {
        throw new Error('筛选请求失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 清空之前的结果
      setResults([]);
      setSortOrder(null); // 重置排序

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

              if (data.type === 'start') {
                // 开始处理第一个简历
                setCurrentProgress({
                  current: 0,
                  total: data.total,
                  filename: '准备开始评估...'
                });
              }

              if (data.type === 'progress') {
                // 更新当前处理进度
                setCurrentProgress({
                  current: data.index,
                  total: data.total,
                  filename: data.filename || '正在评估...'
                });
              }

              if (data.type === 'result') {
                // 立即显示当前完成的结果
                setResults(prev => [...prev, data]);
                setCurrentProgress({
                  current: data.index + 1,
                  total: data.total,
                  filename: '准备下一个...'
                });
              }

              if (data.type === 'done') {
                setLoading(false);
                setCurrentProgress(null);
                if (data.count === 0) {
                  setError('未找到匹配的简历');
                }
                return;
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
  const fetchHistory = async (jobId, isCustomMode = false) => {
    setHistoryLoading(true);
    try {
      let response;
      if (isCustomMode) {
        // 自定义描述模式：获取所有自定义筛选的历史记录
        response = await api.get('/screening/custom_history');
      } else if (jobId) {
        // 岗位筛选模式：获取特定岗位的历史记录
        response = await api.get(`/screening/history/${jobId}`);
      } else {
        setHistoryResults([]);
        return;
      }
      
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

  // 从 LLM 评估文本中提取匹配度评分
  const extractMatchingScore = (llmEvaluation) => {
    if (!llmEvaluation) return null;
    // 优先匹配：整体匹配度评分：**65/100** 或 整体匹配度评分：65/100（同行的格式）
    let match = llmEvaluation.match(
      /整体匹配度评分[：:\s]*\*{0,2}([0-9]{1,3})\s*[分/]\s*100\*{0,2}/
    );
    if (match && parseInt(match[1], 10) <= 100) return parseInt(match[1], 10);
    // 备用1：整体匹配度评分标题下方的 "匹配度：XX分"（跨行）
    match = llmEvaluation.match(
      /整体匹配度评分[^\n]*\n+[^\n]*?匹配度[：:\s]*\*{0,2}([0-9]{1,3})/
    );
    if (match && parseInt(match[1], 10) <= 100) return parseInt(match[1], 10);
    // 备用2：独立行的 "匹配度：XX分"
    match = llmEvaluation.match(
      /(?:^|\n)\s*匹配度[：:\s]*\*{0,2}([0-9]{1,3})\s*[分%/]/
    );
    if (match && parseInt(match[1], 10) <= 100) return parseInt(match[1], 10);
    // 备用3：标题下方独立数字
    match = llmEvaluation.match(
      /整体匹配度评分[^\n]*\n+\s*([0-9]{1,3})\b/
    );
    if (match && parseInt(match[1], 10) <= 100) return parseInt(match[1], 10);
    return null;
  };

  // 从结果中获取匹配度评分（优先使用 matching_score 字段，其次从 llm_evaluation 解析）
  const getResultScore = (result) => {
    if (result.matching_score != null && result.matching_score > 0) {
      return result.matching_score;
    }
    return extractMatchingScore(result.llm_evaluation) ?? 0;
  };

  // 切换排序: 默认 -> 降序 -> 升序 -> 默认
  const toggleSort = () => {
    setSortOrder(prev => {
      if (prev === null) return 'desc';
      if (prev === 'desc') return 'asc';
      return null;
    });
  };

  // 按匹配度排序后的新结果
  const sortedResults = (() => {
    if (!sortOrder || results.length === 0) return results;
    return [...results].sort((a, b) => {
      const scoreA = getResultScore(a);
      const scoreB = getResultScore(b);
      return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });
  })();

  // 按匹配度排序后的历史结果
  const sortedHistoryResults = (() => {
    if (!sortOrder || filteredHistoryResults.length === 0) return filteredHistoryResults;
    return [...filteredHistoryResults].sort((a, b) => {
      const scoreA = getResultScore(a);
      const scoreB = getResultScore(b);
      return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });
  })();

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

  const toggleExpand = (resumeId, filename) => {
    setExpandedItems(prev => {
      const newExpanded = !prev[resumeId];
      // 设置或清除粘性标题
      if (newExpanded) {
        setStickyTitle(filename);
      } else if (stickyTitle === filename) {
        setStickyTitle(null);
      }
      return {
        ...prev,
        [resumeId]: newExpanded
      };
    });
  };

  // PDF预览功能
  const handleViewResume = async (resumeId, filename) => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(`${getApiBaseUrl()}/resumes/${resumeId}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <Title level={2} style={{ marginTop: 0, marginBottom: 0, color: '#262626' }}>
          简历筛选
        </Title>
      </div>

      <Row gutter={24} style={{ minHeight: 600 }}>
        <Col span={8}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card 
              title="筛选配置" 
              size="small"
              style={{ height: 'fit-content' }}
              styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' } }}
            >
              {/* 全局配置 - 放在tab切换上方 */}
              {/* 全局岗位选择器 */}
              <JobSelector
                jobs={jobs}
                selectedJob={useJobId ? selectedJob : filterJob}
                onJobChange={(job) => {
                  if (useJobId) {
                    setSelectedJob(job);
                    if (job) {
                      fetchHistory(job.job_id);
                      setShowHistory(true);  // 选择岗位后自动显示历史记录
                    } else {
                      setHistoryResults([]);
                      setShowHistory(false);
                    }
                  } else {
                    setFilterJob(job);
                  }
                  setResults([]);  // 清空新结果
                  setError('');
                }}
                label="筛选岗位"
                required={true}
                placeholder="请选择岗位"
                helpText={
                  useJobId
                    ? "选择要筛选简历的目标岗位"
                    : "选择岗位将只筛选该岗位的简历"
                }
              />

              <div style={{ marginBottom: 20 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>返回数量 (Top K)</Typography.Text>
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={20}
                  value={topK}
                  onChange={(value) => setTopK(value || 5)}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>评估模型</Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  options={models.map(model => ({
                    value: model.value,
                    label: model.label
                  }))}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>上传时间段</Typography.Text>
                <Select
                  style={{ width: '100%' }}
                  value={timeRange}
                  onChange={setTimeRange}
                  options={[
                    { value: 1, label: '1天内' },
                    { value: 3, label: '3天内' },
                    { value: 7, label: '7天内' },
                    { value: 30, label: '30天内' },
                    { value: 0, label: '所有时间' }
                  ]}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography.Text strong style={{ margin: 0 }}>只筛选未评估的</Typography.Text>
                  <Switch
                    checked={onlyUnscreened}
                    onChange={setOnlyUnscreened}
                  />
                </div>
                <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                  只筛选之前未被AI评估过的简历
                </Typography.Text>
              </div>

              <div style={{ marginBottom: 20 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>筛选方式</Typography.Text>
                <Space.Compact style={{ width: '100%' }}>
                  <Button
                    type={useJobId ? 'primary' : 'default'}
                    style={{ flex: 1 }}
                    onClick={() => {
                      setUseJobId(true);
                      setJobDescription('');
                      setResults([]);  // 清空新结果
                      setError('');
                      setStickyTitle(null);  // 清除粘性标题
                      setExpandedItems({});  // 收起所有展开项
                      // 如果有选中的岗位，显示其历史记录
                      if (selectedJob) {
                        fetchHistory(selectedJob.job_id);
                        setShowHistory(true);
                      } else {
                        // 如果没有选中的岗位，清空历史记录但不隐藏面板
                        setHistoryResults([]);
                        setShowHistory(true);
                      }
                    }}
                  >
                    岗位筛选
                  </Button>
                  <Button
                    type={!useJobId ? 'primary' : 'default'}
                    style={{ flex: 1 }}
                    onClick={() => {
                      setUseJobId(false);
                      setSelectedJob(null);
                      // 加载自定义筛选历史记录
                      fetchHistory(null, true);
                      setShowHistory(true);  // 切换到自定义描述时显示历史记录
                      setResults([]);  // 清空新结果
                      setError('');
                      setStickyTitle(null);  // 清除粘性标题
                      setExpandedItems({});  // 收起所有展开项
                    }}
                  >
                    自定义描述
                  </Button>
                </Space.Compact>
              </div>

              {!useJobId && (
                <div style={{ marginBottom: 20 }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>职位描述</Typography.Text>
                  <Input.TextArea
                    placeholder="请输入详细的职位描述，包括岗位要求、技能要求等..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    rows={6}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              )}

              {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}

              <div ref={startScreenButtonRef}>
                <Button
                  type="primary"
                  size="large"
                  icon={<SearchOutlined />}
                  loading={loading}
                  onClick={handleScreen}
                  style={{ width: '100%' }}
                  block
                >
                  {loading ? '筛选中...' : '开始筛选'}
                </Button>
              </div>

              {currentProgress && (
                <div style={{ marginTop: 16 }}>
                  <Typography.Text style={{ display: 'block', marginBottom: 8, fontSize: '14px' }}>
                    正在评估: <strong>{currentProgress.filename}</strong>
                    ({currentProgress.current}/{currentProgress.total})
                  </Typography.Text>
                  <Progress
                    percent={Math.round((currentProgress.current / currentProgress.total) * 100)}
                    status="active"
                    strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                  />
                </div>
              )}
            </Card>
          </div>

          {useJobId && selectedJob && (
            <Card 
              title="岗位信息" 
              size="small"
              style={{ 
                position: 'sticky',
                top: 80,
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto',
                zIndex: 10
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Typography.Title level={4} style={{ margin: 0 }}>{selectedJob.title}</Typography.Title>
                <Space>
                  {selectedJob.location && (
                    <Typography.Text type="secondary">📍 {selectedJob.location}</Typography.Text>
                  )}
                  {selectedJob.salary_range && (
                    <Typography.Text type="secondary">💰 {selectedJob.salary_range}</Typography.Text>
                  )}
                </Space>
                <div style={{ marginTop: 12 }}>
                  <Typography.Text strong>岗位描述</Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 8, fontSize: '13px' }}>
                    {selectedJob.description}
                  </Typography.Paragraph>
                </div>
                {selectedJob.requirements && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text strong>岗位要求</Typography.Text>
                    <Typography.Paragraph style={{ marginTop: 8, fontSize: '13px' }}>
                      {selectedJob.requirements}
                    </Typography.Paragraph>
                  </div>
                )}
              </div>
            </Card>
          )}
        </Col>

        <Col span={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {showHistory ? '历史记录' : '筛选结果'} 
                  {showHistory && filteredHistoryResults.length > 0 && ` (${filteredHistoryResults.length}/${historyResults.length})`}
                  {!showHistory && results.length > 0 && ` (${results.length})`}
                </span>
                <Space>
                  {/* 导出功能 */}
                  {((showHistory && filteredHistoryResults.length > 0) || (!showHistory && results.length > 0)) && (
                    <Dropdown
                      menu={{
                        selectedKeys: [exportType],
                        onClick: ({ key }) => {
                          setExportType(key);
                          saveConfig({ exportType: key });
                        },
                        items: [
                          { key: 'pdf', label: 'PDF 格式' },
                          { key: 'markdown', label: 'Markdown 格式' },
                        ]
                      }}
                      trigger={['hover']}
                    >
                      <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExportResults}
                        disabled={selectedResults.length === 0}
                      >
                        导出选中 {selectedResults.length} 份 [{exportType === 'pdf' ? 'PDF' : 'Markdown'}]
                      </Button>
                    </Dropdown>
                  )}
                  
                  {/* 删除按钮 */}
                  {showHistory && selectedHistory.length > 0 && (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleBatchDeleteHistory}
                    >
                      删除选中 ({selectedHistory.length})
                    </Button>
                  )}

                  {/* 按匹配度排序按钮 */}
                  {((showHistory && filteredHistoryResults.length > 1) || (!showHistory && results.length > 1)) && (
                    <Tooltip title={sortOrder === null ? '点击按匹配度排序' : sortOrder === 'desc' ? '匹配度: 高→低 (点击切换)' : '匹配度: 低→高 (点击恢复默认)'}>
                      <Button
                        type={sortOrder ? 'primary' : 'default'}
                        icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                        onClick={toggleSort}
                      >
                        匹配度排序
                      </Button>
                    </Tooltip>
                  )}

                  {/* 历史/新结果切换按钮 */}
                  {selectedJob && (historyResults.length > 0 || results.length > 0) && (
                    <Button
                      type={showHistory ? 'primary' : 'default'}
                      icon={showHistory ? <EyeOutlined /> : <HistoryOutlined />}
                      onClick={() => {
                        setShowHistory(!showHistory);
                        // 切换视图时清空所有选中状态
                        setSelectedResults([]);
                        setSelectedHistory([]);
                        setSelectAllResults(false);
                        setSelectAllHistory(false);
                      }}
                    >
                      {showHistory ? '查看新结果' : '查看历史'}
                    </Button>
                  )}
                </Space>
              </div>
            }
            style={{ height: '100%' }}
            styles={{ 
              body: { 
                maxHeight: 'calc(100vh - 240px)', 
                overflowY: 'auto',
                padding: '24px'
              }
            }}
          >
              {/* 粘性标题 - 在右侧面板内部 */}
              {stickyTitle && (
                <div style={styles.stickyTitleBar}>
                  <div style={styles.stickyTitleContent}>
                    <h3 style={styles.stickyTitle}>{stickyTitle}</h3>
                    <button 
                      style={styles.closeStickyButton}
                      onClick={() => {
                        setStickyTitle(null);
                        // 同时收起所有展开的项
                        setExpandedItems({});
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
              
              {/* 使用函数式条件渲染，避免嵌套三元运算符 */}
              {(() => {
                // 渲染新筛选结果的通用函数
                const renderResults = () => {
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
                      {sortedResults.map((result, index) => {
                        const isExpanded = expandedItems[result.resume_id] || false;
                        return (
                          <div 
                            key={result.resume_id} 
                            style={isExpanded ? styles.resultItemExpanded : styles.resultItem}
                          >
                            <div
                              style={{ 
                                ...(isExpanded ? styles.resultHeaderSticky : styles.resultHeader), 
                                cursor: 'pointer',
                                display: isExpanded && stickyTitle === (result.filename || '未知文件名') ? 'none' : 'flex'
                              }}
                              onClick={() => toggleExpand(result.resume_id, result.filename || '未知文件名')}
                            >
                              {/* 合并的复选框 */}
                              <div
                                style={{
                                  ...styles.customCheckbox,
                                  border: '2px solid #667eea',
                                  ...(selectedResults.includes(result.resume_id) ? styles.customCheckboxChecked : {})
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectResult(result.resume_id, null);
                                }}
                              >
                                {selectedResults.includes(result.resume_id) && '✓'}
                              </div>
                              
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
                                    <span style={styles.metaItem} title="整体匹配度评分">
                                    整体匹配度评分：{(() => { const s = extractMatchingScore(result.llm_evaluation); return s != null ? s + '/100' : '-'; })()}
                                  </span>
                                  <span style={styles.metaSeparator}>•</span>
                                  <span style={styles.metaItem}>
                                    📅 {formatDate(result.created_at)}
                                    </span>
                                  <span style={styles.metaSeparator}>•</span>
                                  <span style={styles.metaItem}>
                                      📦 {formatSize(result.file_size)}
                                    </span>
                                  {result.cached && (
                                    <>
                                      <span style={styles.metaSeparator}>•</span>
                                      <span style={{ ...styles.metaItem, color: '#52c41a' }}>
                                        缓存结果
                                      </span>
                                    </>
                                  )}
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
                                    onClick={() => toggleExpand(result.resume_id, result.filename || '未知文件名')}
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
                };

                // 筛选进行中 - 显示进度条，同时显示已完成的结果
                if (loading) {
                  return (
                    <div>
                      {currentProgress && (
                        <div style={styles.loading}>
                          筛选中... {currentProgress.filename} ({currentProgress.current}/{currentProgress.total})
                        </div>
                      )}
                      {renderResults()}
                    </div>
                  );
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
                      {/* 显示筛选方式提示 */}
                      {historyResults.length > 0 && (
                        <div style={styles.filterContainer}>
                          <span style={styles.filterLabel}>
                            当前筛选方式: {useJobId ? '选择岗位' : '自定义描述'}
                          </span>
                          <span style={styles.filterCount}>
                            {filteredHistoryResults.length}/{historyResults.length} 条记录
                          </span>
                        </div>
                      )}
                      
                  {/* 合并的全选功能 */}
                  {((showHistory && filteredHistoryResults.length > 0) || (!showHistory && results.length > 0)) && (
                    <div style={styles.selectAllContainer}>
                      <div 
                        style={styles.selectAllLabel} 
                        onClick={showHistory ? handleSelectAllHistory : handleSelectAllResults}
                      >
                        <div
                          style={{
                            ...styles.customCheckbox,
                            border: '2px solid #667eea',
                            ...(showHistory ? (selectAllHistory ? styles.customCheckboxChecked : {}) : (selectAllResults ? styles.customCheckboxChecked : {}))
                          }}
                        >
                          {(showHistory ? selectAllHistory : selectAllResults) && '✓'}
                        </div>
                        {showHistory ? '全选记录' : '全选导出结果'}
                      </div>
                    </div>
                  )}
                      
                      {sortedHistoryResults.map((result, index) => {
                        const isExpanded = expandedItems[`history-${result.result_id}`] || false;
                        return (
                          <div 
                            key={`history-${result.result_id}`} 
                            style={{
                              ...(isExpanded ? styles.resultItemExpanded : styles.resultItem),
                              ...(selectedHistory.includes(result.result_id) ? styles.resultItemSelected : {})
                            }}
                          >
                            <div
                              style={{ 
                                ...(isExpanded ? styles.resultHeaderSticky : styles.resultHeader), 
                                cursor: 'pointer',
                                display: isExpanded && stickyTitle === (result.filename || '未知文件名') ? 'none' : 'flex'
                              }}
                              onClick={() => toggleExpand(`history-${result.result_id}`, result.filename || '未知文件名')}
                            >
                              {/* 合并的复选框 - 同时处理导出和删除 */}
                              <div
                                style={{
                                  ...styles.customCheckbox,
                                  border: '2px solid #667eea',
                                  ...((selectedResults.includes(result.resume_id) && selectedHistory.includes(result.result_id)) ? styles.customCheckboxChecked : {})
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectResult(result.resume_id, result.result_id);
                                }}
                              >
                                {(selectedResults.includes(result.resume_id) && selectedHistory.includes(result.result_id)) && '✓'}
                              </div>
                              
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
                                  <span style={styles.metaItem} title="整体匹配度评分">
                                      整体匹配度评分：{(() => { const s = extractMatchingScore(result.llm_evaluation); return s != null ? s + '/100' : '-'; })()}
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
                                  onClick={() => toggleExpand(`history-${result.result_id}`, result.filename || '未知文件名')}
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
                
                return renderResults();
              })()}
            </Card>
        </Col>
      </Row>

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
    color: '#fff',
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
    maxHeight: 'calc(100vh - 160px)',  // 确保有足够的滚动空间
    overflow: 'auto',  // 改为auto，允许内容完整滚动
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    border: '1px solid #e0e0e0',
  },
  stickyCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
    position: 'sticky',
    top: '80px',  // 考虑顶部导航栏高度（约60px）+ 间距
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    zIndex: 10,
    border: '1px solid #e0e0e0',
  },
  stickyTitleBar: {
    position: 'sticky',
    top: '-24px',  // 考虑到卡片主体的padding
    backgroundColor: '#fff',
    borderBottom: '2px solid #667eea',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    zIndex: 10,
    padding: '12px 20px',
    margin: '-24px -24px 16px -24px',  // 抵消卡片的padding
  },
  stickyTitleContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  stickyTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  closeStickyButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    padding: '6px 12px',
    transition: 'backgroundColor 0.2s',
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
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  // 导出按钮容器 - 水平布局
  exportButtonContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  exportButtonWrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  exportButton: {
    padding: '6px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
    position: 'relative',
    zIndex: 10,
  },
  exportButtonDisabled: {
    backgroundColor: '#ccc',
    color: '#999',
    cursor: 'not-allowed',
  },
  exportDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    backgroundColor: 'white',
    border: '2px solid #667eea',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: 1000,
    minWidth: '140px',
    overflow: 'hidden',
  },
  exportOption: {
    padding: '10px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
    borderBottom: '1px solid #f0f0f0',
    color: '#333',
    fontWeight: '500',
  },
  exportOptionSelected: {
    backgroundColor: '#667eea',
    color: 'white',
    fontWeight: 'bold',
  },
  'exportOption:hover': {
    backgroundColor: '#f0f7ff',
    color: '#667eea',
  },
  exportTypeHint: {
    fontSize: '11px',
    color: '#999',
    whiteSpace: 'nowrap',
  },
  batchDeleteButton: {
    padding: '6px 12px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'backgroundColor 0.2s',
  },
  filterContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px 20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  filterLabel: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    whiteSpace: 'nowrap',
  },
  filterSelect: {
    padding: '6px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: 'white',
    cursor: 'pointer',
  },
  filterCount: {
    fontSize: '13px',
    color: '#999',
    marginLeft: 'auto',
  },
  selectAllContainer: {
    marginBottom: '16px',
    padding: '12px 20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  selectAllLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: '#666',
    cursor: 'pointer',
    fontWeight: '500',
  },
  customCheckbox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#667eea',
    backgroundColor: 'white',
    flexShrink: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  customCheckboxChecked: {
    backgroundColor: '#667eea',
    color: 'white',
    borderColor: '#667eea',
  },
  resultItemSelected: {
    backgroundColor: '#f0f7ff',
    borderColor: '#667eea',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  cardBody: {
    padding: '24px',
    maxHeight: 'calc(100vh - 240px)',  // 设置最大高度以启用滚动
    overflowY: 'auto',
    overflowX: 'hidden',  // 防止水平滚动
    position: 'relative',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  resultItemExpanded: {
    padding: '20px',
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: '#667eea',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
    minHeight: 'auto',  // 允许根据内容自动调整高度
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
    overflow: 'visible',  // 确保内容完整显示
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
    minHeight: '800px',  // 设置最小高度，与PDF高度一致
    overflow: 'visible',  // 让内容完整显示，不需要滚动
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

// CSS动画样式
const animationStyles = `
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

export default Screening;
