"""add contacts table

Revision ID: add_contacts
Revises: 0beb38ffe53c
Create Date: 2026-03-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_contacts'
down_revision: Union[str, None] = '0beb38ffe53c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False, comment='联系人姓名'),
        sa.Column('email', sa.String(length=100), nullable=False, comment='联系人邮箱'),
        sa.Column('message', sa.Text(), nullable=False, comment='留言内容'),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='pending', comment='处理状态: pending-待处理, processed-已处理'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('contacts')
