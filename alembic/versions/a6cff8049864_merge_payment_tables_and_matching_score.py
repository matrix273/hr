"""merge payment tables and matching score

Revision ID: a6cff8049864
Revises: add_payment_tables, e126070c8b49
Create Date: 2026-03-25 19:06:26.607707

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a6cff8049864'
down_revision: Union[str, Sequence[str], None] = ('add_payment_tables', 'e126070c8b49')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
