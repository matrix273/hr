import React from 'react';
import { Menu, Typography } from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  SearchOutlined,
  TeamOutlined,
  CreditCardOutlined
} from '@ant-design/icons';

const { Title } = Typography;

const Sidebar = ({ activeItem, onItemClick, collapsed }) => {
  const menuItems = [
    {
      key: 'upload',
      icon: <UploadOutlined />,
      label: '上传简历'
    },
    {
      key: 'list',
      icon: <FileTextOutlined />,
      label: '简历管理'
    },
    {
      key: 'jobs',
      icon: <FileSearchOutlined />,
      label: '岗位管理'
    },
    {
      key: 'screening',
      icon: <SearchOutlined />,
      label: '简历筛选'
    },
    {
      key: 'users',
      icon: <TeamOutlined />,
      label: '用户管理'
    },
    {
      key: 'payment',
      icon: <CreditCardOutlined />,
      label: '会员订阅'
    },
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
        onClick={({ key }) => onItemClick(key)}
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
