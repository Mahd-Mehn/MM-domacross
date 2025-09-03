"""init schema

Revision ID: 9c27ed79c434
Revises: 
Create Date: 2025-09-03 21:51:34.089061

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9c27ed79c434'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('wallet_address', sa.String(length=42), nullable=False),
        sa.Column('username', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_wallet_address'), 'users', ['wallet_address'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    op.create_table('competitions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_address', sa.String(length=42), nullable=False),
        sa.Column('chain_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('entry_fee', sa.Numeric(18,8), nullable=True),
        sa.Column('rules', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_competitions_contract_address'), 'competitions', ['contract_address'], unique=True)
    op.create_index(op.f('ix_competitions_id'), 'competitions', ['id'], unique=False)

    op.create_table('participants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('competition_id', sa.Integer(), nullable=False),
        sa.Column('portfolio_value', sa.Numeric(18,8), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['competition_id'], ['competitions.id'])
    )
    op.create_index(op.f('ix_participants_id'), 'participants', ['id'], unique=False)

    op.create_table('processed_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('unique_id', sa.String(length=255), nullable=False),
        sa.Column('event_type', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('unique_id', name='uq_processed_events_unique')
    )
    op.create_index(op.f('ix_processed_events_id'), 'processed_events', ['id'], unique=False)

    op.create_table('trades',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('participant_id', sa.Integer(), nullable=False),
        sa.Column('domain_token_address', sa.String(length=42), nullable=False),
        sa.Column('domain_token_id', sa.String(length=255), nullable=False),
        sa.Column('trade_type', sa.String(length=4), nullable=False),
        sa.Column('price', sa.Numeric(18,8), nullable=False),
        sa.Column('tx_hash', sa.String(length=66), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['participant_id'], ['participants.id']),
        sa.UniqueConstraint('tx_hash')
    )
    op.create_index(op.f('ix_trades_id'), 'trades', ['id'], unique=False)

    # New tables added after initial iteration
    op.create_table('domains',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('tld', sa.String(length=32), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('last_seen_event_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_floor_price', sa.Numeric(18,8), nullable=True),
        sa.Column('last_estimated_value', sa.Numeric(18,8), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index(op.f('ix_domains_id'), 'domains', ['id'], unique=False)
    op.create_index(op.f('ix_domains_name'), 'domains', ['name'], unique=True)
    op.create_index(op.f('ix_domains_tld'), 'domains', ['tld'], unique=False)

    op.create_table('listings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain_name', sa.String(length=255), nullable=False),
        sa.Column('seller_wallet', sa.String(length=42), nullable=False),
        sa.Column('price', sa.Numeric(18,8), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['domain_name'], ['domains.name'])
    )
    op.create_index(op.f('ix_listings_id'), 'listings', ['id'], unique=False)
    op.create_index(op.f('ix_listings_domain_name'), 'listings', ['domain_name'], unique=False)
    op.create_index(op.f('ix_listings_active'), 'listings', ['active'], unique=False)

    op.create_table('offers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain_name', sa.String(length=255), nullable=False),
        sa.Column('buyer_wallet', sa.String(length=42), nullable=False),
        sa.Column('price', sa.Numeric(18,8), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['domain_name'], ['domains.name'])
    )
    op.create_index(op.f('ix_offers_id'), 'offers', ['id'], unique=False)
    op.create_index(op.f('ix_offers_domain_name'), 'offers', ['domain_name'], unique=False)
    op.create_index(op.f('ix_offers_active'), 'offers', ['active'], unique=False)

    op.create_table('orderbook_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain_name', sa.String(length=255), nullable=False),
        sa.Column('side', sa.String(length=4), nullable=False),
        sa.Column('price', sa.Numeric(18,8), nullable=False),
        sa.Column('size', sa.Numeric(18,8), nullable=False),
        sa.Column('collected_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['domain_name'], ['domains.name'])
    )
    op.create_index(op.f('ix_orderbook_snapshots_id'), 'orderbook_snapshots', ['id'], unique=False)
    op.create_index(op.f('ix_orderbook_snapshots_domain_name'), 'orderbook_snapshots', ['domain_name'], unique=False)
    op.create_index(op.f('ix_orderbook_snapshots_collected_at'), 'orderbook_snapshots', ['collected_at'], unique=False)

    op.create_table('valuations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('domain_name', sa.String(length=255), nullable=False),
        sa.Column('model_version', sa.String(length=32), nullable=False),
        sa.Column('value', sa.Numeric(18,8), nullable=False),
        sa.Column('factors', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['domain_name'], ['domains.name'])
    )
    op.create_index(op.f('ix_valuations_id'), 'valuations', ['id'], unique=False)
    op.create_index(op.f('ix_valuations_domain_name'), 'valuations', ['domain_name'], unique=False)
    op.create_index(op.f('ix_valuations_created_at'), 'valuations', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_table('valuations')
    op.drop_table('orderbook_snapshots')
    op.drop_table('offers')
    op.drop_table('listings')
    op.drop_table('domains')
    op.drop_table('trades')
    op.drop_table('processed_events')
    op.drop_table('participants')
    op.drop_table('competitions')
    op.drop_table('users')
