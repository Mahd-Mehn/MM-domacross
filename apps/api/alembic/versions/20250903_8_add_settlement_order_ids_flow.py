"""add settlement_order_ids to etf share flows

Revision ID: 20250903_8
Revises: 20250903_7
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250903_8'
down_revision = '20250903_7'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('domain_etf_share_flows', sa.Column('settlement_order_ids', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('domain_etf_share_flows', 'settlement_order_ids')
