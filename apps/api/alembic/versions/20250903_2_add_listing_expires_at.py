"""add expires_at to listings

Revision ID: 20250903_2
Revises: 20250903_1
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250903_2'
down_revision = '20250903_1'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('listings', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_listings_expires_at', 'listings', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_listings_expires_at', table_name='listings')
    op.drop_column('listings', 'expires_at')
