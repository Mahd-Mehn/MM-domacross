"""add domain etf tables

Revision ID: 20250903_3
Revises: 20250903_2
Create Date: 2025-09-03
"""
from alembic import op
import sqlalchemy as sa

revision = '20250903_3'
down_revision = '20250903_2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'domain_etfs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('owner_user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('competition_id', sa.Integer(), sa.ForeignKey('competitions.id'), nullable=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('symbol', sa.String(16), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('total_shares', sa.Numeric(24,8), nullable=False, server_default='0'),
        sa.Column('nav_last', sa.Numeric(18,8), nullable=True),
        sa.Column('nav_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_domain_etf_symbol', 'domain_etfs', ['symbol'])
    op.create_table(
        'domain_etf_positions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('etf_id', sa.Integer(), sa.ForeignKey('domain_etfs.id'), nullable=False, index=True),
        sa.Column('domain_name', sa.String(255), sa.ForeignKey('domains.name'), nullable=False, index=True),
        sa.Column('weight_bps', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint('uq_domain_etf_domain', 'domain_etf_positions', ['etf_id','domain_name'])


def downgrade() -> None:
    op.drop_constraint('uq_domain_etf_domain', 'domain_etf_positions')
    op.drop_table('domain_etf_positions')
    op.drop_constraint('uq_domain_etf_symbol', 'domain_etfs')
    op.drop_table('domain_etfs')
