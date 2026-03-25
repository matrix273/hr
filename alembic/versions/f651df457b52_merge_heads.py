"""merge_heads

Revision ID: f651df457b52
Revises: 86387c5c139e, add_contacts
Create Date: 2026-03-18 23:28:08.137174

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f651df457b52'
down_revision: Union[str, Sequence[str], None] = ('86387c5c139e', 'add_contacts')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
