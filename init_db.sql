-- ============================================================
-- AI 简历筛选系统 - 数据库初始化脚本（PostgreSQL）
-- 基于最新 SQLAlchemy 模型生成
-- 用法: psql -U postgres -f init_db.sql
-- ============================================================

-- -----------------------------------------------------------
-- 0. 创建数据库（需以超级用户身份执行）
-- -----------------------------------------------------------
SELECT 'CREATE DATABASE hr OWNER pgadmin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hr')\gexec

\c hr

-- -----------------------------------------------------------
-- 1. 公司表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id                    VARCHAR(50)  PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    invite_code           VARCHAR(10)  UNIQUE NOT NULL,
    subscription_plan     VARCHAR(50)  DEFAULT 'free',
    subscription_expires  TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  companies                       IS '公司表';
COMMENT ON COLUMN companies.id                    IS '公司ID';
COMMENT ON COLUMN companies.name                  IS '公司名称';
COMMENT ON COLUMN companies.invite_code           IS '邀请码';
COMMENT ON COLUMN companies.subscription_plan     IS '公司订阅套餐';
COMMENT ON COLUMN companies.subscription_expires  IS '公司订阅过期时间';

CREATE INDEX IF NOT EXISTS idx_companies_invite_code ON companies(invite_code);

-- -----------------------------------------------------------
-- 2. 用户表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                    VARCHAR(50)  PRIMARY KEY,
    username              VARCHAR(50)  UNIQUE NOT NULL,
    email                 VARCHAR(100) UNIQUE NOT NULL,
    password_hash         VARCHAR(255) NOT NULL,
    full_name             VARCHAR(100),
    role                  VARCHAR(20)  NOT NULL DEFAULT 'user',
    is_active             BOOLEAN      DEFAULT TRUE,
    company_id            VARCHAR(50),
    balance               FLOAT        DEFAULT 0.0,
    subscription_plan     VARCHAR(50)  DEFAULT 'free',
    subscription_expires  TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ
);

COMMENT ON TABLE  users                          IS '用户表';
COMMENT ON COLUMN users.company_id               IS '所属公司ID，用于数据隔离';
COMMENT ON COLUMN users.balance                  IS '账户余额';
COMMENT ON COLUMN users.subscription_plan        IS '订阅套餐';
COMMENT ON COLUMN users.subscription_expires     IS '订阅过期时间';

CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id  ON users(company_id);

-- -----------------------------------------------------------
-- 3. 简历表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS resumes (
    resume_id         VARCHAR(50)  PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    file_size         INTEGER      NOT NULL,
    resume_text              TEXT         NOT NULL,
    anonymized_resume_text   TEXT,
    user_id                  VARCHAR(50)  NOT NULL,
    job_id            VARCHAR(50),
    embedding_status  VARCHAR(20)  DEFAULT 'pending',
    embedding_error   TEXT,
    is_screened       BOOLEAN      DEFAULT FALSE,
    created_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE  resumes                        IS '简历表';
COMMENT ON COLUMN resumes.job_id                 IS '关联的岗位ID';
COMMENT ON COLUMN resumes.embedding_status       IS 'embedding 状态: pending/processing/completed/failed';
COMMENT ON COLUMN resumes.embedding_error        IS 'embedding 处理错误信息';
COMMENT ON COLUMN resumes.is_screened            IS '是否已被筛选过';
COMMENT ON COLUMN resumes.anonymized_resume_text IS '脱敏后的简历文本，上传时自动生成';

-- -----------------------------------------------------------
-- 4. 岗位表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    job_id            VARCHAR(50)  PRIMARY KEY,
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NOT NULL,
    requirements      TEXT,
    experience_years  INTEGER,
    education         VARCHAR(50),
    certifications    TEXT,
    salary_range      VARCHAR(100),
    location          VARCHAR(100),
    user_id           VARCHAR(50)  NOT NULL,
    created_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ
);

COMMENT ON TABLE  jobs                           IS '岗位表';
COMMENT ON COLUMN jobs.experience_years          IS '工作经验要求（年）';
COMMENT ON COLUMN jobs.education                 IS '学历要求';
COMMENT ON COLUMN jobs.certifications            IS '资格证书要求';

-- -----------------------------------------------------------
-- 5. 筛选结果表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS screening_results (
    id               SERIAL       PRIMARY KEY,
    result_id        VARCHAR(50)  UNIQUE NOT NULL,
    job_id           VARCHAR(50)  NOT NULL,
    resume_id        VARCHAR(50)  NOT NULL,
    model            VARCHAR(100) NOT NULL,
    screening_type   VARCHAR(20)  NOT NULL DEFAULT 'job',
    rerank_score     FLOAT        NOT NULL,
    raw_score        FLOAT        NOT NULL,
    rank             INTEGER      NOT NULL,
    llm_evaluation   TEXT         NOT NULL,
    matching_score   FLOAT        DEFAULT 0.0,
    deleted          BOOLEAN      DEFAULT FALSE,
    user_id          VARCHAR(50)  NOT NULL,
    created_at       TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  screening_results                IS '筛选结果表';
COMMENT ON COLUMN screening_results.model          IS '使用的 LLM 模型';
COMMENT ON COLUMN screening_results.screening_type IS '筛选方式: job-岗位筛选, custom-自定义描述';
COMMENT ON COLUMN screening_results.rerank_score   IS 'Rerank 得分';
COMMENT ON COLUMN screening_results.raw_score      IS '原始 Rerank 得分';
COMMENT ON COLUMN screening_results.llm_evaluation IS 'LLM 评估内容';
COMMENT ON COLUMN screening_results.matching_score IS 'LLM 匹配度评分';
COMMENT ON COLUMN screening_results.deleted         IS '是否已删除（软删除，配额计算仍计入）';

-- -----------------------------------------------------------
-- 6. 联系表单表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
    id         SERIAL      PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(100) NOT NULL,
    message    TEXT         NOT NULL,
    status     VARCHAR(20)  DEFAULT 'pending',
    created_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  contacts                        IS '联系表单表';
COMMENT ON COLUMN contacts.status                 IS '处理状态: pending-待处理, processed-已处理';

-- -----------------------------------------------------------
-- 7. 支付订单表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_orders (
    id              SERIAL       PRIMARY KEY,
    order_id        VARCHAR(50)  UNIQUE NOT NULL,
    user_id         VARCHAR(50)  NOT NULL,
    amount          FLOAT        NOT NULL,
    currency        VARCHAR(10)  DEFAULT 'CNY',
    payment_method  VARCHAR(50)  NOT NULL,
    product_type    VARCHAR(50)  NOT NULL,
    product_id      VARCHAR(50),
    product_name    VARCHAR(255) NOT NULL,
    status          VARCHAR(20)  DEFAULT 'pending',
    payment_data    JSON,
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ
);

COMMENT ON TABLE  payment_orders                  IS '支付订单表';
COMMENT ON COLUMN payment_orders.amount           IS '支付金额';
COMMENT ON COLUMN payment_orders.currency         IS '货币类型';
COMMENT ON COLUMN payment_orders.payment_method   IS '支付方式: wechat, alipay, stripe';
COMMENT ON COLUMN payment_orders.product_type     IS '产品类型: subscription-订阅, credit-余额充值';
COMMENT ON COLUMN payment_orders.product_name     IS '产品名称';
COMMENT ON COLUMN payment_orders.status           IS '状态: pending-待支付, paid-已支付, failed-失败, cancelled-已取消';
COMMENT ON COLUMN payment_orders.payment_data     IS '支付平台返回的数据';
COMMENT ON COLUMN payment_orders.paid_at          IS '支付完成时间';

CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id);

-- -----------------------------------------------------------
-- 8. 订阅套餐表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
    id                VARCHAR(50)  PRIMARY KEY,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    price             FLOAT        NOT NULL,
    duration_days     INTEGER      NOT NULL,
    max_resumes       INTEGER      DEFAULT 100,
    max_jobs          INTEGER      DEFAULT 10,
    ai_screening      BOOLEAN      DEFAULT TRUE,
    priority_support  BOOLEAN      DEFAULT FALSE,
    is_test           BOOLEAN      DEFAULT FALSE,
    is_active         BOOLEAN      DEFAULT TRUE,
    plan_type         VARCHAR(20)  DEFAULT 'subscription',
    addon_resumes     INTEGER      DEFAULT 0,
    addon_jobs        INTEGER      DEFAULT 0,
    created_at        TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  subscription_plans                    IS '订阅套餐表';
COMMENT ON COLUMN subscription_plans.name                IS '套餐名称';
COMMENT ON COLUMN subscription_plans.description         IS '套餐描述';
COMMENT ON COLUMN subscription_plans.price               IS '价格';
COMMENT ON COLUMN subscription_plans.duration_days       IS '有效期（天）';
COMMENT ON COLUMN subscription_plans.max_resumes         IS '最大简历数量';
COMMENT ON COLUMN subscription_plans.max_jobs            IS '最大岗位数量';
COMMENT ON COLUMN subscription_plans.ai_screening        IS '是否包含AI筛选';
COMMENT ON COLUMN subscription_plans.priority_support    IS '是否优先支持';
COMMENT ON COLUMN subscription_plans.is_active           IS '是否激活';
COMMENT ON COLUMN subscription_plans.is_test             IS '是否为测试套餐（仅管理员可见）';
COMMENT ON COLUMN subscription_plans.plan_type           IS '套餐类型: subscription-订阅, addon-加量包';
COMMENT ON COLUMN subscription_plans.addon_resumes       IS '加量包额外增加的筛选简历数';
COMMENT ON COLUMN subscription_plans.addon_jobs          IS '加量包额外增加的岗位数';

-- -----------------------------------------------------------
-- 8.1 加量包购买记录表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS quota_addons (
    id              SERIAL       PRIMARY KEY,
    order_id        VARCHAR(50)  UNIQUE NOT NULL,
    user_id         VARCHAR(50)  NOT NULL,
    company_id      VARCHAR(50),
    addon_resumes   INTEGER      DEFAULT 0,
    addon_jobs      INTEGER      DEFAULT 0,
    month_key       VARCHAR(7),
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  quota_addons                   IS '加量包购买记录表';
COMMENT ON COLUMN quota_addons.order_id          IS '关联的支付订单ID';
COMMENT ON COLUMN quota_addons.user_id           IS '购买用户ID';
COMMENT ON COLUMN quota_addons.company_id        IS '公司ID（有公司时记录）';
COMMENT ON COLUMN quota_addons.addon_resumes     IS '额外增加的筛选简历数';
COMMENT ON COLUMN quota_addons.addon_jobs        IS '额外增加的岗位数';
COMMENT ON COLUMN quota_addons.month_key         IS '废弃字段';

CREATE INDEX IF NOT EXISTS idx_quota_addons_user_id    ON quota_addons(user_id);
CREATE INDEX IF NOT EXISTS idx_quota_addons_company_id ON quota_addons(company_id);

-- -----------------------------------------------------------
-- 9. 审计日志表
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL       PRIMARY KEY,
    operator_id     VARCHAR(50)  NOT NULL,
    operator_name   VARCHAR(50)  NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    target_type     VARCHAR(50)  NOT NULL,
    target_id       VARCHAR(50)  NOT NULL,
    detail          TEXT,
    ip_address      VARCHAR(50),
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  audit_logs                      IS '审计日志表';
COMMENT ON COLUMN audit_logs.operator_id           IS '操作人ID';
COMMENT ON COLUMN audit_logs.operator_name         IS '操作人用户名';
COMMENT ON COLUMN audit_logs.action                IS '操作类型: update_user/delete_user 等';
COMMENT ON COLUMN audit_logs.target_type           IS '目标类型: user/company 等';
COMMENT ON COLUMN audit_logs.target_id             IS '目标ID';
COMMENT ON COLUMN audit_logs.detail                IS '变更详情JSON，如 {"email": {"old": "a@b.com", "new": "c@d.com"}}';
COMMENT ON COLUMN audit_logs.ip_address            IS 'IP地址';

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator_id ON audit_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at);

-- ============================================================
-- 初始数据
-- ============================================================

-- 默认订阅套餐（ON CONFLICT 保证可重复执行）
INSERT INTO subscription_plans (id, name, description, price, duration_days, max_resumes, max_jobs, ai_screening, priority_support, is_active, is_test, plan_type, addon_resumes, addon_jobs)
VALUES
    -- 月度会员
    ('free',  '免费版', '适合个人体验，基础功能免费使用',      0,    36500, 10,    3,    TRUE,  FALSE, TRUE,  FALSE, 'subscription', 0,   0),
    ('basic', '基础版', '适合小型团队，满足日常招聘需求',       99,   30,    100,   10,   TRUE,  FALSE, TRUE,  FALSE, 'subscription', 0,   0),
    ('pro',   '专业版', '适合中型企业，高效批量处理简历',      299,  30,    500,   50,   TRUE,  TRUE,  TRUE,  FALSE, 'subscription', 0,   0),
    ('enterprise', '企业版', '适合大型企业，高效批量处理简历', 999,  30,    1000,  100,  TRUE,  TRUE,  TRUE,  FALSE, 'subscription', 0,   0)
    -- 测试套餐（仅管理员可见）
    ('test',  '测试套餐', '仅管理员可见，用于测试支付流程',  0.01,  1,    10,    3,    TRUE,  FALSE, TRUE,  TRUE,  'subscription', 0,   0),
    -- 加量包（一次性购买，永久有效）
    ('addon_resume_50',  '筛选简历加量包(50份)',  '一次性额外增加50份AI筛选简历配额',  29,  30, 0, 0, TRUE, FALSE, TRUE, FALSE, 'addon', 50,  0),
    ('addon_resume_200', '筛选简历加量包(200份)', '一次性额外增加200份AI筛选简历配额', 99,  30, 0, 0, TRUE, FALSE, TRUE, FALSE, 'addon', 200, 0),
    ('addon_resume_500', '筛选简历加量包(500份)', '一次性额外增加500份AI筛选简历配额', 199, 30, 0, 0, TRUE, FALSE, TRUE, FALSE, 'addon', 500, 0),
    ('addon_job_10',     '岗位加量包(10个)',      '一次性额外增加10个岗位发布配额',    29,  30, 0, 0, TRUE, FALSE, TRUE, FALSE, 'addon', 0,   10)
ON CONFLICT (id) DO NOTHING;
