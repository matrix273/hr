-- HR招聘系统数据库建表语句
-- 生成时间: 2026-03-27

-- 用户表
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    balance FLOAT DEFAULT 0.0 COMMENT '账户余额',
    subscription_plan VARCHAR(50) DEFAULT 'free' COMMENT '订阅套餐',
    subscription_expires TIMESTAMP WITH TIME ZONE COMMENT '订阅过期时间',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 简历表
CREATE TABLE resumes (
    resume_id VARCHAR(50) PRIMARY KEY,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    resume_text TEXT NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    job_id VARCHAR(50) COMMENT '关联的岗位ID',
    embedding_status VARCHAR(20) DEFAULT 'pending' COMMENT 'embedding 处理状态: pending, processing, completed, failed',
    embedding_error TEXT COMMENT 'embedding 处理错误信息',
    is_screened BOOLEAN DEFAULT FALSE COMMENT '是否已被筛选过',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 岗位表
CREATE TABLE jobs (
    job_id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    experience_years INTEGER COMMENT '工作经验要求（年）',
    education VARCHAR(50) COMMENT '学历要求',
    certifications TEXT COMMENT '资格证书要求',
    salary_range VARCHAR(100),
    location VARCHAR(100),
    user_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 筛选结果表
CREATE TABLE screening_results (
    id SERIAL PRIMARY KEY,
    result_id VARCHAR(50) UNIQUE NOT NULL,
    job_id VARCHAR(50) NOT NULL,
    resume_id VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL COMMENT '使用的LLM模型',
    screening_type VARCHAR(20) NOT NULL DEFAULT 'job' COMMENT '筛选方式: job-岗位筛选, custom-自定义描述筛选',
    rerank_score FLOAT NOT NULL COMMENT 'Rerank得分',
    raw_score FLOAT NOT NULL COMMENT '原始Rerank得分',
    rank INTEGER NOT NULL COMMENT '排名',
    llm_evaluation TEXT NOT NULL COMMENT 'LLM评估内容',
    matching_score FLOAT DEFAULT 0.0 COMMENT 'LLM匹配度评分',
    user_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 联系表单表
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '联系人姓名',
    email VARCHAR(100) NOT NULL COMMENT '联系人邮箱',
    message TEXT NOT NULL COMMENT '留言内容',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '处理状态: pending-待处理, processed-已处理',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 支付订单表
CREATE TABLE payment_orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(50) UNIQUE NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    amount FLOAT NOT NULL COMMENT '支付金额',
    currency VARCHAR(10) DEFAULT 'CNY' COMMENT '货币类型',
    payment_method VARCHAR(50) NOT NULL COMMENT '支付方式: wechat, alipay, stripe',
    product_type VARCHAR(50) NOT NULL COMMENT '产品类型: subscription-订阅, credit-余额充值',
    product_id VARCHAR(50) COMMENT '产品ID',
    product_name VARCHAR(255) NOT NULL COMMENT '产品名称',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '订单状态: pending-待支付, paid-已支付, failed-支付失败, cancelled-已取消',
    payment_data JSON COMMENT '支付平台返回的数据',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE COMMENT '支付完成时间'
);

-- 订阅套餐表
CREATE TABLE subscription_plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT '套餐名称',
    description TEXT COMMENT '套餐描述',
    price FLOAT NOT NULL COMMENT '价格',
    duration_days INTEGER NOT NULL COMMENT '有效期（天）',
    max_resumes INTEGER DEFAULT 100 COMMENT '最大简历数量',
    max_jobs INTEGER DEFAULT 10 COMMENT '最大岗位数量',
    ai_screening BOOLEAN DEFAULT TRUE COMMENT '是否包含AI筛选',
    priority_support BOOLEAN DEFAULT FALSE COMMENT '是否优先支持',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_payment_orders_user_id ON payment_orders(user_id);

-- 插入默认订阅套餐数据
INSERT INTO subscription_plans (id, name, description, price, duration_days, max_resumes, max_jobs, ai_screening, priority_support, is_active) VALUES
('free', '免费版', '基础功能体验', 0.0, 30, 10, 3, FALSE, FALSE, TRUE),
('basic', '基础版', '适合小型团队', 99.0, 30, 100, 10, TRUE, FALSE, TRUE),
('professional', '专业版', '适合中型企业', 299.0, 30, 500, 50, TRUE, TRUE, TRUE),
('enterprise', '企业版', '适合大型企业', 999.0, 30, 1000, 100, TRUE, TRUE, TRUE);

-- 表结构说明
-- 1. users: 用户管理表，包含账户信息和订阅状态
-- 2. resumes: 简历存储表，支持AI embedding处理
-- 3. jobs: 岗位信息表
-- 4. screening_results: AI筛选结果表，记录简历与岗位的匹配度
-- 5. contacts: 联系表单表
-- 6. payment_orders: 支付订单表
-- 7. subscription_plans: 订阅套餐配置表