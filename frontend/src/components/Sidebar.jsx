import React from 'react';
import {Menu, Typography} from 'antd';
import {
    UploadOutlined,
    FileTextOutlined,
    FileSearchOutlined,
    SearchOutlined,
    TeamOutlined,
    CreditCardOutlined,
    BankOutlined,
    AuditOutlined,
    MailOutlined,
    SettingOutlined
} from '@ant-design/icons';
import {hasAnyPermission} from '../utils/permissions';
import {Permission} from '../utils/permissions';

const {Title} = Typography;

const Sidebar = ({activeItem, onItemClick, collapsed}) => {
    // 公司管理菜单仅对有权限的用户显示
    const canManageCompany = hasAnyPermission([
        Permission.COMPANY_READ,
        Permission.COMPANY_CREATE,
        Permission.COMPANY_UPDATE,
        Permission.COMPANY_DELETE
    ]);

    // 审计日志仅管理员可见
    const canViewAudit = hasAnyPermission([Permission.AUDIT_READ]);

    // 套餐管理仅系统管理员可见
    const canManagePlans = hasAnyPermission([Permission.SYSTEM_ADMIN]);

    // 用户管理 - 所有登录用户都可以访问（用于管理个人信息）
    const canManageUsers = !!localStorage.getItem('token');

    const menuItems = [
        {
            key: 'upload',
            icon: <UploadOutlined/>,
            label: '上传简历'
        },
        {
            key: 'list',
            icon: <FileTextOutlined/>,
            label: '简历管理'
        },
        {
            key: 'jobs',
            icon: <FileSearchOutlined/>,
            label: '岗位管理'
        },
        {
            key: 'screening',
            icon: <SearchOutlined/>,
            label: '简历筛选'
        },
        ...(canManageUsers ? [{
            key: 'users',
            icon: <TeamOutlined/>,
            label: '用户管理'
        }] : []),
        {
            key: 'payment',
            icon: <CreditCardOutlined/>,
            label: '会员订阅'
        },
        ...(canManageCompany ? [{
            key: 'companies',
            icon: <BankOutlined/>,
            label: '公司管理'
        }] : []),
        ...(canManagePlans ? [{
            key: 'plan-manage',
            icon: <SettingOutlined/>,
            label: '套餐管理'
        }] : []),
        ...(canViewAudit ? [{
            key: 'contacts',
            icon: <MailOutlined/>,
            label: '消息管理'
        }] : []),
        ...(canViewAudit ? [{
            key: 'audit',
            icon: <AuditOutlined/>,
            label: '审计日志'
        }] : []),
    ];

    return (
        <div style={{
            height: '100%',
            background: 'white',
            borderRight: '1px solid #f0f0f0'
        }}>
            <div style={{
                padding: collapsed ? '24px 0' : '24px 20px',
                borderBottom: '1px solid #f0f0f0',
                textAlign: collapsed ? 'center' : 'left'
            }}>
                <Title level={4} style={{
                    margin: 0,
                    color: '#262626',
                    fontSize: '16px',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap'
                }}>
                    {collapsed ? 'HR' : '功能菜单'}
                </Title>
            </div>

            <Menu
                mode="inline"
                selectedKeys={[activeItem]}
                onClick={({key}) => onItemClick(key)}
                items={menuItems}
                inlineCollapsed={collapsed}
                style={{
                    border: 'none',
                    background: 'transparent'
                }}
            />
        </div>
    );
};

export default Sidebar;
