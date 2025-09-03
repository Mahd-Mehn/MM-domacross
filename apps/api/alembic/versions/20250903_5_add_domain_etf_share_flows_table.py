"""add domain etf share flows table

Revision ID: 20250903_5
Revises: 20250903_4
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20250903_5'
down_revision = '20250903_4'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'domain_etf_share_flows',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('etf_id', sa.Integer(), sa.ForeignKey('domain_etfs.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('flow_type', sa.String(length=8), nullable=False),
        sa.Column('shares', sa.Numeric(24,8), nullable=False),
        sa.Column('cash_value', sa.Numeric(24,8), nullable=False),
        sa.Column('nav_per_share', sa.Numeric(24,8), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

def downgrade() -> None:
    op.drop_table('domain_etf_share_flows')
