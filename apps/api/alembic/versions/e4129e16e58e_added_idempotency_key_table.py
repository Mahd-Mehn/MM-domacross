"""added idempotency key table

Revision ID: e4129e16e58e
Revises: d2e0150e4eac
Create Date: 2025-09-06 00:39:58.684991

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e4129e16e58e'
down_revision = 'd2e0150e4eac'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False, unique=True, index=True),
        sa.Column('route', sa.String(length=128), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_result_hash', sa.String(length=66), nullable=True),
    )
    try:
        op.create_index('ix_idempotency_keys_key', 'idempotency_keys', ['key'], unique=True)
        op.create_index('ix_idempotency_keys_route', 'idempotency_keys', ['route'])
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index('ix_idempotency_keys_key', table_name='idempotency_keys')
    except Exception:
        pass
    try:
        op.drop_index('ix_idempotency_keys_route', table_name='idempotency_keys')
    except Exception:
        pass
    op.drop_table('idempotency_keys')
