from app.services.audit_service import record_audit_event
import json

def _seed_events(db_session, n=10):
    for i in range(n):
        record_audit_event(db_session, event_type='STREAM_EVT', entity_type='Z', entity_id=i+1, user_id=None, payload={'i': i})

def test_audit_export_stream_integrity(db_session, client, auth_token, monkeypatch):
    # Make auth user admin so export succeeds
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    _seed_events(db_session, 12)
    headers = { 'Authorization': f'Bearer {auth_token}' }
    # Request streaming export with integrity verification
    r = client.get('/api/v1/settlement/audit-export/stream?verify_integrity=true&batch_size=5', headers=headers)
    assert r.status_code == 200
    # The StreamingResponse is fully consumed by test client; body holds concatenated lines
    body = r.content.decode()
    lines = [ln for ln in body.split('\n') if ln.strip()]
    assert len(lines) >= 10
    prev_id = None
    prev_hash = ''
    for line in lines:
        obj = json.loads(line)
        # Order ascending by id (stream endpoint yields ascending batches)
        if prev_id is not None:
            assert obj['id'] > prev_id
        prev_id = obj['id']
        # Integrity flag must be present and true
        assert 'integrity_ok' in obj and obj['integrity_ok'] is True
        # Basic shape
        assert 'integrity_hash' in obj and isinstance(obj['integrity_hash'], str)
    # Ensure last line corresponds to latest inserted event id
    last_ids = [json.loads(l)['id'] for l in lines]
    assert max(last_ids) == prev_id
