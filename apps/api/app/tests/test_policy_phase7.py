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
