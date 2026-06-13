# 移除会员订阅与配额限制

## 目标

在新分支上完全移除会员订阅（支付、套餐、配额）相关功能，所有用户无限制使用简历筛选和岗位创建。

## 方案

方案 A：完全移除代码。删除所有会员订阅相关文件，修改引用方移除依赖，数据库移除相关表和字段。

## 删除的文件（6 个）

### 后端
- `backend/app/models/payment.py` — PaymentOrder、SubscriptionPlan、QuotaAddon ORM 模型
- `backend/app/routes/payment.py` — 12 个支付/订阅 API 端点
- `backend/app/services/subscription.py` — 配额检查逻辑
- `backend/app/services/payment.py` — YunGouOS 微信支付集成

### 前端
- `frontend/src/pages/Payment.jsx` — 会员订阅页面
- `frontend/src/components/PlanManagement.jsx` — 管理员套餐管理组件

## 修改的文件

### 后端
- `backend/app/main.py` — 移除 payment router import 和 `init_default_plans()` 启动调用
- `backend/app/models/user.py` — 移除 User/Company 的 `subscription_plan`、`subscription_expires`、`balance` 字段及 `to_dict()` 序列化
- `backend/app/routes/jobs.py` — 移除 `check_job_quota` import 和调用
- `backend/app/routes/screening.py` — 移除 `check_screening_quota` import 和调用（2 处）
- `alembic/env.py` — 移除 payment 模型 import

### 前端
- `frontend/src/components/Sidebar.jsx` — 移除"会员订阅"和"套餐管理"菜单项
- `frontend/src/pages/Dashboard.jsx` — 移除 Payment/PlanManagement 的 import 和 tab 渲染
- `frontend/src/App.jsx` — 移除 `/payment` 路由

### 数据库/迁移
- `alembic/versions/b3e308bb3481_add_quota_addons_and_plan_type.py` — 删除整个文件
- `alembic/versions/a1b2c3d4e5f6_initial_schema.py` — 移除 payment_orders、subscription_plans、quota_addons 表创建及种子数据

### 配置/文档
- `init_db.sql` — 移除支付相关表 DDL 和种子数据
- `.env.example` — 移除支付相关环境变量

## 配额移除

- `jobs.py`：删除 `check_job_quota` 调用，岗位创建不再检查配额
- `screening.py`：删除 `check_screening_quota` 调用，简历筛选不再检查配额
- User/Company 模型：直接删除 `subscription_plan`、`subscription_expires`、`balance` 字段

## 不变的功能

- 登录认证、RBAC 权限
- 岗位管理、简历筛选、消息管理
- 公司管理（除订阅字段外）
- 审计日志、用户管理
- LLM/Embedding/Reranker 服务
