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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 m-0">用户管理</h2>
        {shouldShowElement(Permission.USER_CREATE) && (
          <button 
            className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-md text-sm font-medium cursor-pointer hover:opacity-90 hover:translate-y-px transition-all"
            onClick={handleCreate}
            disabled={isButtonDisabled(Permission.USER_CREATE)}
            title={getPermissionHint(Permission.USER_CREATE)}
          >
            + 新建用户
          </button>
        )}
      </div>

      {error && <div className="px-3 py-3 bg-red-50 text-red-700 rounded-md mb-4">{error}</div>}

      {loading ? (
        <div className="text-center py-12 text-gray-500">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full border-collapse user-management-table">
            <thead>
              <tr>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">用户名</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">姓名</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">邮箱</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">角色</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">状态</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">创建时间</th>
                <th className="px-4 py-4 text-left bg-gray-50 border-b-2 border-gray-200 font-bold text-gray-800 text-sm">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-600">{user.username}</td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-600">{user.full_name || '-'}</td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{getRoleLabel(user.role)}</span>
                  </td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      user.is_active 
                        ? 'bg-green-50 text-green-700' 
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {user.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-600">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-4 border-b border-gray-200 text-sm">
                    {shouldShowElement(Permission.USER_UPDATE) && (
                      <button
                        className="px-3 py-1.5 bg-indigo-500 text-white border-none rounded cursor-pointer text-xs mr-2 hover:opacity-90 transition-all"
                        onClick={() => handleEdit(user)}
                        disabled={isButtonDisabled(Permission.USER_UPDATE)}
                        title={getPermissionHint(Permission.USER_UPDATE)}
                      >
                        编辑
                      </button>
                    )}
                    {shouldShowElement(Permission.USER_DELETE) && (
                      <button
                        className="px-3 py-1.5 bg-red-500 text-white border-none rounded cursor-pointer text-xs hover:opacity-90 transition-all"
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
            <div className="text-center py-12 text-gray-500 text-base">暂无用户数据</div>
          )}
        </div>
      )}

      {/* 模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl w-600 max-w-11/12 max-h-90vh overflow-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 m-0">
                {modalMode === 'create' ? '新建用户' : '编辑用户'}
              </h3>
              <button className="bg-transparent border-none text-2xl text-gray-500 cursor-pointer p-1 transition-colors hover:text-gray-700" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            
            {/* 添加说明文字 */}
            <div className="px-6 py-4 bg-blue-50 border-b border-gray-200">
              {modalMode === 'create' ? (
                <p className="text-sm text-blue-700 m-0 leading-normal">
                  创建新用户账户。带 <span className="text-red-500">*</span> 的字段为必填项。
                </p>
              ) : (
                <p className="text-sm text-blue-700 m-0 leading-normal">
                  修改用户信息。密码留空则不修改。
                </p>
              )}
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              {modalMode === 'create' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-0">
                    <div className="mb-5">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        用户名 <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={formData.username}
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        placeholder="请输入用户名"
                        required
                      />
                    </div>
                    <div className="mb-5">
                      <label className="block text-sm font-semibold text-gray-800 mb-2">
                        密码 <span className="text-red-500 ml-0.5">*</span>
                      </label>
                      <input
                        type="password"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        placeholder="请输入密码"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-2 gap-4 mb-0">
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    邮箱 <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="email"
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="请输入邮箱地址"
                    required
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">姓名</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="请输入真实姓名"
                  />
                </div>
              </div>
              {modalMode === 'edit' && (
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">新密码</label>
                  <input
                    type="password"
                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="留空则不修改密码"
                  />
                  <span className="block text-xs text-gray-500 mt-1 italic">留空则保持原密码不变</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-0">
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    角色 <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <select
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-md text-sm bg-white text-gray-800 cursor-pointer outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                  <span className="block text-xs text-gray-500 mt-1 italic">
                    {modalMode === 'edit' && getCurrentUser()?.role !== 'admin' 
                      ? '非管理员不能修改角色' 
                      : '不同角色拥有不同的权限'}
                  </span>
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-semibold text-gray-800 mb-2">状态</label>
                  <div className="flex items-center mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4.5 h-4.5 cursor-pointer"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      />
                      <span className="text-sm text-gray-800 font-medium">
                        {formData.is_active ? '已启用' : '已禁用'}
                      </span>
                    </label>
                  </div>
                  <span className="block text-xs text-gray-500 mt-1 italic">禁用后用户将无法登录系统</span>
                </div>
              </div>
              
              {/* 角色说明 */}
              <div className="mt-5 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-bold text-gray-800 mb-3 m-0">角色权限说明</h4>
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>管理员：</strong>拥有所有权限，可管理用户和系统
                  </div>
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>经理：</strong>可管理岗位和筛选，可查看和更新用户信息
                  </div>
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>人力资源：</strong>可管理简历、岗位和筛选，可查看用户
                  </div>
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>招聘专员：</strong>可上传简历和执行筛选
                  </div>
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>面试官：</strong>仅可查看简历和岗位信息
                  </div>
                  <div className="text-xs text-gray-600 leading-normal">
                    <strong>普通用户：</strong>仅可浏览简历和岗位
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end mt-6 pt-5 border-t border-gray-200">
                <button type="button" className="px-5 py-2.5 bg-gray-100 text-gray-600 border-none rounded-md text-sm cursor-pointer transition-all hover:bg-gray-200" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="px-5 py-2.5 bg-indigo-500 text-white border-none rounded-md text-sm cursor-pointer font-medium transition-all hover:bg-indigo-600">
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
