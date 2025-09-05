import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.models.database import User, Participant, Competition, DomainETF, DomainETFRedemptionIntent
from app.services.abuse_guard import abuse_guard

@pytest.mark.asyncio
async def test_rate_limit_trades(db_session: Session, client: TestClient, auth_token: str):
    # Setup competition + user participant
    now = datetime.now(timezone.utc)
    comp = Competition(name='RL', chain_id=1, start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1))
    db_session.add(comp); db_session.commit(); db_session.refresh(comp)
    u = db_session.query(User).first()
    if not u:
        u = User(wallet_address='0xrluser')
        db_session.add(u); db_session.commit(); db_session.refresh(u)
    part = Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal('100'))
    db_session.add(part); db_session.commit(); db_session.refresh(part)
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Rapidly create listings until 429 observed (burst threshold)
    got_429 = False
    for i in range(50):
        r = client.post('/api/v1/market/listing', params={'domain': f'rl{i}.dom', 'contract':'0x0','token_id':str(i),'price':'1'}, headers=headers)
        if r.status_code == 429:
            got_429 = True
            break
    assert got_429, 'expected rate limit 429 not triggered'

def test_idempotent_redemption_intent(db_session: Session, client: TestClient, auth_token: str):
    # Create ETF
    u = db_session.query(User).first()
    if not u:
        u = User(wallet_address='0xetfuser')
        db_session.add(u); db_session.commit(); db_session.refresh(u)
    etf = DomainETF(owner_user_id=u.id, name='TestETF', symbol='TST', total_shares=Decimal('100'), nav_last=Decimal('1'))
    db_session.add(etf); db_session.commit(); db_session.refresh(etf)
    headers = {"Authorization": f"Bearer {auth_token}", 'Idempotency-Key': 'idem-123'}
    r1 = client.post(f'/api/v1/settlement/etfs/{etf.id}/redemption-intents', json={'shares':'5'}, headers=headers)
    assert r1.status_code == 200
    rid = r1.json()['id']
    r2 = client.post(f'/api/v1/settlement/etfs/{etf.id}/redemption-intents', json={'shares':'5'}, headers=headers)
    assert r2.status_code == 200
    assert r2.json()['idempotent'] is True
    assert r2.json()['id'] == rid

def test_circuit_breaker_blocks_trading(db_session: Session, client: TestClient, auth_token: str):
    # Force circuit breaker by recording large NAV move (> configured 20%)
    abuse_guard.record_nav(Decimal('100'))
    abuse_guard.record_nav(Decimal('75'))  # 25% drop triggers breaker
    assert abuse_guard.circuit_breaker_active()
    headers = {"Authorization": f"Bearer {auth_token}"}
    r = client.post('/api/v1/market/listing', params={'domain': 'cb.dom', 'contract':'0x0','token_id':'1','price':'1'}, headers=headers)
    assert r.status_code == 503