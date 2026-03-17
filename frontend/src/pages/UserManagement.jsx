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

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    role: 'user',
    is_active: true
  });

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
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setFormData({
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
    setFormData({
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
      await api.delete(`/api/users/${user.id}`);
      setUsers(users.filter(u => u.id !== user.id));
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || '删除用户失败');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (modalMode === 'create') {
        const response = await api.post('/api/users', formData);
        setUsers([response.data, ...users]);
      } else {
        const updateData = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        const response = await api.put(`/api/users/${currentUser.id}`, updateData);
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>用户管理</h2>
        {shouldShowElement(Permission.USER_CREATE) && (
          <button 
            style={getButtonStyle(Permission.USER_CREATE, styles.createButton)}
            onClick={handleCreate}
            disabled={isButtonDisabled(Permission.USER_CREATE)}
            title={getPermissionHint(Permission.USER_CREATE)}
          >
            + 新建用户
          </button>
        )}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {loading ? (
        <div style={styles.loading}>加载中...</div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table} className="user-management-table">
            <thead>
              <tr>
                <th style={styles.th}>用户名</th>
                <th style={styles.th}>姓名</th>
                <th style={styles.th}>邮箱</th>
                <th style={styles.th}>角色</th>
                <th style={styles.th}>状态</th>
                <th style={styles.th}>创建时间</th>
                <th style={styles.th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={styles.td}>{user.username}</td>
                  <td style={styles.td}>{user.full_name || '-'}</td>
                  <td style={styles.td}>{user.email}</td>
                  <td style={styles.td}>
                    <span style={styles.roleTag}>{getRoleLabel(user.role)}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusTag,
                      backgroundColor: user.is_active ? '#e8f5e9' : '#ffebee',
                      color: user.is_active ? '#2e7d32' : '#c62828'
                    }}>
                      {user.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(user.created_at)}</td>
                  <td style={styles.td}>
                    {shouldShowElement(Permission.USER_UPDATE) && (
                      <button
                        style={getButtonStyle(Permission.USER_UPDATE, styles.actionButton)}
                        onClick={() => handleEdit(user)}
                        disabled={isButtonDisabled(Permission.USER_UPDATE)}
                        title={getPermissionHint(Permission.USER_UPDATE)}
                      >
                        编辑
                      </button>
                    )}
                    {shouldShowElement(Permission.USER_DELETE) && (
                      <button
                        style={getButtonStyle(Permission.USER_DELETE, {...styles.actionButton, ...styles.deleteButton})}
                        onClick={() => handleDelete(user)}
                        disabled={isButtonDisabled(Permission.USER_DELETE)}
                        title={getPermissionHint(Permission.USER_DELETE)}
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div style={styles.empty}>暂无用户数据</div>
          )}
        </div>
      )}

      {/* 模态框 */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                {modalMode === 'create' ? '新建用户' : '编辑用户'}
              </h3>
              <button style={styles.closeButton} onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            
            {/* 添加说明文字 */}
            <div style={styles.modalDescription}>
              {modalMode === 'create' ? (
                <p style={styles.descriptionText}>
                  创建新用户账户。带 <span style={styles.required}>*</span> 的字段为必填项。
                </p>
              ) : (
                <p style={styles.descriptionText}>
                  修改用户信息。密码留空则不修改。
                </p>
              )}
            </div>
            
            <form onSubmit={handleSubmit} style={styles.form}>
              {modalMode === 'create' && (
                <>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        用户名 <span style={styles.required}>*</span>
                      </label>
                      <input
                        type="text"
                        style={styles.input}
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        placeholder="请输入用户名"
                        required
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        密码 <span style={styles.required}>*</span>
                      </label>
                      <input
                        type="password"
                        style={styles.input}
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="请输入密码"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    邮箱 <span style={styles.required}>*</span>
                  </label>
                  <input
                    type="email"
                    style={styles.input}
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="请输入邮箱地址"
                    required
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>姓名</label>
                  <input
                    type="text"
                    style={styles.input}
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="请输入真实姓名"
                  />
                </div>
              </div>
              {modalMode === 'edit' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>新密码</label>
                  <input
                    type="password"
                    style={styles.input}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="留空则不修改密码"
                  />
                  <span style={styles.hint}>留空则保持原密码不变</span>
                </div>
              )}
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    角色 <span style={styles.required}>*</span>
                  </label>
                  <select
                    style={styles.select}
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    required
                    disabled={modalMode === 'edit' && getCurrentUser()?.role !== 'admin'}
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <span style={styles.hint}>
                    {modalMode === 'edit' && getCurrentUser()?.role !== 'admin' 
                      ? '非管理员不能修改角色' 
                      : '不同角色拥有不同的权限'}
                  </span>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>状态</label>
                  <div style={styles.checkboxContainer}>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        style={styles.checkbox}
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      />
                      <span style={styles.checkboxText}>
                        {formData.is_active ? '已启用' : '已禁用'}
                      </span>
                    </label>
                  </div>
                  <span style={styles.hint}>禁用后用户将无法登录系统</span>
                </div>
              </div>
              
              {/* 角色说明 */}
              <div style={styles.roleDescription}>
                <h4 style={styles.roleTitle}>角色权限说明</h4>
                <div style={styles.roleList}>
                  <div style={styles.roleItem}>
                    <strong>管理员：</strong>拥有所有权限，可管理用户和系统
                  </div>
                  <div style={styles.roleItem}>
                    <strong>经理：</strong>可管理岗位和筛选，可查看和更新用户信息
                  </div>
                  <div style={styles.roleItem}>
                    <strong>人力资源：</strong>可管理简历、岗位和筛选，可查看用户
                  </div>
                  <div style={styles.roleItem}>
                    <strong>招聘专员：</strong>可上传简历和执行筛选
                  </div>
                  <div style={styles.roleItem}>
                    <strong>面试官：</strong>仅可查看简历和岗位信息
                  </div>
                  <div style={styles.roleItem}>
                    <strong>普通用户：</strong>仅可浏览简历和岗位
                  </div>
                </div>
              </div>
              
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" style={styles.submitButton}>
                  {modalMode === 'create' ? '创建用户' : '保存修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
