import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { jobService } from '../services/jobService';

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
    <div className="flex flex-col gap-6 p-6">
      {/* 上传区域 */}
      <div className="bg-white p-8 border border-gray-200 rounded-xl shadow-lg">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">上传简历</h2>

        {/* 岗位选择器 */}
        <div className="mb-6">
          {!loadingJobs && jobs.length === 0 ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-700 font-medium">请先创建岗位</p>
              <p className="text-red-600 text-sm mt-1">
                当前没有可用岗位，请先前往 
                <a href="/jobs" className="underline hover:text-red-800 font-medium">岗位管理</a> 
                页面创建岗位后再上传简历
              </p>
            </div>
          ) : (
            <>
              <label className="form-label">选择岗位 <span className="text-red-500">*</span></label>
              <select 
                value={selectedJobId} 
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="form-select"
                disabled={loadingJobs}
                required
              >
                <option value="">-- 请选择岗位 --</option>
                {jobs.map(job => (
                  <option key={job.job_id} value={job.job_id}>
                    {job.title}
                  </option>
                ))}
              </select>
              {loadingJobs && (
                <span className="text-gray-400 text-sm mt-2 block">加载中...</span>
              )}
            </>
          )}
        </div>

        {/* 拖拽区域 */}
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            error 
              ? 'border-red-500 bg-red-50 cursor-pointer' 
              : isDragging 
                ? 'border-primary-500 bg-blue-50 cursor-pointer' 
                : 'border-gray-300 bg-gray-50 cursor-default'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">📄</div>
            <p className="text-gray-600 text-lg">
              拖拽 PDF 文件到这里，或
              <label 
                className="text-blue-600 underline cursor-pointer ml-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                点击选择（支持多选）
              </label>
            </p>
            
            {/* 文件列表 */}
            {selectedFiles.length > 0 && (
              <div className="mt-4 text-left w-full max-w-md">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-800 font-semibold text-sm">
                    已选择 {selectedFiles.length} 个文件：
                  </p>
                  <button
                    onClick={handleClearAllFiles}
                    className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded border border-red-300 hover:bg-red-50 transition-colors"
                  >
                    清空全部
                  </button>
                </div>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-blue-600 text-sm">•</span>
                        <span className="text-blue-600 text-sm truncate" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="text-red-400 hover:text-red-600 text-xs font-medium ml-2 px-2 py-1 rounded hover:bg-red-50 transition-colors flex-shrink-0"
                        title="删除文件"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="text-red-400 text-sm text-center mt-4">{error}</p>
        )}

        {/* 上传进度 */}
        {uploading && (
          <div className="mt-4">
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ 
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%` 
                }}
              />
            </div>
            <p className="text-gray-600 text-sm text-center mt-2">
              正在上传: {uploadProgress.current} / {uploadProgress.total}
            </p>
          </div>
        )}

        {/* 上传按钮 */}
        <button
          className={`w-full py-3 px-4 rounded-lg font-semibold text-white mt-6 transition-colors ${
            selectedFiles.length === 0 || uploading
              ? 'bg-gray-600 cursor-not-allowed opacity-60'
              : 'btn-primary'
          }`}
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || uploading}
        >
          {uploading 
            ? `上传中 (${uploadProgress.current}/${uploadProgress.total})` 
            : `上传 ${selectedFiles.length > 0 ? selectedFiles.length : ''} 个简历`
          }
        </button>
      </div>

      {/* 上传结果 */}
      {uploadResults.length > 0 && (
        <div className="card p-6">
          <h3 className="text-xl font-bold text-white mb-4">上传结果</h3>
          <div className="space-y-3">
            {uploadResults.map((result, index) => (
              <div 
                key={index} 
                className={`flex items-start gap-3 p-4 rounded-lg border ${
                  result.success 
                    ? 'border-green-500/30 bg-green-500/10' 
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className={`text-lg font-bold ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {result.success ? '✓' : '✗'}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{result.filename}</p>
                  <p className={`text-sm mt-1 ${
                    result.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {result.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 解析结果 */}
      {showParsedTexts && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">
              解析结果 ({parsedTexts.length} 个文件)
            </h3>
            <button
              className="w-8 h-8 bg-gray-600 text-white rounded flex items-center justify-center hover:bg-gray-700 transition-colors"
              onClick={() => setShowParsedTexts(false)}
            >
              ✕
            </button>
          </div>
          <div className="bg-gray-700 p-4 rounded-lg max-h-96 overflow-auto">
            {parsedTexts.map((item, index) => (
              <div key={index} className="mb-6 pb-6 border-b border-gray-600 last:border-b-0 last:mb-0 last:pb-0">
                <h4 className="text-white font-semibold text-lg mb-3">{item.filename}</h4>
                <pre className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {item.resume_text}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;
