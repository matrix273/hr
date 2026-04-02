import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, Modal, message, Tooltip, Input
} from 'antd';
import {
  MailOutlined, ReloadOutlined, CheckCircleOutlined,
  EyeOutlined, ExclamationCircleOutlined, SendOutlined
} from '@ant-design/icons';
import { shouldShowElement, Permission } from '../utils/permissions';
import api from '../utils/api';

const { Title, Text } = Typography;

/** 状态配置 */
const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'warning' },
  processed: { label: '已处理', color: 'success' },
};

const MessageManagement = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentContact, setCurrentContact] = useState(null);
  const [replyVisible, setReplyVisible] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [replySending, setReplySending] = useState(false);

  /** 获取消息列表 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/messages');
      setData(res.data || []);
    } catch (err) {
      console.error('获取消息列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** 标记为已处理 */
  const handleMarkProcessed = async (record) => {
    try {
      await api.put(`/messages/${record.id}`, null, {
        params: { status: 'processed' }
      });
      message.success('已标记为处理完成');
      fetchData();
    } catch (err) {
      message.error('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  /** 标记为待处理 */
  const handleMarkPending = async (record) => {
    try {
      await api.put(`/messages/${record.id}`, null, {
        params: { status: 'pending' }
      });
      message.success('已恢复为待处理');
      fetchData();
    } catch (err) {
      message.error('操作失败: ' + (err.response?.data?.detail || err.message));
    }
  };

  /** 查看详情 */
  const handleViewDetail = (record) => {
    setCurrentContact(record);
    setDetailVisible(true);
  };

  /** 打开回复弹窗 */
  const handleOpenReply = (record) => {
    setCurrentContact(record);
    setReplyContent('');
    setDetailVisible(false);
    setReplyVisible(true);
  };

  /** 发送回复邮件 */
  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }
    setReplySending(true);
    try {
      await api.post(`/messages/${currentContact.id}/reply`, {
        reply_content: replyContent.trim()
      });
      message.success('回复邮件已发送');
      setReplyVisible(false);
      setDetailVisible(false);
      fetchData();
    } catch (err) {
      message.error('发送失败: ' + (err.response?.data?.detail || err.message));
    } finally {
      setReplySending(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '联系人',
      dataIndex: 'name',
      width: 120,
      render: (val) => <Text strong>{val}</Text>,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: '留言内容',
      dataIndex: 'message',
      ellipsis: true,
      render: (val) => (
        <Tooltip title={val} placement="topLeft">
          <Text style={{ maxWidth: 300 }}>{val}</Text>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (val) => {
        const cfg = STATUS_CONFIG[val] || { label: val, color: 'default' };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      width: 180,
      render: (val) => {
        if (!val) return '-';
        return new Date(val).toLocaleString('zh-CN');
      },
    },
    {
      title: '操作',
      width: 320,
      render: (_, record) => (
        <Space>
          <Button size="middle" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          <Button type="primary" size="middle" icon={<SendOutlined />} onClick={() => handleOpenReply(record)}>
            回复
          </Button>
          {record.status === 'pending' ? (
            <Button size="middle" icon={<CheckCircleOutlined />} onClick={() => handleMarkProcessed(record)}>
              已处理
            </Button>
          ) : (
            <Button size="middle" icon={<ExclamationCircleOutlined />} onClick={() => handleMarkPending(record)}>
              待处理
            </Button>
          )}
        </Space>
      ),
    },
  ];

  /** 统计待处理数量 */
  const pendingCount = data.filter((item) => item.status === 'pending').length;

  // 无权限提示
  if (!shouldShowElement(Permission.SYSTEM_ADMIN)) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <MailOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>当前用户无此操作权限</div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            <MailOutlined style={{ marginRight: 8 }} />
            消息管理
          </Title>
          {pendingCount > 0 && (
            <Tag color="warning">{pendingCount} 条待处理</Tag>
          )}
        </Space>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="middle"
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="消息详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={[
          <Button
            key="reply"
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleOpenReply(currentContact)}
          >
            邮件回复
          </Button>,
          currentContact?.status === 'pending' && (
            <Button
              key="processed"
              icon={<CheckCircleOutlined />}
              onClick={async () => {
                await handleMarkProcessed(currentContact);
                setDetailVisible(false);
              }}
            >
              标记已处理
            </Button>
          ),
          <Button key="close" onClick={() => setDetailVisible(false)}>
            关闭
          </Button>,
        ]}
        width={560}
      >
        {currentContact && (
          <div style={{ lineHeight: 2 }}>
            <div>
              <Text type="secondary">联系人：</Text>
              <Text strong>{currentContact.name}</Text>
            </div>
            <div>
              <Text type="secondary">邮箱：</Text>
              <Text>{currentContact.email}</Text>
            </div>
            <div>
              <Text type="secondary">状态：</Text>
              <Tag color={STATUS_CONFIG[currentContact.status]?.color}>
                {STATUS_CONFIG[currentContact.status]?.label || currentContact.status}
              </Tag>
            </div>
            <div>
              <Text type="secondary">提交时间：</Text>
              <Text>
                {currentContact.created_at
                  ? new Date(currentContact.created_at).toLocaleString('zh-CN')
                  : '-'}
              </Text>
            </div>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">留言内容：</Text>
              <Card
                size="small"
                style={{ marginTop: 4, background: '#fafafa' }}
                bodyStyle={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {currentContact.message}
              </Card>
            </div>
          </div>
        )}
      </Modal>

      {/* 回复弹窗 */}
      <Modal
        title={
          <Space>
            <SendOutlined />
            <span>邮件回复</span>
            <Text type="secondary" style={{ fontSize: 13 }}>
              → {currentContact?.email}
            </Text>
          </Space>
        }
        open={replyVisible}
        onCancel={() => setReplyVisible(false)}
        onOk={handleSendReply}
        okText="发送回复"
        cancelText="取消"
        confirmLoading={replySending}
        width={560}
      >
        {currentContact && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">原始留言（{currentContact.name} 于 {currentContact.created_at
                ? new Date(currentContact.created_at).toLocaleString('zh-CN')
                : '-'}）：</Text>
              <Card
                size="small"
                style={{ marginTop: 4, background: '#fafafa' }}
                bodyStyle={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 13, color: '#666' }}
              >
                {currentContact.message}
              </Card>
            </div>
            <div>
              <Text strong>回复内容：</Text>
              <Input.TextArea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="请输入回复内容..."
                rows={5}
                style={{ marginTop: 4 }}
                showCount
                maxLength={2000}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MessageManagement;
