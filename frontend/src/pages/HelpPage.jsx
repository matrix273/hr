import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './HelpPage.css';

const HelpPage = () => {
  const navigate = useNavigate();
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 加载Markdown文件
    const loadMarkdown = async () => {
      try {
        // 使用相对路径加载Markdown文件
        const response = await fetch('./Help.md');
        if (response.ok) {
          const content = await response.text();
          setMarkdownContent(content);
        } else {
          // 如果文件不存在，使用默认内容
          setMarkdownContent('# 帮助文档加载失败\n\n请确保Help.md文件存在或稍后重试。');
        }
      } catch (error) {
        console.error('加载帮助文档失败:', error);
        setMarkdownContent('# 帮助文档加载失败\n\n请检查网络连接或联系管理员。');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdown();
  }, []);

  const handleBack = () => {
    navigate(-1); // 返回上一页
  };

  if (loading) {
    return (
      <div className="help-container">
        <div className="help-header">
          <h1>系统帮助文档</h1>
          <button onClick={handleBack} className="back-btn">返回</button>
        </div>
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="help-container">
      <div className="help-header">
        <h1>系统帮助文档</h1>
        <button onClick={handleBack} className="back-btn">返回</button>
      </div>
      
      <div className="markdown-content">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({node, ...props}) => <h1 style={{color: '#1890ff', borderBottom: '2px solid #1890ff', paddingBottom: '8px'}} {...props} />,
            h2: ({node, ...props}) => <h2 style={{color: '#52c41a', borderLeft: '4px solid #52c41a', paddingLeft: '12px'}} {...props} />,
            h3: ({node, ...props}) => <h3 style={{color: '#fa541c'}} {...props} />,
            img: ({node, ...props}) => (
              <img 
                {...props} 
                style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block',
                  margin: '16px auto',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
                alt={props.alt || '图片'}
              />
            ),
            table: ({node, ...props}) => (
              <div style={{overflowX: 'auto'}}>
                <table {...props} style={{borderCollapse: 'collapse', width: '100%', margin: '16px 0'}} />
              </div>
            ),
            th: ({node, ...props}) => <th {...props} style={{border: '1px solid #ddd', padding: '8px', backgroundColor: '#f5f5f5'}} />,
            td: ({node, ...props}) => <td {...props} style={{border: '1px solid #ddd', padding: '8px'}} />,
            code: ({node, inline, ...props}) => 
              inline ? 
                <code {...props} style={{background: '#f0f0f0', padding: '2px 4px', borderRadius: '3px'}} /> :
                <pre><code {...props} style={{background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto'}} /></pre>,
            blockquote: ({node, ...props}) => <blockquote {...props} style={{borderLeft: '4px solid #1890ff', margin: '16px 0', paddingLeft: '16px', background: '#f0f8ff'}} />
          }}
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default HelpPage;