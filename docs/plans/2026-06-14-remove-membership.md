# 移除会员订阅与配额限制 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在新分支上完全移除会员订阅、支付集成和配额限制，所有用户无限制使用简历筛选和岗位创建。

**Architecture:** 删除 6 个会员/支付相关文件，从 10+ 个引用文件中移除相关导入和调用，清理数据库迁移和配置。

**Tech Stack:** FastAPI, React, PostgreSQL, Alembic

---

### Task 1: 创建新分支

- [ ] 创建并切换到新分支 `no-membership`

```bash
git checkout -b no-membership
```

- [ ] 验证分支创建成功

```bash
git branch --show-current
```

---

### Task 2: 删除 6 个会员/支付文件

- [ ] 删除 4 个后端文件

```bash
rm backend/app/models/payment.py
rm backend/app/routes/payment.py
rm backend/app/services/subscription.py
rm backend/app/services/payment.py
```

- [ ] 删除 2 个前端文件

```bash
rm frontend/src/pages/Payment.jsx
rm frontend/src/components/PlanManagement.jsx
```

- [ ] 验证文件已删除

```bash
ls backend/app/models/payment.py backend/app/routes/payment.py backend/app/services/subscription.py backend/app/services/payment.py frontend/src/pages/Payment.jsx frontend/src/components/PlanManagement.jsx 2>&1 | grep -q "No such file"
```

---

### Task 3: 修改 `backend/app/main.py` — 移除 payment 路由

- [ ] 删除 line 26 的 payment router import：`from .routes.payment import router as payment_router`
- [ ] 删除 lines 44-49 的 `init_default_plans()` 启动调用
- [ ] 删除 line 98 的 `app.include_router(payment_router)`

改前 main.py:26:
```python
from .routes.payment import router as payment_router
```
改为：删除此行

改前 main.py:44-49:
```python
    # 初始化默认套餐
    try:
        from .routes.payment import init_default_plans
        await init_default_plans()
    except Exception as e:
        logger.error(f"初始化默认套餐失败: {e}")
```
改为：删除这 6 行

改前 main.py:98:
```python
app.include_router(payment_router)
```
改为：删除此行

- [ ] 验证 main.py 中无 payment 引用

```bash
grep -n "payment" backend/app/main.py
```
预期输出：空

---

### Task 4: 修改 `backend/app/models/user.py` — 移除订阅/支付字段

- [ ] 在 Company 模型中删除 lines 18-20（订阅字段）：
  - `subscription_plan = Column(String(50), default="free", comment="公司订阅套餐")`
  - `subscription_expires = Column(DateTime(timezone=True), comment="公司订阅过期时间")`

- [ ] 在 User 模型中删除 lines 58-61（支付/订阅字段）：
  - `balance = Column(Float, default=0.0, comment="账户余额")`
  - `subscription_plan = Column(String(50), default="free", comment="订阅套餐")`
  - `subscription_expires = Column(DateTime(timezone=True), comment="订阅过期时间")`

- [ ] 修改 User.to_dict()（lines 65-80），移除 `balance`、`subscription_plan`、`subscription_expires` 三个键：

改前 to_dict():
```python
def to_dict(self):
    """转换为字典"""
    return {
        "id": self.id,
        "username": self.username,
        "email": self.email,
        "full_name": self.full_name,
        "role": self.role,
        "is_active": self.is_active,
        "company_id": self.company_id,
        "balance": self.balance,
        "subscription_plan": self.subscription_plan,
        "subscription_expires": self.subscription_expires.isoformat() if self.subscription_expires else None,
        "created_at": self.created_at.isoformat() if self.created_at else None,
        "updated_at": self.updated_at.isoformat() if self.updated_at else None
    }
```
改为：
```python
def to_dict(self):
    """转换为字典"""
    return {
        "id": self.id,
        "username": self.username,
        "email": self.email,
        "full_name": self.full_name,
        "role": self.role,
        "is_active": self.is_active,
        "company_id": self.company_id,
        "created_at": self.created_at.isoformat() if self.created_at else None,
        "updated_at": self.updated_at.isoformat() if self.updated_at else None
    }
```

- [ ] 验证 user.py 中无 subscription/payment 引用

```bash
grep -n "subscription\|balance\|payment" backend/app/models/user.py
```
预期输出：空

---

### Task 5: 修改 `backend/app/routes/jobs.py` — 移除配额检查

- [ ] 删除 line 20 的 import：`from ..services.subscription import check_job_quota`
- [ ] 删除 lines 61-67 的配额检查调用：

改前 jobs.py:61-67:
```python
        # 检查岗位配额
        allowed, error_msg = await check_job_quota(user, db)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg
            )
```
改为：删除这 7 行

- [ ] 验证 jobs.py 中无 subscription/quota 引用

```bash
grep -n "subscription\|quota" backend/app/routes/jobs.py
```
预期输出：空

---

### Task 6: 修改 `backend/app/routes/screening.py` — 移除配额检查

- [ ] 删除 line 36 的 import：`from ..services.subscription import check_screening_quota`

- [ ] 删除第一个配额检查（screen_resumes 函数 event_stream 内部，约 lines 78-82）：

改前:
```python
            # 检查筛选配额（基于成功筛选数，非 top_k）
            allowed, error_msg = await check_screening_quota(user, db)
            if not allowed:
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                return
```
改为：删除这 5 行

- [ ] 删除第二个配额检查（screen_resumes_by_job 函数 event_stream 内部，约 lines 550-554）：

改前:
```python
            # 检查筛选配额（基于成功筛选数，非 top_k）
            allowed, error_msg = await check_screening_quota(user, db)
            if not allowed:
                yield f"data: {json.dumps({'type': 'error', 'message': error_msg})}\n\n"
                return
```
改为：删除这 5 行

- [ ] 验证 screening.py 中无 subscription/quota 引用

```bash
grep -n "subscription\|quota" backend/app/routes/screening.py
```
预期输出：空

---

### Task 7: 修改 `alembic/env.py` — 移除 payment 模型 import

- [ ] 删除 line 34：`from backend.app.models.payment import PaymentOrder, SubscriptionPlan`

- [ ] 验证 env.py 中无 payment 引用

```bash
grep -n "payment" alembic/env.py
```
预期输出：空

---

### Task 8: 修改 `frontend/src/components/Sidebar.jsx` — 移除会员菜单

- [ ] 删除 line 9 的 CreditCardOutlined import：`CreditCardOutlined,`
- [ ] 删除 line 13 的 SettingOutlined import（仅用于套餐管理）：`SettingOutlined`
- [ ] 删除 line 33 的套餐管理权限变量：`const canManagePlans = hasAnyPermission([Permission.SYSTEM_ADMIN]);`
- [ ] 删除 lines 64-68 的"会员订阅"菜单项：
```javascript
        {
            key: 'payment',
            icon: <CreditCardOutlined/>,
            label: '会员订阅'
        },
```
- [ ] 删除 lines 74-78 的"套餐管理"菜单项：
```javascript
        ...(canManagePlans ? [{
            key: 'plan-manage',
            icon: <SettingOutlined/>,
            label: '套餐管理'
        }] : []),
```

- [ ] 验证 Sidebar.jsx 中无 payment/CreditCard 相关代码

```bash
grep -n "payment\|CreditCard\|SettingOutlined\|会员订阅\|套餐管理\|plan-manage" frontend/src/components/Sidebar.jsx
```
预期输出：空

---

### Task 9: 修改 `frontend/src/pages/Dashboard.jsx` — 移除会员/套餐渲染

- [ ] 删除 line 11：`import Payment from './Payment';`
- [ ] 删除 line 12：`import PlanManagement from '../components/PlanManagement';`
- [ ] 在 `tabPermissions`（约 line 29）中删除 `'plan-manage'` 和 `'contacts'` 权限配置中不涉及会员的部分，保留其他：

改前 tabPermissions:
```javascript
    const tabPermissions = {
      'companies': [Permission.COMPANY_READ],
      'plan-manage': [Permission.SYSTEM_ADMIN],
      'contacts': [Permission.SYSTEM_ADMIN],
      'audit': [Permission.SYSTEM_ADMIN],
    };
```
改为：
```javascript
    const tabPermissions = {
      'companies': [Permission.COMPANY_READ],
      'contacts': [Permission.SYSTEM_ADMIN],
      'audit': [Permission.SYSTEM_ADMIN],
    };
```

- [ ] 删除 lines 184-186（Payment 渲染）：
```javascript
          <div style={{ display: activeTab === 'payment' ? 'block' : 'none' }}>
            <Payment />
          </div>
```

- [ ] 删除 lines 188-190（PlanManagement 渲染）：
```javascript
          <div style={{ display: activeTab === 'plan-manage' ? 'block' : 'none' }}>
            {hasPermission(Permission.SYSTEM_ADMIN) && <PlanManagement />}
          </div>
```

- [ ] 注释 line 28 中提到"会员订阅"的注释更新为：`// 检查用户是否有权限访问保存的 tab`

- [ ] 验证 Dashboard.jsx 中无 Payment/PlanManagement 引用

```bash
grep -n "Payment\|PlanManagement\|plan-manage\|payment" frontend/src/pages/Dashboard.jsx
```
预期输出：空

---

### Task 10: 修改 `frontend/src/App.jsx` — 移除 `/payment` 路由

- [ ] 删除 line 8：`import Payment from './pages/Payment';`
- [ ] 删除 lines 32-33：
```javascript
      {/* 支付页面 */}
      <Route path="/payment" element={<Payment />} />
```

- [ ] 验证 App.jsx 中无 Payment/payment 引用

```bash
grep -n "Payment\|payment" frontend/src/App.jsx
```
预期输出：空

---

### Task 11: 删除 alembic migration 文件

- [ ] 删除迁移文件：

```bash
rm alembic/versions/b3e308bb3481_add_quota_addons_and_plan_type.py
```

- [ ] 验证文件已删除

```bash
ls alembic/versions/b3e308bb3481_add_quota_addons_and_plan_type.py 2>&1 | grep -q "No such file"
```

---

### Task 12: 修改初始 alembic migration — 移除支付表和种子数据

修改 `alembic/versions/a1b2c3d4e5f6_initial_schema.py`：

- [ ] 读取该文件，找到并删除以下表的创建代码：
  - `payment_orders` 表
  - `subscription_plans` 表
  - `quota_addons` 表（如果存在）

- [ ] 删除 `users` 表中的 subscription 相关列定义：
  - `subscription_plan`
  - `subscription_expires`
  - `balance`

- [ ] 删除 `companies` 表中的 subscription 相关列定义：
  - `subscription_plan`
  - `subscription_expires`

- [ ] 删除种子数据中所有 subscription_plans、quota_addons、payment_orders 的 INSERT 语句

- [ ] 验证 migration 中无 payment/subscription 相关表定义

```bash
grep -n "payment_orders\|subscription_plans\|quota_addons\|subscription_plan" alembic/versions/a1b2c3d4e5f6_initial_schema.py
```
预期输出：空

---

### Task 13: 修改 `init_db.sql` — 移除支付相关表和种子数据

- [ ] 从 init_db.sql 中删除以下表 DDL：
  - `payment_orders` 表
  - `subscription_plans` 表
  - `quota_addons` 表

- [ ] 从 `companies` 表定义中删除 `subscription_plan` 和 `subscription_expires` 列

- [ ] 从 `users` 表定义中删除 `subscription_plan`、`subscription_expires`、`balance` 列

- [ ] 删除所有支付相关种子数据的 INSERT 语句（subscription plans, addon plans）

- [ ] 验证 init_db.sql 中无 payment/subscription 引用

```bash
grep -n "payment_orders\|subscription_plans\|quota_addons\|subscription_plan\|YUNGOU" init_db.sql
```
预期输出：空

---

### Task 14: 修改 `.env.example` — 移除支付环境变量

- [ ] 删除 lines 83-89（YunGouOS 支付配置）：
```
# YunGouOS 支付配置
YUNGOUOS_MCH_ID=你的商户号
YUNGOUOS_KEY=你的商户密钥
YUNGOUOS_NOTIFY_URL=https://你的域名/api/payment/notify

# .env 中添加（可选，默认值为 AI简历筛选系统）
PAYEE_NAME=你的商户名称
```

- [ ] 验证 .env.example 中无支付相关变量

```bash
grep -n "YUNGOUOS\|YUNGOU\|PAYEE\|payment" .env.example
```
预期输出：空

---

### Task 15: 全局扫描 — 确认无遗漏的支付/订阅引用

- [ ] 扫描整个代码库，确认无遗留引用

```bash
# 搜索后端支付相关引用
grep -rn "payment\|subscription\|quota\|YunGouOS\|init_default_plans" backend/ --include="*.py" | grep -v "__pycache__"

# 搜索前端支付相关引用
grep -rn "Payment\|PlanManagement\|payment\|subscription\|quota\|CreditCard\|会员订阅\|套餐管理" frontend/src/ --include="*.jsx" --include="*.js"
```

预期输出：仅有非订阅相关的正常代码（如注释中的"payment"单词需人工确认）

- [ ] 如发现有遗漏的引用，逐一修复

---

### Task 16: 提交并验证

- [ ] 查看修改统计

```bash
git status
git diff --stat
```

- [ ] 确认变更列表符合预期（6 个删除文件，10+ 个修改文件）

- [ ] 提交所有变更

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: 移除会员订阅、支付集成和配额限制

- 删除 payment 模型、路由、服务（后端 4 个文件）
- 删除 Payment 页面和 PlanManagement 组件（前端 2 个文件）
- 从 main.py 移除 payment 路由注册和 init_default_plans
- 从 jobs.py/screening.py 移除配额检查
- 从 User/Company 模型移除订阅/支付字段
- 从前端 Sidebar/Dashboard/App 移除会员/套餐相关入口
- 删除 quota_addons 迁移，清理初始迁移中的支付表
- 清理 init_db.sql 和 .env.example 中的支付配置

所有用户现在无限制使用简历筛选和岗位创建。
EOF
)"
```

- [ ] 验证提交成功

```bash
git log --oneline -1
git branch -vv
```
