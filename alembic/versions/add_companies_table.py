"""add_companies_table

Revision ID: c9d4e5f6a7b8
Revises: b8c3d2e1f4a5
Create Date: 2026-03-27 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b8c3d2e1f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建 companies 表"""
    op.create_table(
        'companies',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False, comment='公司名称'),
        sa.Column('invite_code', sa.String(10), unique=True, nullable=False,
                   index=True, comment='邀请码'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )


def downgrade() -> None:
    """删除 companies 表"""
    op.drop_table('companies')
