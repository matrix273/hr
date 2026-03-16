import React, { useState } from 'react';
import api from '../utils/api';

const ResumeUpload = ({ onUploadSuccess }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [parsedTexts, setParsedTexts] = useState([]);
  const [showParsedTexts, setShowParsedTexts] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadResults, setUploadResults] = useState([]);

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

    setUploading(true);
    setError('');
    setUploadProgress({ current: 0, total: selectedFiles.length });
    setUploadResults([]);
    const results = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);

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
    <div style={styles.container}>
      <div style={styles.uploadSection}>
        <h2 style={styles.title}>上传简历</h2>

        <div
          style={{
            ...styles.dropZone,
            borderColor: error ? '#e74c3c' : (isDragging ? '#667eea' : '#ddd'),
            backgroundColor: isDragging ? '#f0f4ff' : '#fafafa'
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div style={styles.dropZoneContent}>
            <div style={styles.dropZoneIcon}>📄</div>
            <p style={styles.dropZoneText}>
              拖拽 PDF 文件到这里，或
              <label style={styles.fileInputLabel}>
                <input
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  style={styles.fileInput}
                />
                点击选择（支持多选）
              </label>
            </p>
            {selectedFiles.length > 0 && (
              <div style={styles.fileList}>
                <p style={styles.fileCount}>已选择 {selectedFiles.length} 个文件：</p>
                {selectedFiles.map((file, index) => (
                  <p key={index} style={styles.selectedFile}>• {file.name}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {uploading && (
          <div style={styles.uploadProgress}>
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBar,
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
                }}
              />
            </div>
            <p style={styles.progressText}>
              正在上传: {uploadProgress.current} / {uploadProgress.total}
            </p>
          </div>
        )}

        <button
          style={{
            ...styles.uploadButton,
            opacity: (selectedFiles.length === 0 || uploading) ? 0.6 : 1,
            cursor: (selectedFiles.length === 0 || uploading) ? 'not-allowed' : 'pointer'
          }}
          onClick={handleUpload}
          disabled={selectedFiles.length === 0 || uploading}
        >
          {uploading ? `上传中 (${uploadProgress.current}/${uploadProgress.total})` : `上传 ${selectedFiles.length > 0 ? selectedFiles.length : ''} 个简历`}
        </button>
      </div>

      {uploadResults.length > 0 && (
        <div style={styles.uploadResults}>
          <h3 style={styles.resultsTitle}>上传结果</h3>
          <div style={styles.resultsList}>
            {uploadResults.map((result, index) => (
              <div key={index} style={{
                ...styles.resultItem,
                borderColor: result.success ? '#10b981' : '#e74c3c'
              }}>
                <div style={styles.resultIcon}>{result.success ? '✓' : '✗'}</div>
                <div style={styles.resultInfo}>
                  <p style={styles.resultFilename}>{result.filename}</p>
                  <p style={{
                    ...styles.resultMessage,
                    color: result.success ? '#10b981' : '#e74c3c'
                  }}>
                    {result.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showParsedTexts && (
        <div style={styles.parsedSection}>
          <div style={styles.parsedHeader}>
            <h3 style={styles.parsedTitle}>解析结果 ({parsedTexts.length} 个文件)</h3>
            <button
              style={styles.closeButton}
              onClick={() => setShowParsedTexts(false)}
            >
              ✕
            </button>
          </div>
          <div style={styles.parsedTextContainer}>
            {parsedTexts.map((item, index) => (
              <div key={index} style={styles.parsedItem}>
                <h4 style={styles.parsedFilename}>{item.filename}</h4>
                <pre style={styles.parsedText}>{item.resume_text}</pre>
              </div>
            ))}
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
    gap: '24px',
  },
  uploadSection: {
    backgroundColor: 'white',
    padding: '32px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '24px',
  },
  dropZone: {
    border: '2px dashed #ddd',
    borderRadius: '12px',
    padding: '48px 32px',
    textAlign: 'center',
    transition: 'all 0.2s',
    backgroundColor: '#fafafa',
    userSelect: 'none',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
  },
  dropZoneIcon: {
    fontSize: '48px',
  },
  dropZoneText: {
    fontSize: '16px',
    color: '#666',
  },
  fileInputLabel: {
    color: '#667eea',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  fileInput: {
    display: 'none',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '500px',
  },
  fileCount: {
    fontSize: '14px',
    color: '#333',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  selectedFile: {
    fontSize: '13px',
    color: '#667eea',
    margin: 0,
  },
  uploadProgress: {
    marginTop: '16px',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#667eea',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    margin: 0,
  },
  error: {
    color: '#e74c3c',
    fontSize: '14px',
    textAlign: 'center',
    marginTop: '16px',
  },
  uploadButton: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 'bold',
    marginTop: '16px',
    transition: 'backgroundColor 0.2s',
  },
  parsedSection: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  parsedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  parsedTitle: {
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
  parsedTextContainer: {
    backgroundColor: '#fafafa',
    padding: '16px',
    borderRadius: '8px',
    maxHeight: '400px',
    overflow: 'auto',
  },
  parsedText: {
    margin: 0,
    fontSize: '14px',
    color: '#333',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },
  parsedItem: {
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e0e0e0',
  },
  parsedFilename: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '12px',
  },
  uploadResults: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  resultsTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '16px',
    margin: 0,
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  resultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    border: '1px solid',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
  },
  resultIcon: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginTop: '2px',
  },
  resultInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  resultFilename: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  resultMessage: {
    fontSize: '14px',
    margin: 0,
  },
};

export default ResumeUpload;
