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
    created_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE  companies                       IS '公司表';
COMMENT ON COLUMN companies.id                    IS '公司ID';
COMMENT ON COLUMN companies.name                  IS '公司名称';
COMMENT ON COLUMN companies.invite_code           IS '邀请码';

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
    created_at            TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ
);

COMMENT ON TABLE  users                          IS '用户表';
COMMENT ON COLUMN users.company_id               IS '所属公司ID，用于数据隔离';

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
-- 7. 审计日志表
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

-- 默认管理员账号（密码: callofai2026!，ON CONFLICT 保证可重复执行）
-- 若需重新生成密码哈希: uv run python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt'], deprecated='auto').hash('callofai2026!'))"
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active)
VALUES (
    'admin-default-001',
    'admin',
    'matrix273@gmail.com',
    '$2b$12$lCRdd/uQEV35A16GDELiRuWOsMOjRoVORTBO5o4hweOgXax8m0jsK',
    '系统管理员',
    'admin',
    TRUE
)
ON CONFLICT (id) DO NOTHING;
