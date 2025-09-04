import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.database import Domain, Trade, Valuation, OrderbookSnapshot, User
from datetime import datetime, timezone, timedelta
from decimal import Decimal

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()

@pytest.fixture
def user(db):
    u = User(wallet_address='0xuser00000000000000000000000000000001')
    db.add(u); db.commit(); db.refresh(u)
    return u

@pytest.fixture
def domain(db):
    d = Domain(name='example.test', tld='test', last_estimated_value=Decimal('100'))
    db.add(d); db.commit(); db.refresh(d)
    return d


def test_valuation_without_orderbook(db, domain):
    # No snapshots -> orderbook_mid None, ensure valuation still produced
    payload = {"domains":[domain.name]}
    r = client.post('/api/v1/valuation/batch', json=payload)
    assert r.status_code == 200
    data = r.json()['results'][0]
    assert data['domain'] == domain.name
    assert 'orderbook_mid' in data['factors']


def test_valuation_with_orderbook_mid(db, domain):
    # Insert synthetic snapshots to produce orderbook mid influence
    for price in [90, 95, 105]:
        db.add(OrderbookSnapshot(domain_name=domain.name, side='BUY', price=Decimal(price), size=Decimal(1)))
    for price in [110, 120, 130]:
        db.add(OrderbookSnapshot(domain_name=domain.name, side='SELL', price=Decimal(price), size=Decimal(1)))
    db.commit()
    r = client.post('/api/v1/valuation/batch', json={"domains":[domain.name]})
    assert r.status_code == 200
    data = r.json()['results'][0]
    mid = data['factors']['orderbook_mid']
    assert mid is not None
    # Mid should be around median of bids (95) and asks (120) => (95+120)/2 = 107.5
    assert abs(float(mid) - 107.5) < 1


def test_valuation_override(db, domain, user, monkeypatch):
    # Set admin wallet
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', [user.wallet_address.lower()])
    # Need auth dependency bypass; patch get_current_user to return user
    import app.deps.auth as auth_mod
    async def fake_get_current_user(request=None):  # type: ignore
        return user
    monkeypatch.setattr(auth_mod, 'get_current_user', fake_get_current_user)
    r = client.post('/api/v1/valuation/override', json={"domain": domain.name, "value": "150", "reason": "manual"})
    assert r.status_code == 200
    # factors endpoint should show override
    r2 = client.get(f'/api/v1/valuation/factors?domain={domain.name}')
    assert r2.status_code == 200
    j = r2.json()
    assert j['override'] is not None
    assert j['override']['value'] == '150'


def test_metrics_counters(db, domain):
    # Trigger valuation to increment counters
    client.post('/api/v1/valuation/batch', json={"domains":[domain.name]})
    metrics = client.get('/metrics').text
    assert 'valuation_records_total' in metrics
