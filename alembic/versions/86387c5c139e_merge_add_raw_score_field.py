"""merge add_raw_score_field

Revision ID: 86387c5c139e
Revises: add_raw_score_field
Create Date: 2026-03-17 22:16:03.085710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86387c5c139e'
down_revision: Union[str, Sequence[str], None] = 'add_raw_score_field'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
