import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import {
  Permission,
  shouldShowElement,
  isButtonDisabled,
  getPermissionHint
} from '../utils/permissions';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  Space,
  Typography,
  Alert,
  Card,
  Tooltip,
  message,
  Popconfirm
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BankOutlined,
  CopyOutlined,
  KeyOutlined,
  TeamOutlined,
  UserAddOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const CompanyManagement = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [currentCompany, setCurrentCompany] = useState(null);
  const [form] = Form.useForm();
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [userModalCompany, setUserModalCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [addUserLoading, setAddUserLoading] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || '获取公司列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    form.setFieldsValue({ name: '' });
    setCurrentCompany(null);
    setShowModal(true);
  };

  const handleEdit = (company) => {
    setModalMode('edit');
    form.setFieldsValue({ name: company.name });
    setCurrentCompany(company);
    setShowModal(true);
  };

  const handleDelete = async (company) => {
    try {
      await api.delete(`/companies/${company.id}`);
      setCompanies(companies.filter(c => c.id !== company.id));
      message.success(`公司「${company.name}」已删除`);
    } catch (err) {
      setError(err.response?.data?.detail || '删除公司失败');
    }
  };

  const handleResetInviteCode = async (company) => {
    try {
      const response = await api.post(`/companies/${company.id}/reset-invite-code`);
      setCompanies(companies.map(c =>
        c.id === company.id ? response.data : c
      ));
      message.success(`邀请码已重置：${response.data.invite_code}`);
    } catch (err) {
      setError(err.response?.data?.detail || '重置邀请码失败');
    }
  };

  const handleSubmit = async (values) => {
    setError('');
    try {
      if (modalMode === 'create') {
        const response = await api.post('/companies', values);
        setCompanies([response.data, ...companies]);
        message.success('公司创建成功');
      } else {
        const response = await api.put(`/companies/${currentCompany.id}`, values);
        setCompanies(companies.map(c =>
          c.id === currentCompany.id ? response.data : c
        ));
        message.success('公司更新成功');
      }
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.detail || '操作失败');
    }
  };

  const goToRegisterWithCode = (code) => {
    // 复制到剪贴板并跳转注册页
    navigator.clipboard.writeText(code).catch(() => {});
    message.success('邀请码已复制，正在跳转注册页...');
    setTimeout(() => {
      window.open(`/register?invite_code=${code}`, '_blank');
    }, 300);
  };

  const handleViewUsers = async (company) => {
    setUserModalCompany(company);
    setUserModalVisible(true);
    setUsersLoading(true);
    try {
      const response = await api.get(`/companies/${company.id}/users`);
      setCompanyUsers(response.data);
    } catch (err) {
      message.error('获取公司用户列表失败');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRemoveUser = async (user) => {
    try {
      await api.put(`/companies/${userModalCompany.id}/users/${user.id}?action=remove`);
      setCompanyUsers(companyUsers.filter(u => u.id !== user.id));
      fetchCompanies();
      message.success(`已将用户「${user.username}」从公司中移除`);
    } catch (err) {
      message.error(err.response?.data?.detail || '移除用户失败');
    }
  };

  const handleOpenAddUserModal = async () => {
    setSelectedUserIds([]);
    setAddUserModalVisible(true);
    setAllUsersLoading(true);
    try {
      const response = await api.get('/users');
      // 过滤掉已属于该公司的用户
      const existingIds = new Set(companyUsers.map(u => u.id));
      setAllUsers(response.data.filter(u => !existingIds.has(u.id)));
    } catch (err) {
      message.error('获取用户列表失败');
    } finally {
      setAllUsersLoading(false);
    }
  };

  const handleBatchAddUsers = async () => {
    if (selectedUserIds.length === 0) {
      message.warning('请至少选择一个用户');
      return;
    }
    setAddUserLoading(true);
    try {
      const response = await api.post(
        `/companies/${userModalCompany.id}/users/batch`,
        { user_ids: selectedUserIds }
      );
      message.success(response.data.message);
      setAddUserModalVisible(false);
      setSelectedUserIds([]);
      // 刷新当前公司用户列表
      handleViewUsers(userModalCompany);
      fetchCompanies();
    } catch (err) {
      message.error(err.response?.data?.detail || '批量关联用户失败');
    } finally {
      setAddUserLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    const roleMap = {
      admin: '管理员',
      manager: '经理',
      hr: '人力资源',
      recruiter: '招聘专员',
      interviewer: '面试官',
      user: '普通用户'
    };
    return roleMap[role] || role;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const columns = [
    {
      title: '公司名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => (
        <Space>
          <BankOutlined style={{ color: '#4f46e5' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '邀请码',
      dataIndex: 'invite_code',
      key: 'invite_code',
      width: 180,
      render: (code) => (
        <Space>
          <Tag
            color="blue"
            style={{
              fontFamily: 'monospace',
              fontSize: '14px',
              letterSpacing: '2px',
              cursor: 'pointer'
            }}
            onClick={() => goToRegisterWithCode(code)}
          >
            {code}
          </Tag>
          <Tooltip title="复制并前往注册">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => goToRegisterWithCode(code)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'user_count',
      key: 'user_count',
      width: 100,
      sorter: (a, b) => a.user_count - b.user_count,
      render: (count) => (
        <Tag color={count > 0 ? 'green' : 'default'}>
          {count} 人
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
      width: 320,
      render: (_, company) => (
        <Space size="small" wrap>
          {shouldShowElement(Permission.COMPANY_READ) && (
            <Tooltip title={getPermissionHint(Permission.COMPANY_READ)}>
              <Button
                size="small"
                icon={<TeamOutlined />}
                onClick={() => handleViewUsers(company)}
                disabled={isButtonDisabled(Permission.COMPANY_READ)}
              >
                用户
              </Button>
            </Tooltip>
          )}
          {shouldShowElement(Permission.COMPANY_UPDATE) && (
            <Tooltip title={getPermissionHint(Permission.COMPANY_UPDATE)}>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(company)}
                disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
              >
                编辑
              </Button>
            </Tooltip>
          )}
          {shouldShowElement(Permission.COMPANY_UPDATE) && (
            <Popconfirm
              title="重置邀请码"
              description="旧邀请码将失效，新用户将无法使用旧邀请码注册。确认重置？"
              onConfirm={() => handleResetInviteCode(company)}
              okText="确认重置"
              cancelText="取消"
              disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
            >
              <Tooltip title={getPermissionHint(Permission.COMPANY_UPDATE)}>
                <Button
                  size="small"
                  icon={<KeyOutlined />}
                  disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
                >
                  重置邀请码
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
          {shouldShowElement(Permission.COMPANY_DELETE) && (
            <Popconfirm
              title="删除公司"
              description={`删除公司「${company.name}」后，该公司下 ${company.user_count} 个用户将解除公司关联。此操作不可恢复，确认删除？`}
              onConfirm={() => handleDelete(company)}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={isButtonDisabled(Permission.COMPANY_DELETE)}
            >
              <Tooltip title={getPermissionHint(Permission.COMPANY_DELETE)}>
                <Button
                  type="primary"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  disabled={isButtonDisabled(Permission.COMPANY_DELETE)}
                >
                  删除
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}>
          <Title level={2} style={{ margin: 0, color: '#262626' }}>
            公司管理
          </Title>
          {shouldShowElement(Permission.COMPANY_CREATE) && (
            <Tooltip title={getPermissionHint(Permission.COMPANY_CREATE)}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
                disabled={isButtonDisabled(Permission.COMPANY_CREATE)}
              >
                新建公司
              </Button>
            </Tooltip>
          )}
        </div>

        <Alert
          message="公司管理说明"
          description="管理员可在此创建公司并管理邀请码。新用户注册时需提供对应公司的邀请码方可加入。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          closable
        />

        {error && <Alert message={error} type="error" style={{ marginBottom: 16 }} />}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Typography.Text type="secondary">加载中...</Typography.Text>
          </div>
        ) : (
          <Card>
            <Table
              columns={columns}
              dataSource={companies}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
              }}
              locale={{
                emptyText: (
                  <div style={{ textAlign: 'center', padding: 48 }}>
                    <Typography.Text type="secondary">
                      暂无公司数据，点击上方按钮创建
                    </Typography.Text>
                  </div>
                )
              }}
            />
          </Card>
        )}
      </div>

      {/* 创建/编辑模态框 */}
      <Modal
        title={modalMode === 'create' ? '新建公司' : '编辑公司'}
        open={showModal}
        onCancel={() => setShowModal(false)}
        footer={null}
        width={480}
        transitionName=""
      >
        <Alert
          message={
            modalMode === 'create'
              ? '创建新公司后将自动生成邀请码，用户可通过邀请码注册加入。'
              : '修改公司名称。邀请码如需修改请使用「重置邀请码」功能。'
          }
          type="info"
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item
            label="公司名称"
            name="name"
            rules={[{ required: true, message: '请输入公司名称' }]}
          >
            <Input
              prefix={<BankOutlined />}
              placeholder="请输入公司名称"
              maxLength={50}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setShowModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {modalMode === 'create' ? '创建公司' : '保存修改'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看公司用户弹窗 */}
      <Modal
        title={
          <Space>
            <TeamOutlined />
            <span>{userModalCompany?.name} - 用户列表</span>
            <Tag color="blue">{companyUsers.length} 人</Tag>
          </Space>
        }
        open={userModalVisible}
        onCancel={() => {
          setUserModalVisible(false);
          setCompanyUsers([]);
        }}
        footer={
          shouldShowElement(Permission.COMPANY_UPDATE) ? (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handleOpenAddUserModal}
              disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
            >
              添加用户
            </Button>
          ) : null
        }
        width={720}
        transitionName=""
      >
        {usersLoading ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Typography.Text type="secondary">加载中...</Typography.Text>
          </div>
        ) : companyUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <Typography.Text type="secondary">
              该公司暂无用户，点击下方"添加用户"按钮进行关联
            </Typography.Text>
          </div>
        ) : (
          <Table
            dataSource={companyUsers}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              {
                title: '用户名',
                dataIndex: 'username',
                width: 100,
              },
              {
                title: '姓名',
                dataIndex: 'full_name',
                width: 100,
                render: (text) => text || '-',
              },
              {
                title: '邮箱',
                dataIndex: 'email',
                width: 160,
                ellipsis: true,
              },
              {
                title: '角色',
                dataIndex: 'role',
                width: 90,
                render: (role) => <Tag color="blue">{getRoleLabel(role)}</Tag>,
              },
              {
                title: '状态',
                dataIndex: 'is_active',
                width: 70,
                render: (active) => (
                  <Tag color={active ? 'green' : 'red'}>
                    {active ? '启用' : '禁用'}
                  </Tag>
                ),
              },
              ...(shouldShowElement(Permission.COMPANY_UPDATE) ? [{
                title: '操作',
                width: 80,
                render: (_, user) => (
                  <Popconfirm
                    title="移除用户"
                    description={`确认将「${user.username}」从公司中移除？`}
                    onConfirm={() => handleRemoveUser(user)}
                    okText="确认"
                    cancelText="取消"
                    disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
                  >
                    <Button
                      type="link"
                      danger
                      size="small"
                      disabled={isButtonDisabled(Permission.COMPANY_UPDATE)}
                    >
                      移除
                    </Button>
                  </Popconfirm>
                ),
              }] : []),
            ]}
          />
        )}
      </Modal>

      {/* 添加用户弹窗 */}
      <Modal
        title={
          <Space>
            <UserAddOutlined />
            <span>添加用户到「{userModalCompany?.name}」</span>
          </Space>
        }
        open={addUserModalVisible}
        onCancel={() => {
          setAddUserModalVisible(false);
          setSelectedUserIds([]);
        }}
        onOk={handleBatchAddUsers}
        confirmLoading={addUserLoading}
        okText={`确认添加（${selectedUserIds.length} 人）`}
        cancelText="取消"
        width={640}
        transitionName=""
      >
        <Alert
          message="选择要关联到该公司的用户，已关联的用户不会出现在列表中。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={allUsers}
          rowKey="id"
          size="small"
          loading={allUsersLoading}
          pagination={false}
          scroll={{ y: 360 }}
          rowSelection={{
            selectedRowKeys: selectedUserIds,
            onChange: (keys) => setSelectedUserIds(keys),
          }}
          columns={[
            {
              title: '用户名',
              dataIndex: 'username',
              width: 100,
            },
            {
              title: '姓名',
              dataIndex: 'full_name',
              width: 100,
              render: (text) => text || '-',
            },
            {
              title: '邮箱',
              dataIndex: 'email',
              ellipsis: true,
            },
            {
              title: '角色',
              dataIndex: 'role',
              width: 90,
              render: (role) => <Tag color="blue">{getRoleLabel(role)}</Tag>,
            },
          ]}
          locale={{
            emptyText: (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Typography.Text type="secondary">
                  没有可添加的用户（所有用户已关联该公司）
                </Typography.Text>
              </div>
            )
          }}
        />
      </Modal>
    </div>
  );
};

export default CompanyManagement;
