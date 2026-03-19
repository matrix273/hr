import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { jobService } from '../services/jobService';
import {
  Button,
  Card,
  Select,
  Progress,
  Alert,
  message,
  Modal,
  Space,
  Typography,
  Divider,
  Upload,
  Tag
} from 'antd';
import { InboxOutlined, DeleteOutlined, CloseOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Dragger } = Upload;

const ResumeUpload = ({ onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [parsedTexts, setParsedTexts] = useState([]);
  const [showParsedTexts, setShowParsedTexts] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loadingJobs, setLoadingJobs] = useState(false);

  // 加载岗位列表
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLoadingJobs(true);
        const response = await jobService.getJobs();
        if (response.success) {
          setJobs(response.jobs || []);
        }
      } catch (error) {
        console.error('加载岗位列表失败:', error);
        setError('加载岗位列表失败，请刷新页面重试');
      } finally {
        setLoadingJobs(false);
      }
    };

    loadJobs();
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setError('请选择 PDF 格式的文件');
      setSelectedFiles([]);
      return;
    }

    if (pdfFiles.length < files.length) {
      setError(`已过滤 ${files.length - pdfFiles.length} 个非 PDF 文件`);
    } else {
      setError('');
    }

    setSelectedFiles(pdfFiles);
    setParsedTexts([]);
    setShowParsedTexts(false);
    setUploadResults([]);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('请先选择文件');
      return;
    }

    // 检查是否选择了岗位
    if (!selectedJobId) {
      setError('请先选择一个岗位');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setUploadResults([]);
    const results = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      
      // 添加岗位ID到请求体
      if (selectedJobId) {
        formData.append('job_id', selectedJobId);
      }

      try {
        const response = await api.post('/api/resumes/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        const { success, message, resume_id, resume_text } = response.data;

        if (success) {
          results.push({
            filename: file.name,
            success: true,
            resume_id,
            resume_text,
            message: '上传成功'
          });
        } else {
          results.push({
            filename: file.name,
            success: false,
            message: message || '上传失败'
          });
        }
      } catch (err) {
        results.push({
          filename: file.name,
          success: false,
          message: err.response?.data?.detail || '上传失败，请重试'
        });
      }

      setUploadProgress({ current: i + 1, total: selectedFiles.length });
    }

    setUploadResults(results);
    const successCount = results.filter(r => r.success).length;

    if (successCount > 0) {
      const parsedData = results.filter(r => r.success);
      setParsedTexts(parsedData);
      setShowParsedTexts(true);

      if (onUploadSuccess) {
        onUploadSuccess(parsedData);
      }
    }

    if (successCount === results.length) {
      setError('');
    } else {
      setError(`成功 ${successCount} 个，失败 ${results.length - successCount} 个`);
    }

    setUploading(false);
    setSelectedFiles([]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    // 只有离开整个拖拽区域时才移除拖拽状态
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  // 删除单个文件
  const handleRemoveFile = (index) => {
    const newFiles = [...selectedFiles];
    newFiles.splice(index, 1);
    setSelectedFiles(newFiles);
    setError('');
  };

  // 清空所有文件
  const handleClearAllFiles = () => {
    setSelectedFiles([]);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');

    if (pdfFiles.length === 0) {
      setError('请选择 PDF 格式的文件');
      setSelectedFiles([]);
      return;
    }

    if (pdfFiles.length < files.length) {
      setError(`已过滤 ${files.length - pdfFiles.length} 个非 PDF 文件`);
    } else {
      setError('');
    }

    setSelectedFiles(pdfFiles);
    setParsedTexts([]);
    setShowParsedTexts(false);
    setUploadResults([]);
  };

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
          上传简历
        </Title>
      </div>

      {/* 上传区域 */}
      <Card 
        style={{ marginBottom: '24px' }}
        styles={{
          body: { padding: '24px' }
        }}
      >
        {/* 岗位选择器 */}
        <div style={{ marginBottom: '24px' }}>
          {!loadingJobs && jobs.length === 0 ? (
            <Alert
              message="请先创建岗位"
              description={
                <span>
                  当前没有可用岗位，请先前往 
                  <a href="/jobs" style={{ textDecoration: 'underline', fontWeight: '500' }}>岗位管理</a> 
                  页面创建岗位后再上传简历
                </span>
              }
              type="warning"
              showIcon
            />
          ) : (
            <>
              <div style={{ marginBottom: '8px', fontWeight: '500', color: '#262626' }}>
                选择岗位 <span style={{ color: '#ff4d4f' }}>*</span>
              </div>
              <Select 
                value={selectedJobId} 
                onChange={(value) => setSelectedJobId(value)}
                style={{ width: '100%' }}
                disabled={loadingJobs}
                placeholder="请选择岗位"
              >
                <Select.Option key="" value="" disabled>
                  请选择岗位
                </Select.Option>
                {jobs.map(job => (
                  <Select.Option key={job.job_id} value={job.job_id}>
                    {job.title}{job.location ? ` (${job.location})` : ''}
                  </Select.Option>
                ))}
              </Select>
              {loadingJobs && (
                <div style={{ color: '#bfbfbf', fontSize: '14px', marginTop: '8px' }}>加载中...</div>
              )}
            </>
          )}
        </div>

        {/* 拖拽区域 */}
        <div
          style={{
            border: '2px dashed',
            borderColor: error ? '#ff4d4f' : isDragging ? '#1890ff' : '#d9d9d9',
            borderRadius: '8px',
            padding: '48px 24px',
            textAlign: 'center',
            background: error ? '#fff2f0' : isDragging ? '#f0f8ff' : '#fafafa',
            transition: 'all 0.3s'
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '48px' }}>📄</div>
            <div style={{ color: '#666', fontSize: '16px' }}>
              拖拽 PDF 文件到这里，或
              <label 
                style={{ 
                  color: '#1890ff', 
                  textDecoration: 'underline', 
                  cursor: 'pointer',
                  marginLeft: '4px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  id="file-input"
                />
                点击选择（支持多选）
              </label>
            </div>
            
            {/* 文件列表 */}
            {selectedFiles.length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'left', width: '100%', maxWidth: '400px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ color: '#262626', fontWeight: '600', fontSize: '14px' }}>
                    已选择 {selectedFiles.length} 个文件：
                  </div>
                  <Button
                    size="small"
                    danger
                    onClick={handleClearAllFiles}
                    icon={<DeleteOutlined />}
                  >
                    清空全部
                  </Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedFiles.map((file, index) => (
                    <div 
                      key={index} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'white',
                        padding: '8px',
                        borderRadius: '4px',
                        border: '1px solid #d9d9d9'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                        <span style={{ color: '#1890ff', fontSize: '14px' }}>•</span>
                        <span 
                          style={{ 
                            color: '#1890ff', 
                            fontSize: '14px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>
                      <Button
                        size="small"
                        danger
                        type="text"
                        onClick={() => handleRemoveFile(index)}
                        icon={<CloseOutlined />}
                        style={{ marginLeft: '8px', flexShrink: 0 }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{ color: '#ff4d4f', fontSize: '14px', textAlign: 'center', marginTop: '16px' }}>
            {error}
          </div>
        )}

        {/* 上传进度 */}
        {uploading && (
          <div style={{ marginTop: '16px' }}>
            <Progress
              percent={Math.round((uploadProgress.current / uploadProgress.total) * 100)}
              size="small"
            />
            <div style={{ color: '#666', fontSize: '14px', textAlign: 'center', marginTop: '8px' }}>
              正在上传: {uploadProgress.current} / {uploadProgress.total}
            </div>
          </div>
        )}

        {/* 上传按钮 */}
        <Button
          type="primary"
          size="large"
          block
          style={{ marginTop: '24px' }}
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || uploading}
          loading={uploading}
        >
          {uploading 
            ? `上传中 (${uploadProgress.current}/${uploadProgress.total})` 
            : `上传 ${selectedFiles.length > 0 ? selectedFiles.length : ''} 个简历`
          }
        </Button>
      </Card>

      {/* 上传结果 */}
      {uploadResults.length > 0 && (
        <Card 
          title="上传结果" 
          style={{ marginBottom: '24px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {uploadResults.map((result, index) => (
              <div 
                key={index} 
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: result.success ? '#b7eb8f' : '#ffccc7',
                  background: result.success ? '#f6ffed' : '#fff2f0'
                }}
              >
                <div 
                  style={{ 
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: result.success ? '#52c41a' : '#ff4d4f'
                  }}
                >
                  {result.success ? '✓' : '✗'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#262626', fontWeight: '500' }}>{result.filename}</div>
                  <div 
                    style={{ 
                      fontSize: '14px',
                      marginTop: '4px',
                      color: result.success ? '#52c41a' : '#ff4d4f'
                    }}
                  >
                    {result.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 解析结果 */}
      {showParsedTexts && (
        <Modal
          title={`解析结果 (${parsedTexts.length} 个文件)`}
          open={showParsedTexts}
          onCancel={() => setShowParsedTexts(false)}
          width={800}
          footer={null}
        >
          <div style={{ 
            background: '#f5f5f5', 
            padding: '16px', 
            borderRadius: '6px',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {parsedTexts.map((item, index) => (
              <div 
                key={index} 
                style={{ 
                  marginBottom: '24px', 
                  paddingBottom: '24px', 
                  borderBottom: index < parsedTexts.length - 1 ? '1px solid #d9d9d9' : 'none',
                  borderBottomColor: '#d9d9d9'
                }}
              >
                <div style={{ color: '#262626', fontWeight: '600', fontSize: '16px', marginBottom: '12px' }}>
                  {item.filename}
                </div>
                <pre style={{ 
                  color: '#595959', 
                  fontSize: '14px', 
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0
                }}>
                  {item.resume_text}
                </pre>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ResumeUpload;
