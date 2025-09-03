"""add external_order_id to listings and offers

Revision ID: 20250903_1
Revises: 9c27ed79c434
Create Date: 2025-09-03
"""

from alembic import op
import sqlalchemy as sa

revision = '20250903_1'
down_revision = '9c27ed79c434'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('listings', sa.Column('external_order_id', sa.String(length=128), nullable=True))
    op.add_column('offers', sa.Column('external_order_id', sa.String(length=128), nullable=True))
    op.create_unique_constraint('uq_listings_external_order_id', 'listings', ['external_order_id'])
    op.create_unique_constraint('uq_offers_external_order_id', 'offers', ['external_order_id'])
    op.create_index('ix_listings_external_order_id', 'listings', ['external_order_id'])
    op.create_index('ix_offers_external_order_id', 'offers', ['external_order_id'])


def downgrade() -> None:
    op.drop_index('ix_offers_external_order_id', table_name='offers')
    op.drop_index('ix_listings_external_order_id', table_name='listings')
    op.drop_constraint('uq_offers_external_order_id', 'offers', type_='unique')
    op.drop_constraint('uq_listings_external_order_id', 'listings', type_='unique')
    op.drop_column('offers', 'external_order_id')
    op.drop_column('listings', 'external_order_id')
