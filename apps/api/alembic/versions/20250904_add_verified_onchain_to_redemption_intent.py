"""add verified_onchain to redemption intents

Revision ID: add_verified_onchain_redemption
Revises: 
Create Date: 2025-09-04
"""
from alembic import op
import sqlalchemy as sa

revision = 'add_verified_onchain_redemption'
down_revision = 'aad32567bf88'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('domain_etf_redemption_intents', sa.Column('verified_onchain', sa.Boolean(), nullable=True))
    op.create_index('ix_domain_etf_redemption_intents_verified_onchain', 'domain_etf_redemption_intents', ['verified_onchain'])


def downgrade() -> None:
    op.drop_index('ix_domain_etf_redemption_intents_verified_onchain', table_name='domain_etf_redemption_intents')
    op.drop_column('domain_etf_redemption_intents', 'verified_onchain')
