import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.main import app
from app.database import Base, engine, SessionLocal
from app.models.database import User, Competition, Participant, CompetitionEpoch, CompetitionReward, PortfolioValueHistory

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def seed_competition(db):
    comp = Competition(contract_address='0xabc', chain_id=1, name='Comp', description='d', start_time=datetime.now(timezone.utc)-timedelta(days=1), end_time=datetime.now(timezone.utc)+timedelta(days=1))
    db.add(comp); db.commit(); db.refresh(comp)
    return comp

def test_full_leaderboard_and_reward_pool_summary(monkeypatch):
    from app import config as cfg
    admin_addr = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    monkeypatch.setattr(cfg.settings, 'admin_wallets', [admin_addr])
    db = SessionLocal()
    comp = seed_competition(db)
    # Users/participants
    users = []
    for i in range(3):
        u = User(wallet_address=f'0x{i+1:039x}')
        db.add(u); db.commit(); db.refresh(u)
        p = Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal(100*(i+1)))
        db.add(p); db.commit()
        users.append((u,p))
    # Epoch + rewards & history snapshots (simulate returns)
    ep = CompetitionEpoch(competition_id=comp.id, epoch_index=0, start_time=datetime.now(timezone.utc)-timedelta(hours=5), end_time=datetime.now(timezone.utc)+timedelta(hours=1), reward_pool=Decimal('300'))
    db.add(ep); db.commit(); db.refresh(ep)
    now = datetime.now(timezone.utc)
    for (u,p) in users:
        r = CompetitionReward(competition_id=comp.id, epoch_id=ep.id, user_id=u.id, points=Decimal(100), volume=Decimal(200))
        db.add(r)
        # 3 snapshots for returns
        for k in range(3):
            h = PortfolioValueHistory(participant_id=p.id, snapshot_time=now - timedelta(minutes=60*(3-k)), value=Decimal(100*(users.index((u,p))+1) + k*10))
            db.add(h)
    db.commit()
    # Leaderboard full
    resp = client.get(f"/api/v1/competitions/{comp.id}/leaderboard/full")
    assert resp.status_code == 200
    data = resp.json()
    assert 'entries' in data and len(data['entries']) == 3
    # Reward pool summary
    resp2 = client.get(f"/api/v1/competitions/{comp.id}/reward-pool/summary")
    assert resp2.status_code == 200
    summ = resp2.json()
    assert summ['epochs'][0]['epoch_index'] == 0
    db.close()
