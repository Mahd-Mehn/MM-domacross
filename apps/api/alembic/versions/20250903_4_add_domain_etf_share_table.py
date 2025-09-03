"""add domain etf share table

Revision ID: 20250903_4
Revises: 20250903_3
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20250903_4'
down_revision = '20250903_3'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'domain_etf_shares',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('etf_id', sa.Integer(), sa.ForeignKey('domain_etfs.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('shares', sa.Numeric(24,8), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_domain_etf_share_holder', 'domain_etf_shares', ['etf_id','user_id'])


def downgrade() -> None:
    op.drop_constraint('uq_domain_etf_share_holder', 'domain_etf_shares')
    op.drop_table('domain_etf_shares')
