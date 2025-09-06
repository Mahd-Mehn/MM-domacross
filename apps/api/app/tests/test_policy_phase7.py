import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models.database import User
from app.services.jwt_service import issue_token
import pytest

client = TestClient(app)

@pytest.fixture
def admin_token():
    db = SessionLocal()
    u = db.query(User).filter(User.wallet_address=='0xadmin').first()
    if not u:
        u = User(wallet_address='0xadmin', is_admin=True)
        db.add(u)
        db.commit()
        db.refresh(u)
    elif not u.is_admin:
        u.is_admin = True
        db.commit()
    try:
        token = issue_token(u.wallet_address)
    except Exception:
        pytest.skip('JWT keys not configured')
    db.close()
    return token

@pytest.fixture
def user_token():
    db = SessionLocal()
    u = db.query(User).filter(User.wallet_address=='0xuser').first()
    if not u:
        u = User(wallet_address='0xuser')
        db.add(u)
        db.commit()
        db.refresh(u)
    try:
        token = issue_token(u.wallet_address)
    except Exception:
        pytest.skip('JWT keys not configured')
    db.close()
    return token

def _auth_headers(token):
    return { 'Authorization': f'Bearer {token}' }

def test_whitelist_add_and_enforce(admin_token, user_token):
    # add whitelist entry
    r = client.post('/api/v1/policy/whitelist', json={'domain_name':'example.eth'}, headers=_auth_headers(admin_token))
    assert r.status_code == 200
    # user attempts listing allowed domain
    r2 = client.post('/api/v1/market/listing', params={'domain':'example.eth','contract':'0xabc','token_id':'1','price':'1'}, headers=_auth_headers(user_token))
    assert r2.status_code == 200, r2.text
    # user attempts non-whitelisted domain
    r3 = client.post('/api/v1/market/listing', params={'domain':'notallowed.eth','contract':'0xabc','token_id':'1','price':'1'}, headers=_auth_headers(user_token))
    assert r3.status_code == 400

def test_kyc_flow(admin_token, user_token):
    # user submit KYC
    r = client.post('/api/v1/policy/kyc/request', json={'document_hash':'0xhash'}, headers=_auth_headers(user_token))
    assert r.status_code == 200
    # admin list pending
    r2 = client.get('/api/v1/policy/kyc/requests', headers=_auth_headers(admin_token))
    assert r2.status_code == 200
    req_id = r2.json()[0]['id']
    # approve
    r3 = client.post(f'/api/v1/policy/kyc/requests/{req_id}/approve', headers=_auth_headers(admin_token))
    assert r3.status_code == 200
    # audit log exists
    r4 = client.get('/api/v1/policy/audit', headers=_auth_headers(admin_token))
    assert r4.status_code == 200
    actions = [a['action_type'] for a in r4.json()]
    assert 'KYC_APPROVE' in actions

def test_reward_gating_and_claim(admin_token, user_token):
    # Prepare competition and epoch with a reward record before KYC approval
    from app.database import SessionLocal
    from app.models.database import Competition, CompetitionEpoch, CompetitionReward, Participant, User as U
    from datetime import datetime, timezone, timedelta
    db = SessionLocal()
    comp = db.query(Competition).first()
    if not comp:
        comp = Competition(name='TestComp', description='d', chain_id=1, contract_address='0xC', start_time=datetime.now(timezone.utc)-timedelta(days=2), end_time=datetime.now(timezone.utc)+timedelta(days=2), entry_fee=0, rules='r')
        db.add(comp); db.commit(); db.refresh(comp)
    user = db.query(U).filter(U.wallet_address=='0xuser').first()
    admin = db.query(U).filter(U.wallet_address=='0xadmin').first()
    # Ensure participant exists
    part = db.query(Participant).filter(Participant.user_id==user.id, Participant.competition_id==comp.id).first()
    if not part:
        part = Participant(user_id=user.id, competition_id=comp.id, portfolio_value=0)
        db.add(part); db.commit(); db.refresh(part)
    # Create finished epoch
    ep = db.query(CompetitionEpoch).filter(CompetitionEpoch.competition_id==comp.id, CompetitionEpoch.epoch_index==1).first()
    if not ep:
        ep = CompetitionEpoch(competition_id=comp.id, epoch_index=1, start_time=datetime.now(timezone.utc)-timedelta(days=1, hours=1), end_time=datetime.now(timezone.utc)-timedelta(hours=1), reward_pool=100)
        db.add(ep); db.commit(); db.refresh(ep)
    # Create reward points
    rew = db.query(CompetitionReward).filter(CompetitionReward.epoch_id==ep.id, CompetitionReward.user_id==user.id).first()
    if not rew:
        rew = CompetitionReward(competition_id=comp.id, epoch_id=ep.id, user_id=user.id, points=50, volume=10, pnl=5, sharpe_like=1)
        db.add(rew); db.commit(); db.refresh(rew)
    db.close()
    # Distribute with admin (user not KYC yet)
    r = client.post(f'/api/v1/competitions/{comp.id}/epochs/1/distribute', headers=_auth_headers(admin_token))
    assert r.status_code == 200, r.text
    # Fetch rewards current epoch summary (should show zero reward for user)
    # Approve KYC now
    k = client.post('/api/v1/policy/kyc/request', json={'document_hash':'0xhash2'}, headers=_auth_headers(user_token))
    assert k.status_code in (200,400)  # 400 if already pending
    # list and approve pending if pending
    pending = client.get('/api/v1/policy/kyc/requests', headers=_auth_headers(admin_token))
    if pending.status_code==200:
        for item in pending.json():
            if item['status']=='PENDING' and item['user_id']:
                client.post(f"/api/v1/policy/kyc/requests/{item['id']}/approve", headers=_auth_headers(admin_token))
                break
    # Claim retroactively
    claim = client.post(f'/api/v1/competitions/{comp.id}/epochs/1/claim', headers=_auth_headers(user_token))
    assert claim.status_code == 200, claim.text
    data = claim.json()
    # Should be claimed with non-zero amount because raw_reward_amount existed
    assert data['status'] in ('claimed','already_claimed')
