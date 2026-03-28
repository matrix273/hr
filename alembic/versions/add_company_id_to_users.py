"""add_company_id_to_users

Revision ID: b8c3d2e1f4a5
Revises:
Create Date: 2026-03-27 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8c3d2e1f4a5'
down_revision: Union[str, Sequence[str], None] = 'a6cff8049864'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """为 users 表添加 company_id 字段，用于数据隔离"""
    op.add_column(
        'users',
        sa.Column('company_id', sa.String(50), nullable=True, index=True,
                   comment='所属公司ID，用于数据隔离')
    )


def downgrade() -> None:
    """移除 company_id 字段"""
    op.drop_index('ix_users_company_id', table_name='users')
    op.drop_column('users', 'company_id')
