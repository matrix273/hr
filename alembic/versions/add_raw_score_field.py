"""add raw_score field to screening_results table

Revision ID: add_raw_score_field
Revises: f5ed7e38d8a9
Create Date: 2026-03-17 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_raw_score_field'
down_revision: Union[str, Sequence[str], None] = 'f5ed7e38d8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 添加 raw_score 字段
    op.add_column('screening_results', sa.Column('raw_score', sa.Float(), nullable=True, comment='原始Rerank得分'))
    
    # 将现有数据的 raw_score 设置为 rerank_score 的值
    op.execute("UPDATE screening_results SET raw_score = rerank_score")
    
    # 将 raw_score 字段设为非空
    op.alter_column('screening_results', 'raw_score', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 删除 raw_score 字段
    op.drop_column('screening_results', 'raw_score')