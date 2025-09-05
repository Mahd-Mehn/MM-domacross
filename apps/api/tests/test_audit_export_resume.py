from app.services.audit_service import record_audit_event
import json

def _seed_events(db_session, n=5):
    for i in range(n):
        record_audit_event(db_session, event_type='TEST_EVT', entity_type='X', entity_id=i+1, user_id=None, payload={'i': i})

def test_audit_export_resume_cursor(db_session, client, auth_token, monkeypatch):
    # make user admin
    from app import config as cfg
    monkeypatch.setattr(cfg.settings, 'admin_wallets', ['0xabc1234567890000000000000000000000000001'])
    _seed_events(db_session, 7)
    headers = { 'Authorization': f'Bearer {auth_token}' }
    # initial fetch
    r1 = client.get('/api/v1/settlement/audit-export?limit=3', headers=headers)
    assert r1.status_code==200
    raw_lines1 = r1.text.strip().split('\n') if r1.text.strip() else []
    assert len(raw_lines1)==3
    lines1 = [json.loads(l) for l in raw_lines1]
    next_cursor = r1.headers.get('X-Next-Cursor')
    assert next_cursor
    # resume using cursor
    r2 = client.get(f'/api/v1/settlement/audit-export?after_id={next_cursor}&limit=3', headers=headers)
    assert r2.status_code==200
    raw_lines2 = r2.text.strip().split('\n') if r2.text.strip() else []
    assert len(raw_lines2) in (3,2)  # remaining chunk
    lines2 = [json.loads(l) for l in raw_lines2]
    # ensure no overlap
    first_ids = { l['id'] for l in lines1 }
    second_ids = { l['id'] for l in lines2 }
    assert not first_ids.intersection(second_ids)

