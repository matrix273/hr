/**
 * 权限管理工具
 * 根据用户角色控制前端按钮的显示和禁用状态
 */

// 权限枚举（与后端保持一致）
export const Permission = {
  // 简历管理
  RESUME_READ: "resume:read",
  RESUME_CREATE: "resume:create", 
  RESUME_UPDATE: "resume:update",
  RESUME_DELETE: "resume:delete",
  
  // 岗位管理
  JOB_READ: "job:read",
  JOB_CREATE: "job:create",
  JOB_UPDATE: "job:update", 
  JOB_DELETE: "job:delete",
  
  // 筛选管理
  SCREENING_READ: "screening:read",
  SCREENING_EXECUTE: "screening:execute",
  SCREENING_DELETE: "screening:delete",
  
  // 用户管理
  USER_READ: "user:read",
  USER_CREATE: "user:create",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  
  // 系统管理
  SYSTEM_CONFIG: "system:config",
  SYSTEM_ADMIN: "system:admin",
  
  // 公司管理
  COMPANY_READ: "company:read",
  COMPANY_CREATE: "company:create",
  COMPANY_UPDATE: "company:update",
  COMPANY_DELETE: "company:delete"
};

/**
 * 获取当前用户信息
 */
export const getCurrentUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      return JSON.parse(userStr);
    }
  } catch (error) {
    console.error('解析用户信息失败:', error);
  }
  return null;
};

/**
 * 获取当前用户权限
 */
export const getCurrentUserPermissions = () => {
  const user = getCurrentUser();
  if (!user) return [];
  
  // 从登录响应中获取权限
  const token = localStorage.getItem('token');
  if (token) {
    try {
      // 解析JWT token获取权限信息
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.permissions || [];
    } catch (error) {
      console.error('解析token权限失败:', error);
    }
  }
  
  return [];
};

/**
 * 检查用户是否有指定权限
 */
export const hasPermission = (permission) => {
  const permissions = getCurrentUserPermissions();
  return permissions.includes(permission);
};

/**
 * 检查用户是否有任意一个权限
 */
export const hasAnyPermission = (permissions) => {
  return permissions.some(permission => hasPermission(permission));
};

/**
 * 检查用户是否有所有权限
 */
export const hasAllPermissions = (permissions) => {
  return permissions.every(permission => hasPermission(permission));
};

/**
 * 获取按钮样式（根据权限禁用或启用）
 */
export const getButtonStyle = (permission, baseStyle = {}) => {
  const hasPerm = hasPermission(permission);
  
  if (!hasPerm) {
    return {
      ...baseStyle,
      backgroundColor: '#ccc',
      color: '#666',
      cursor: 'not-allowed',
      opacity: 0.6
    };
  }
  
  return baseStyle;
};

/**
 * 获取按钮禁用状态
 */
export const isButtonDisabled = (permission) => {
  return !hasPermission(permission);
};

/**
 * 根据权限控制元素显示
 */
export const shouldShowElement = (permission) => {
  return hasPermission(permission);
};

/**
 * 权限提示信息
 */
export const getPermissionHint = (permission) => {
  if (!hasPermission(permission)) {
    return "当前用户无此操作权限";
  }
  return "";
};

/**
 * 角色权限映射（用于前端角色说明）
 */
export const getRolePermissionsDescription = () => {
  return {
    admin: "拥有所有权限，可管理系统所有功能",
    manager: "可管理岗位和筛选，可查看和更新用户信息",
    hr: "可管理简历、岗位和筛选，可查看和更新用户信息",
    recruiter: "可上传简历和执行筛选",
    interviewer: "仅可查看简历和岗位信息",
    user: "仅可浏览简历和岗位"
  };
};

/**
 * 获取当前用户角色描述
 */
export const getCurrentUserRoleDescription = () => {
  const user = getCurrentUser();
  if (!user) return "未登录";
  
  const descriptions = getRolePermissionsDescription();
  return descriptions[user.role] || `角色：${user.role}`;
};