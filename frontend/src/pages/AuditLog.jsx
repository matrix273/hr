import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Input, Select, DatePicker, Space, Button, Typography
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, FileSearchOutlined
} from '@ant-design/icons';
import { shouldShowElement, Permission } from '../utils/permissions';
import api from '../utils/api';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

/** 操作类型中文映射 */
const ACTION_LABELS = {
  update_user: "编辑用户",
  create_user: "创建用户",
  delete_user: "删除用户",
};

/** 目标类型中文映射 */
const TARGET_LABELS = {
  user: "用户",
  resume: "简历",
  job: "岗位",
  company: "公司",
};

/** 操作类型颜色 */
const ACTION_COLORS = {
  update_user: "blue",
  create_user: "green",
  delete_user: "red",
};

const AuditLog = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 筛选条件
  const [actionFilter, setActionFilter] = useState(undefined);
  const [actionOptions, setActionOptions] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [dateRange, setDateRange] = useState(null);

  const fetchData = useCallback(async (current = page, size = pageSize) => {
    if (!shouldShowElement(Permission.AUDIT_READ)) return;
    setLoading(true);
    try {
      const params = { page: current, page_size: size };
      if (actionFilter) params.action = actionFilter;
      if (keyword) params.keyword = keyword;
      if (dateRange && dateRange[0]) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
      }
      if (dateRange && dateRange[1]) {
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }

      const res = await api.get('/audit-logs', { params });
      setData(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('获取审计日志失败:', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, keyword, dateRange]);

  // 获取操作类型选项
  const fetchActions = useCallback(async () => {
    try {
      const res = await api.get('/audit-logs/actions');
      setActionOptions(res.data.actions || []);
    } catch (err) {
      console.error('获取操作类型失败:', err);
    }
  }, []);

  useEffect(() => {
    if (shouldShowElement(Permission.AUDIT_READ)) {
      fetchData();
      fetchActions();
    }
  }, [fetchData, fetchActions]);

  // 搜索
  const handleSearch = () => {
    setPage(1);
    fetchData(1, pageSize);
  };

  // 重置
  const handleReset = () => {
    setActionFilter(undefined);
    setKeyword('');
    setDateRange(null);
    setPage(1);
    // 需要在状态更新后重新获取数据
    setTimeout(() => fetchData(1, pageSize), 0);
  };

  // 翻页
  const handleTableChange = (pagination) => {
    setPage(pagination.current);
    setPageSize(pagination.pageSize);
    fetchData(pagination.current, pagination.pageSize);
  };

  // 渲染变更详情
  const renderDetail = (detail) => {
    if (!detail) return <Text type="secondary">-</Text>;
    if (typeof detail === 'string') {
      return <Text>{detail}</Text>;
    }
    // detail 是对象: {字段名: {old: xx, new: xx}}
    return (
      <div style={{ maxWidth: 400 }}>
        {Object.entries(detail).map(([field, change]) => (
          <div key={field} style={{ marginBottom: 4 }}>
            <Text strong>{field}</Text>
            {'：'}
            <Text delete type="secondary">{String(change.old || '-')}</Text>
            <Text style={{ margin: '0 6px' }}>→</Text>
            <Text type="success">{String(change.new || '-')}</Text>
          </div>
        ))}
      </div>
    );
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (val) => {
        if (!val) return '-';
        const d = new Date(val);
        return d.toLocaleString('zh-CN');
      },
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      width: 120,
      render: (val) => (
        <Tag color={ACTION_COLORS[val] || 'default'}>
          {ACTION_LABELS[val] || val}
        </Tag>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      width: 100,
      render: (val) => TARGET_LABELS[val] || val,
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      width: 120,
      ellipsis: true,
    },
    {
      title: '变更详情',
      dataIndex: 'detail',
      render: renderDetail,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      width: 130,
      render: (val) => val || '-',
    },
  ];

  // 无权限提示
  if (!shouldShowElement(Permission.AUDIT_READ)) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          <FileSearchOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>当前用户无此操作权限</div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Title level={4}>
        <FileSearchOutlined style={{ marginRight: 8 }} />
        审计日志
      </Title>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 24px' }}>
        <Space wrap>
          <Input
            placeholder="搜索操作人/详情"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={setActionFilter}
            style={{ width: 160 }}
            allowClear
          >
            {actionOptions.map((action) => (
              <Select.Option key={action} value={action}>
                {ACTION_LABELS[action] || action}
              </Select.Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
          >
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>
        </Space>
      </Card>

      {/* 日志表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default AuditLog;
