from decimal import Decimal
from app.config import settings
from app.models.database import Domain, Valuation, DomainValuationDispute

# Helper to fetch latest valuation quickly
def _latest_val(db_session, domain):
    return db_session.query(Valuation).filter(Valuation.domain_name==domain).order_by(Valuation.created_at.desc()).first()

def test_dispute_open_vote_quorum_and_resolution(client, auth_token, db_session, monkeypatch):
    # Ensure test user is treated as admin for resolve endpoint
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    domain = 'quorumtest.eth'
    # Seed domain + initial valuation baseline by calling batch once
    db_session.add(Domain(name=domain))
    db_session.commit()
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Trigger initial valuation
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code==200
    first_val = Decimal(r.json()['results'][0]['value'])
    # Open dispute
    r = client.post('/api/v1/valuation/dispute', json={'domain': domain, 'reason':'suspicious spike'}, headers=headers)
    assert r.status_code==200
    dispute_id = r.json().get('dispute_id')
    assert dispute_id
    # Vote up to threshold-1
    threshold = settings.valuation_dispute_vote_threshold
    for i in range(threshold-1):
        r = client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
        assert r.status_code==200
        assert r.json()['votes'] == i+1
    # Not yet quorum -> valuation should still update (simulate second valuation attempt by forcing another batch call)
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code==200
    second_val = Decimal(r.json()['results'][0]['value'])
    # If no new market data difference, value may match; allow either shift or same prior
    # Cast final vote to reach quorum
    r = client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    assert r.status_code==200
    assert r.json()['votes'] == threshold
    # After quorum, another valuation batch should clamp to previous (second_val)
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code==200
    third_val = Decimal(r.json()['results'][0]['value'])
    # On clamp, value should equal latest pre-quorum valuation (second_val) not diverge upward (best effort heuristic)
    assert third_val == second_val
    # Resolve dispute (accept)
    r = client.post(f'/api/v1/valuation/dispute/resolve?dispute_id={dispute_id}&accept=true', headers=headers)
    assert r.status_code==200
    # Post-resolution, valuation updates can move again; simulate one more batch
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code==200
    fourth_val = Decimal(r.json()['results'][0]['value'])
    # Allow change or same (depends on factors); ensure no regression in API contract
    assert fourth_val >= Decimal('0')
