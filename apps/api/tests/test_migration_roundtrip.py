from app.database import Base, engine
from sqlalchemy import inspect

def test_tables_exist():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    assert 'domain_valuation_overrides' in tables
    # domain table must have last_orderbook_snapshot_at column
    domain_cols = [c['name'] for c in inspector.get_columns('domains')]
    assert 'last_orderbook_snapshot_at' in domain_cols
