"""add payment tables

Revision ID: add_payment_tables
Revises: f5ed7e38d8a9
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_payment_tables'
down_revision = 'f5ed7e38d8a9'
branch_labels = None
depends_on = None


def upgrade():
    # 为用户表添加支付相关字段
    op.add_column('users', sa.Column('balance', sa.Float(), nullable=True, server_default='0.0', comment='账户余额'))
    op.add_column('users', sa.Column('subscription_plan', sa.String(length=50), nullable=True, server_default='free', comment='订阅套餐'))
    op.add_column('users', sa.Column('subscription_expires', sa.DateTime(timezone=True), nullable=True, comment='订阅过期时间'))
    
    # 创建支付订单表
    op.create_table('payment_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('order_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False, comment='支付金额'),
        sa.Column('currency', sa.String(length=10), nullable=False, server_default='CNY', comment='货币类型'),
        sa.Column('payment_method', sa.String(length=50), nullable=False, comment='支付方式'),
        sa.Column('product_type', sa.String(length=50), nullable=False, comment='产品类型'),
        sa.Column('product_id', sa.String(length=50), nullable=True, comment='产品ID'),
        sa.Column('product_name', sa.String(length=255), nullable=False, comment='产品名称'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending', comment='订单状态'),
        sa.Column('payment_data', sa.JSON(), nullable=True, comment='支付平台返回的数据'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True, comment='支付完成时间'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('order_id'),
        sa.Index('ix_payment_orders_user_id', 'user_id')
    )
    
    # 创建订阅套餐表
    op.create_table('subscription_plans',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False, comment='套餐名称'),
        sa.Column('description', sa.Text(), nullable=True, comment='套餐描述'),
        sa.Column('price', sa.Float(), nullable=False, comment='价格'),
        sa.Column('duration_days', sa.Integer(), nullable=False, comment='有效期（天）'),
        sa.Column('max_resumes', sa.Integer(), nullable=False, server_default='100', comment='最大简历数量'),
        sa.Column('max_jobs', sa.Integer(), nullable=False, server_default='10', comment='最大岗位数量'),
        sa.Column('ai_screening', sa.Boolean(), nullable=False, server_default='true', comment='是否包含AI筛选'),
        sa.Column('priority_support', sa.Boolean(), nullable=False, server_default='false', comment='是否优先支持'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', comment='是否激活'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # 插入默认套餐数据
    op.bulk_insert(
        sa.table('subscription_plans',
            sa.Column('id', sa.String),
            sa.Column('name', sa.String),
            sa.Column('description', sa.Text),
            sa.Column('price', sa.Float),
            sa.Column('duration_days', sa.Integer),
            sa.Column('max_resumes', sa.Integer),
            sa.Column('max_jobs', sa.Integer),
            sa.Column('ai_screening', sa.Boolean),
            sa.Column('priority_support', sa.Boolean),
            sa.Column('is_active', sa.Boolean)
        ),
        [
            {
                'id': 'free',
                'name': '免费版',
                'description': '基础功能体验',
                'price': 0.0,
                'duration_days': 30,
                'max_resumes': 10,
                'max_jobs': 3,
                'ai_screening': False,
                'priority_support': False,
                'is_active': True
            },
            {
                'id': 'basic',
                'name': '基础版',
                'description': '适合小型团队',
                'price': 99.0,
                'duration_days': 30,
                'max_resumes': 100,
                'max_jobs': 10,
                'ai_screening': True,
                'priority_support': False,
                'is_active': True
            },
            {
                'id': 'professional',
                'name': '专业版',
                'description': '适合中型企业',
                'price': 299.0,
                'duration_days': 30,
                'max_resumes': 500,
                'max_jobs': 50,
                'ai_screening': True,
                'priority_support': True,
                'is_active': True
            },
            {
                'id': 'enterprise',
                'name': '企业版',
                'description': '适合大型企业',
                'price': 999.0,
                'duration_days': 30,
                'max_resumes': 1000,
                'max_jobs': 100,
                'ai_screening': True,
                'priority_support': True,
                'is_active': True
            }
        ]
    )


def downgrade():
    op.drop_table('subscription_plans')
    op.drop_table('payment_orders')
    op.drop_column('users', 'subscription_expires')
    op.drop_column('users', 'subscription_plan')
    op.drop_column('users', 'balance')