"""add creation unit and lock until

Revision ID: 20250903_6
Revises: 20250903_5
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20250903_6'
down_revision = '20250903_5'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('domain_etfs', sa.Column('creation_unit_size', sa.Numeric(24,8), nullable=True))
    op.add_column('domain_etf_shares', sa.Column('lock_until', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_domain_etf_shares_lock_until', 'domain_etf_shares', ['lock_until'])

def downgrade() -> None:
    op.drop_index('ix_domain_etf_shares_lock_until', table_name='domain_etf_shares')
    op.drop_column('domain_etf_shares', 'lock_until')
    op.drop_column('domain_etfs', 'creation_unit_size')
