from app.config import settings
from app.models.database import Domain
from decimal import Decimal
from datetime import datetime, timezone, timedelta

# NOTE: Expiry / tie semantics are simulated since negative votes & expiry not yet implemented.
# These tests assert current behavior and guard future changes.

def _open_dispute(client, headers, domain):
    r = client.post('/api/v1/valuation/dispute', json={'domain': domain, 'reason': 'edge'}, headers=headers)
    assert r.status_code == 200
    return r.json()['dispute_id']

def test_no_quorum_dispute_allows_valuation_progress(client, auth_token, db_session, monkeypatch):
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    domain = 'noquorum.eth'
    db_session.add(Domain(name=domain)); db_session.commit()
    headers = {'Authorization': f'Bearer {auth_token}'}
    # initial valuation
    client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    dispute_id = _open_dispute(client, headers, domain)
    # Cast fewer than threshold-1 votes
    for _ in range(max(settings.valuation_dispute_vote_threshold - 2, 0)):
        client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    # Another valuation batch should proceed (no assert on value content, just success)
    r = client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    assert r.status_code == 200


def test_override_precedence_over_dispute_clamp(client, auth_token, db_session, monkeypatch):
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    domain = 'overrideprecedence.eth'
    db_session.add(Domain(name=domain)); db_session.commit()
    headers = {'Authorization': f'Bearer {auth_token}'}
    # initial valuation
    client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    dispute_id = _open_dispute(client, headers, domain)
    # Reach quorum
    for _ in range(settings.valuation_dispute_vote_threshold):
        client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    # Apply override while dispute open (clamped)
    override_value = '9999'
    r = client.post('/api/v1/valuation/override', json={'domain': domain, 'value': override_value, 'reason': 'manual fix'}, headers=headers)
    assert r.status_code == 200
    # Fetch factors to ensure override visible
    fr = client.get(f'/api/v1/valuation/factors?domain={domain}', headers=headers)
    assert fr.status_code == 200
    ov = fr.json().get('override', {}).get('value')
    from decimal import Decimal as _D
    assert _D(str(ov)) == _D(override_value)


def test_dispute_resolution_lifts_clamp_and_allows_new_override(client, auth_token, db_session, monkeypatch):
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    domain = 'postlift.eth'
    db_session.add(Domain(name=domain)); db_session.commit()
    headers = {'Authorization': f'Bearer {auth_token}'}
    client.post('/api/v1/valuation/batch', json={'domains':[domain]}, headers=headers)
    dispute_id = _open_dispute(client, headers, domain)
    for _ in range(settings.valuation_dispute_vote_threshold):
        client.post('/api/v1/valuation/dispute/vote', json={'dispute_id': dispute_id, 'vote': True}, headers=headers)
    # Resolve (reject)
    rr = client.post(f'/api/v1/valuation/dispute/resolve?dispute_id={dispute_id}&accept=false', headers=headers)
    assert rr.status_code == 200
    # New override after resolution
    r2 = client.post('/api/v1/valuation/override', json={'domain': domain, 'value': '1234', 'reason': 'after resolution'}, headers=headers)
    assert r2.status_code == 200
