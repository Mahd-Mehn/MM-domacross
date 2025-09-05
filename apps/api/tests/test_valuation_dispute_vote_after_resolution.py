from app.config import settings
from app.models.database import Domain
from decimal import Decimal

def test_dispute_vote_after_resolution_forbidden(client, auth_token, db_session, monkeypatch):
    # Make user admin for resolution
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    domain = 'postresolve.eth'
    db_session.add(Domain(name=domain))
    db_session.commit()
    headers = {'Authorization': f'Bearer {auth_token}'}
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code==200
    r = client.post('/api/v1/valuation/dispute', json={'domain': domain}, headers=headers)
    assert r.status_code==200
    dispute_id = r.json()['dispute_id']
    # Vote to reach quorum quickly
    threshold = settings.valuation_dispute_vote_threshold
    for _ in range(threshold):
        client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    # Resolve
    rr = client.post(f'/api/v1/valuation/dispute/resolve?dispute_id={dispute_id}&accept=true', headers=headers)
    assert rr.status_code==200
    # Attempt further vote
    rv = client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    assert rv.status_code in (404, 400)
