"""add etf redemption intents

Revision ID: 20250903_7
Revises: 20250903_6
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20250903_7'
down_revision = '20250903_6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'domain_etf_redemption_intents',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('etf_id', sa.Integer(), sa.ForeignKey('domain_etfs.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('shares', sa.Numeric(24,8), nullable=False),
        sa.Column('nav_per_share_snapshot', sa.Numeric(24,8), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True, index=True),
    )

def downgrade() -> None:
    op.drop_table('domain_etf_redemption_intents')
