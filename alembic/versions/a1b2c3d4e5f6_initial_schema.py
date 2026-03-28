"""initial_schema

包含所有表的最新完整建表语句：
companies, users, resumes, jobs, screening_results,
contacts, payment_orders, subscription_plans, audit_logs

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-03-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建所有表."""
    # ============================================================
    # companies - 公司表
    # ============================================================
    op.create_table('companies',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False,
                  comment='公司名称'),
        sa.Column('invite_code', sa.String(length=10), nullable=False,
                  comment='邀请码'),
        sa.Column('subscription_plan', sa.String(length=50), nullable=True,
                  server_default='free', comment='公司订阅套餐'),
        sa.Column('subscription_expires', sa.DateTime(timezone=True),
                  nullable=True, comment='公司订阅过期时间'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_companies_invite_code', 'companies',
                    ['invite_code'], unique=True)

    # ============================================================
    # users - 用户表
    # ============================================================
    op.create_table('users',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('role', sa.String(length=20), nullable=False,
                  server_default='user'),
        sa.Column('is_active', sa.Boolean(), nullable=True,
                  server_default=sa.text('true')),
        sa.Column('company_id', sa.String(length=50), nullable=True,
                  comment='所属公司ID，用于数据隔离'),
        sa.Column('balance', sa.Float(), nullable=True,
                  server_default=sa.text('0'), comment='账户余额'),
        sa.Column('subscription_plan', sa.String(length=50), nullable=True,
                  server_default='free', comment='订阅套餐'),
        sa.Column('subscription_expires', sa.DateTime(timezone=True),
                  nullable=True, comment='订阅过期时间'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_company_id', 'users', ['company_id'],
                    unique=False)

    # ============================================================
    # resumes - 简历表
    # ============================================================
    op.create_table('resumes',
        sa.Column('resume_id', sa.String(length=50), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('resume_text', sa.Text(), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('job_id', sa.String(length=50), nullable=True,
                  comment='关联的岗位ID'),
        sa.Column('embedding_status', sa.String(length=20), nullable=True,
                  comment='embedding 状态: pending/processing/completed/failed'),
        sa.Column('embedding_error', sa.Text(), nullable=True,
                  comment='embedding 处理错误信息'),
        sa.Column('is_screened', sa.Boolean(), nullable=True,
                  comment='是否已被筛选过'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('resume_id'),
    )

    # ============================================================
    # jobs - 岗位表
    # ============================================================
    op.create_table('jobs',
        sa.Column('job_id', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('requirements', sa.Text(), nullable=True),
        sa.Column('experience_years', sa.Integer(), nullable=True,
                  comment='工作经验要求（年）'),
        sa.Column('education', sa.String(length=50), nullable=True,
                  comment='学历要求'),
        sa.Column('certifications', sa.Text(), nullable=True,
                  comment='资格证书要求'),
        sa.Column('salary_range', sa.String(length=100), nullable=True),
        sa.Column('location', sa.String(length=100), nullable=True),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('job_id'),
    )

    # ============================================================
    # screening_results - 筛选结果表
    # ============================================================
    op.create_table('screening_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('result_id', sa.String(length=50), nullable=False),
        sa.Column('job_id', sa.String(length=50), nullable=False),
        sa.Column('resume_id', sa.String(length=50), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False,
                  comment='使用的LLM模型'),
        sa.Column('screening_type', sa.String(length=20), nullable=False,
                  server_default='job',
                  comment='筛选方式: job-岗位筛选, custom-自定义描述筛选'),
        sa.Column('rerank_score', sa.Float(), nullable=False,
                  comment='Rerank得分'),
        sa.Column('raw_score', sa.Float(), nullable=False,
                  comment='原始Rerank得分'),
        sa.Column('rank', sa.Integer(), nullable=False, comment='排名'),
        sa.Column('llm_evaluation', sa.Text(), nullable=False,
                  comment='LLM评估内容'),
        sa.Column('matching_score', sa.Float(), nullable=True,
                  server_default=sa.text('0'),
                  comment='LLM匹配度评分'),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('result_id'),
    )

    # ============================================================
    # contacts - 联系表单表
    # ============================================================
    op.create_table('contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False,
                  comment='联系人姓名'),
        sa.Column('email', sa.String(length=100), nullable=False,
                  comment='联系人邮箱'),
        sa.Column('message', sa.Text(), nullable=False, comment='留言内容'),
        sa.Column('status', sa.String(length=20), nullable=True,
                  server_default='pending',
                  comment='处理状态: pending-待处理, processed-已处理'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ============================================================
    # payment_orders - 支付订单表
    # ============================================================
    op.create_table('payment_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False, comment='支付金额'),
        sa.Column('currency', sa.String(length=10), nullable=True,
                  server_default='CNY', comment='货币类型'),
        sa.Column('payment_method', sa.String(length=50), nullable=False,
                  comment='支付方式: wechat, alipay, stripe'),
        sa.Column('product_type', sa.String(length=50), nullable=False,
                  comment='产品类型: subscription-订阅, credit-余额充值'),
        sa.Column('product_id', sa.String(length=50), nullable=True,
                  comment='产品ID'),
        sa.Column('product_name', sa.String(length=255), nullable=False,
                  comment='产品名称'),
        sa.Column('status', sa.String(length=20), nullable=True,
                  server_default='pending',
                  comment='订单状态: pending-待支付, paid-已支付, '
                          'failed-支付失败, cancelled-已取消'),
        sa.Column('payment_data', sa.JSON(), nullable=True,
                  comment='支付平台返回的数据'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True,
                  comment='支付完成时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
    )
    op.create_index('ix_payment_orders_user_id', 'payment_orders',
                    ['user_id'], unique=False)

    # ============================================================
    # subscription_plans - 订阅套餐表
    # ============================================================
    op.create_table('subscription_plans',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False,
                  comment='套餐名称'),
        sa.Column('description', sa.Text(), nullable=True,
                  comment='套餐描述'),
        sa.Column('price', sa.Float(), nullable=False, comment='价格'),
        sa.Column('duration_days', sa.Integer(), nullable=False,
                  comment='有效期（天）'),
        sa.Column('max_resumes', sa.Integer(), nullable=True,
                  comment='最大简历数量'),
        sa.Column('max_jobs', sa.Integer(), nullable=True,
                  comment='最大岗位数量'),
        sa.Column('ai_screening', sa.Boolean(), nullable=True,
                  comment='是否包含AI筛选'),
        sa.Column('priority_support', sa.Boolean(), nullable=True,
                  comment='是否优先支持'),
        sa.Column('is_active', sa.Boolean(), nullable=True,
                  comment='是否激活'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # 插入默认套餐数据
    op.execute("""
        INSERT INTO subscription_plans
            (id, name, description, price, duration_days,
             max_resumes, max_jobs, ai_screening,
             priority_support, is_active)
        VALUES
            ('free',         '免费版', '基础功能体验', 0,   30,
             10,   3,   FALSE, FALSE, TRUE),
            ('basic',        '基础版', '适合小型团队', 99,  30,
             100,  10,  TRUE,  FALSE, TRUE),
            ('professional', '专业版', '适合中型企业', 299, 30,
             500,  50,  TRUE,  TRUE,  TRUE),
            ('enterprise',   '企业版', '适合大型企业', 999, 30,
             1000, 100, TRUE,  TRUE,  TRUE)
        ON CONFLICT (id) DO NOTHING
    """)

    # ============================================================
    # audit_logs - 审计日志表
    # ============================================================
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('operator_id', sa.String(length=50), nullable=False,
                  comment='操作人ID'),
        sa.Column('operator_name', sa.String(length=50), nullable=False,
                  comment='操作人用户名'),
        sa.Column('action', sa.String(length=50), nullable=False,
                  comment='操作类型'),
        sa.Column('target_type', sa.String(length=50), nullable=False,
                  comment='目标类型'),
        sa.Column('target_id', sa.String(length=50), nullable=False,
                  comment='目标ID'),
        sa.Column('detail', sa.Text(), nullable=True,
                  comment='变更详情JSON'),
        sa.Column('ip_address', sa.String(length=50), nullable=True,
                  comment='IP地址'),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_operator_id', 'audit_logs',
                    ['operator_id'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs',
                    ['created_at'], unique=False)


def downgrade() -> None:
    """删除所有表."""
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_operator_id', table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_table('subscription_plans')
    op.drop_index('ix_payment_orders_user_id', table_name='payment_orders')
    op.drop_table('payment_orders')
    op.drop_table('contacts')
    op.drop_table('screening_results')
    op.drop_table('jobs')
    op.drop_table('resumes')
    op.drop_index('ix_users_company_id', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_table('users')
    op.drop_index('ix_companies_invite_code', table_name='companies')
    op.drop_table('companies')
