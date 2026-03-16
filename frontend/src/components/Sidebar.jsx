import React from 'react';

const Sidebar = ({ activeItem, onItemClick }) => {
  const menuItems = [
    { id: 'upload', icon: '📤', label: '上传简历' },
    { id: 'list', icon: '📋', label: '简历管理' },
    { id: 'jobs', icon: '💼', label: '岗位管理' },
    { id: 'screening', icon: '🔍', label: '简历筛选' },
    { id: 'analysis', icon: '📊', label: '数据分析' },
  ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarHeader}>
        <h2 style={styles.sidebarTitle}>功能菜单</h2>
      </div>

      <nav style={styles.nav}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            style={{
              ...styles.navItem,
              backgroundColor: activeItem === item.id ? '#667eea' : 'transparent',
              color: activeItem === item.id ? 'white' : '#333',
            }}
            onClick={() => onItemClick(item.id)}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span style={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: '260px',
    backgroundColor: 'white',
    borderRight: '1px solid #e0e0e0',
    height: 'calc(100vh - 64px)',
    position: 'sticky',
    top: '64px',
    display: 'flex',
    flexDirection: 'column',
  },
  sidebarHeader: {
    padding: '24px 20px',
    borderBottom: '1px solid #e0e0e0',
  },
  sidebarTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#333',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
  },
  navIcon: {
    fontSize: '20px',
  },
  navLabel: {
    fontSize: '15px',
  },
};

export default Sidebar;
