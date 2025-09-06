import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from datetime import datetime, timezone, timedelta
from app.models.database import User, Competition

@pytest.mark.asyncio
async def test_competition_settlement_submit_idempotent(db_session: Session, client: TestClient, auth_token: str):
    # Create competition
    now = datetime.now(timezone.utc)
    comp = Competition(name='SETTLE', chain_id=1, start_time=now - timedelta(hours=1), end_time=now + timedelta(hours=1))
    db_session.add(comp); db_session.commit(); db_session.refresh(comp)
    # Ensure user exists (auth_token fixture should align with first user)
    u = db_session.query(User).first()
    if not u:
        u = User(wallet_address='0xsettler')
        db_session.add(u); db_session.commit(); db_session.refresh(u)
    headers = {"Authorization": f"Bearer {auth_token}", 'Idempotency-Key': 'comp-settle-1'}
    payload = {"tx_hash": "0xdeadbeef", "distribution": [{"address": "0xabc", "amount": "10"}]}
    r1 = client.post(f"/api/v1/settlement/competitions/{comp.id}/submit", json=payload, headers=headers)
    assert r1.status_code == 200, r1.text
    j1 = r1.json()
    assert j1.get('idempotent') is False
    r2 = client.post(f"/api/v1/settlement/competitions/{comp.id}/submit", json=payload, headers=headers)
    assert r2.status_code == 200, r2.text
    j2 = r2.json()
    assert j2.get('idempotent') is True
    assert j2['audit_event_id'] == j1['audit_event_id']
