import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  Permission,
  hasPermission, 
  getButtonStyle, 
  isButtonDisabled,
  shouldShowElement,
  getPermissionHint,
  getCurrentUser
} from '../utils/permissions';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Space,
  Typography,
  Alert,
  Card,
  Divider,
  Tooltip,
  Row,
  Col
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  MailOutlined,
  LockOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentUser, setCurrentUser] = useState(null);
  const [form] = Form.useForm();

  const roles = [
    { value: 'admin', label: '管理员' },
    { value: 'manager', label: '经理' },
    { value: 'hr', label: '人力资源' },
    { value: 'recruiter', label: '招聘专员' },
    { value: 'interviewer', label: '面试官' },
    { value: 'user', label: '普通用户' }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    form.setFieldsValue({
      username: '',
      email: '',
      password: '',
      full_name: '',
      role: 'user',
      is_active: true
    });
    setCurrentUser(null);
    setShowModal(true);
  };

  const handleEdit = (user) => {
    // 检查权限：非管理员不能编辑管理员账号
    const currentUser = getCurrentUser();
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      setError('无权编辑管理员账号');
      return;
    }
    
    setModalMode('edit');
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active,
      password: ''
    });
    setCurrentUser(user);
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    // 检查权限：非管理员不能删除管理员账号
    const currentUser = getCurrentUser();
    if (user.role === 'admin' && currentUser?.role !== 'admin') {
      setError('无权删除管理员账号');
      return;
    }

    if (!window.confirm(`确定要删除用户 "${user.username}" 吗？`)) {
      return;
    }

    try {
      await api.delete(`/users/${user.id}`);
      setUsers(users.filter(u => u.id !== user.id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || '删除用户失败');
    }
  };

  const handleSubmit = async (values) => {
    setError('');

    try {
      if (modalMode === 'create') {
        const response = await api.post('/users', values);
        setUsers([response.data, ...users]);
      } else {
        const updateData = { ...values };
        if (!updateData.password) {
          delete updateData.password;
        }
        const response = await api.put(`/users/${currentUser.id}`, updateData);
        setUsers(users.map(u => u.id === currentUser.id ? response.data : u));
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || '操作失败');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
  };

  const getRoleLabel = (roleValue) => {
    const role = roles.find(r => r.value === roleValue);
    return role ? role.label : roleValue;
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color="blue">
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (date) => formatDate(date),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, user) => (
        <Space size="small">
          {shouldShowElement(Permission.USER_UPDATE) && (
            <Tooltip title={getPermissionHint(Permission.USER_UPDATE)}>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(user)}
                disabled={isButtonDisabled(Permission.USER_UPDATE)}
              >
                编辑
              </Button>
            </Tooltip>
          )}
          {shouldShowElement(Permission.USER_DELETE) && (
            <Tooltip title={getPermissionHint(Permission.USER_DELETE)}>
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(user)}
                disabled={isButtonDisabled(Permission.USER_DELETE)}
              >
                删除
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={2} style={{ margin: 0, color: '#262626' }}>用户管理</Title>
          {shouldShowElement(Permission.USER_CREATE) && (
            <Tooltip title={getPermissionHint(Permission.USER_CREATE)}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                disabled={isButtonDisabled(Permission.USER_CREATE)}
              >
                新建用户
              </Button>
            </Tooltip>
          )}
        </div>

        {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Typography.Text type="secondary">加载中...</Typography.Text>
          </div>
        ) : (
          <Card>
            <Table
              columns={columns}
              dataSource={users}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              }}
              locale={{
                emptyText: (
                  <div style={{ textAlign: 'center', padding: 48 }}>
                    <Typography.Text type="secondary">暂无用户数据</Typography.Text>
                  </div>
                )
              }}
            />
          </Card>
        )}
      </div>

      {/* 模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建用户' : '编辑用户'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        width={600}
        transitionName=""
      >
        <Alert
          message={modalMode === 'create' ? '创建新用户账户。带 * 的字段为必填项。' : '修改用户信息。密码留空则不修改。'}
          type="info"
          style={{ marginBottom: 16 }}
        />
        
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Row gutter={16}>
            {modalMode === 'create' ? (
              <>
                <Col span={12}>
                  <Form.Item
                    label="用户名"
                    name="username"
                    rules={[{ required: true, message: '请输入用户名' }]}
                  >
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="请输入用户名"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Input.Password
                      prefix={<LockOutlined />}
                      placeholder="请输入密码"
                    />
                  </Form.Item>
                </Col>
              </>
            ) : (
              <Col span={12}>
                <Form.Item
                  label="用户名"
                >
                  <Input
                    prefix={<UserOutlined />}
                    value={currentUser?.username}
                    readOnly
                  />
                </Form.Item>
              </Col>
            )}
            <Col span={modalMode === 'create' ? 12 : 12}>
              <Form.Item
                label="邮箱"
                name="email"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="请输入邮箱地址"
                />
              </Form.Item>
            </Col>
            <Col span={modalMode === 'create' ? 12 : 12}>
              <Form.Item label="姓名" name="full_name">
                <Input
                  placeholder="请输入真实姓名"
                />
              </Form.Item>
            </Col>
          </Row>
          
          {modalMode === 'edit' && (
            <Form.Item label="新密码" name="password" help="留空则保持原密码不变">
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="留空则不修改密码"
              />
            </Form.Item>
          )}
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="角色"
                name="role"
                rules={[{ required: true, message: '请选择角色' }]}
              >
                <Select
                  placeholder="请选择角色"
                  disabled={modalMode === 'edit' && getCurrentUser()?.role !== 'admin'}
                  options={roles.map(role => ({
                    value: role.value,
                    label: role.label
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="状态" name="is_active" help="禁用后用户将无法登录系统" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          
          {/* 角色说明 */}
          <Card size="small" title="角色权限说明" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>管理员：</strong>拥有所有权限，可管理用户和系统
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>经理：</strong>可管理岗位和筛选，可查看和更新用户信息
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>人力资源：</strong>可管理简历、岗位和筛选，可查看用户
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>招聘专员：</strong>可上传简历和执行筛选
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>面试官：</strong>仅可查看简历和岗位信息
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                <strong>普通用户：</strong>仅可浏览简历和岗位
              </Typography.Text>
            </div>
          </Card>
          
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowModal(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {modalMode === 'create' ? '创建用户' : '保存修改'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c62828',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '48px',
    color: '#999',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 'bold',
    color: '#333',
    fontSize: '14px',
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    fontSize: '14px',
    color: '#666',
  },
  roleTag: {
    padding: '4px 12px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  statusTag: {
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500',
  },
  actionButton: {
    padding: '6px 12px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
    marginRight: '8px',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
  },
  empty: {
    textAlign: 'center',
    padding: '48px',
    color: '#999',
    fontSize: '16px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '600px',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  modalTitle: {
    fontSize: '20px',
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
  modalDescription: {
    padding: '16px 24px',
    backgroundColor: '#e3f2fd',
    borderBottom: '1px solid #e0e0e0',
  },
  descriptionText: {
    fontSize: '14px',
    color: '#1976d2',
    margin: 0,
    lineHeight: '1.5',
  },
  form: {
    padding: '24px',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '0',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '8px',
  },
  required: {
    color: '#e74c3c',
    marginLeft: '2px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    transition: 'border-color 0.2s',
    outline: 'none',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: 'white',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
    color: '#333',
  },
  hint: {
    display: 'block',
    fontSize: '12px',
    color: '#999',
    marginTop: '4px',
    fontStyle: 'italic',
  },
  checkboxContainer: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxText: {
    fontSize: '14px',
    color: '#555',
    fontWeight: '500',
  },
  roleDescription: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
  },
  roleTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '12px',
    margin: '0 0 12px 0',
  },
  roleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  roleItem: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.5',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f5f5f5',
    color: '#666',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
};

// 添加动态样式（聚焦效果）
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  input:focus, select:focus {
    border-color: #667eea !important;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
  }
  
  button:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .user-management-table tr:hover {
    background-color: #f8f9fa;
  }
`;
if (!document.querySelector('style[data-user-management]')) {
  styleSheet.setAttribute('data-user-management', 'true');
  document.head.appendChild(styleSheet);
}

export default UserManagement;
