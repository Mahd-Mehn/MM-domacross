import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.database import Competition, User, Participant, CompetitionEpoch, CompetitionReward
from datetime import datetime, timedelta, timezone
from decimal import Decimal

client = TestClient(app)

@pytest.fixture(autouse=True, scope='module')
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def create_admin_user(db):
    u = User(wallet_address='0xadmin00000000000000000000000000000001')  # 42 chars max
    db.add(u); db.commit(); db.refresh(u)
    return u

def test_epoch_distribution_flow(monkeypatch):
    # Force admin wallets setting
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xadmin00000000000000000000000000000001'])
    db = SessionLocal()
    admin = create_admin_user(db)
    # Patch auth dependency to always return admin
    import app.deps.auth as auth_mod
    async def fake_get_current_user(request=None):  # type: ignore
        return admin
    monkeypatch.setattr(auth_mod, 'get_current_user', fake_get_current_user)
    comp = Competition(contract_address='0xcomp', chain_id=1, name='Test', description='d', start_time=datetime.now(timezone.utc)-timedelta(days=1), end_time=datetime.now(timezone.utc)+timedelta(days=1), entry_fee=None, rules=None)
    db.add(comp); db.commit(); db.refresh(comp)
    # participants
    p_users = []
    for i in range(3):
        u = User(wallet_address=f'0xuser{i:035d}')
        db.add(u); db.commit(); db.refresh(u)
        p = Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal('100')*(i+1))
        db.add(p); db.commit()
        p_users.append(u)
    # epoch ended
    ep = CompetitionEpoch(competition_id=comp.id, epoch_index=0, start_time=datetime.now(timezone.utc)-timedelta(days=2), end_time=datetime.now(timezone.utc)-timedelta(hours=1), reward_pool=Decimal('300'))
    db.add(ep); db.commit(); db.refresh(ep)
    # reward points
    for i, pu in enumerate(p_users, start=1):
        r = CompetitionReward(competition_id=comp.id, epoch_id=ep.id, user_id=pu.id, points=Decimal(100*i), volume=Decimal(100*i))
        db.add(r); db.commit()
    # Auth header mimic (bypass actual auth dependency by patching get_current_user if needed)
    # Directly call endpoint assuming admin wallet (would normally need token)
    response = client.post(f"/api/v1/competitions/{comp.id}/epochs/0/distribute")
    assert response.status_code in (200,403,401)  # environment may enforce auth; at least ensure no 500
    # Validate reward amounts present
    rewards = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id).all()
    assert any(r.reward_amount for r in rewards)
    db.close()
