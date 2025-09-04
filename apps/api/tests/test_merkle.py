from decimal import Decimal
from datetime import datetime, timezone

def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_merkle_snapshot_and_proof(client, auth_token, db_session):
    headers = _auth_headers(auth_token)
    # Create ETF to generate audit events
    payload = {"name":"Merkle ETF","symbol":"MRK","description":"Test","competition_id":None,"positions":[["m1.eth",5000],["m2.eth",5000]]}
    r = client.post("/api/v1/etfs", json=payload, headers=headers)
    assert r.status_code == 200
    etf_id = r.json()["id"]
    # Trigger issue to create share flow + audit events
    r2 = client.post(f"/api/v1/etfs/{etf_id}/issue?shares=10", json={"shares":"10"}, headers=headers)
    assert r2.status_code == 200
    # Force merkle recompute via admin bypass: make user admin by setting wallet in settings for test env
    # Directly call recompute endpoint guarded by admin; assume test user wallet address is available via fixture
    # Instead: directly invoke snapshot service for deterministic test
    from app.services.merkle_service import merkle_service
    snap = merkle_service.snapshot_incremental(db_session)
    assert snap is not None
    # Pick an audit event id
    from app.models.database import AuditEvent
    ae = db_session.query(AuditEvent).order_by(AuditEvent.id.desc()).first()
    assert ae is not None
    proof = merkle_service.compute_proof_path(db_session, ae.id)
    assert 'merkle_root' in proof and 'path' in proof
    assert proof['event_id'] == ae.id
    # Basic structure checks
    assert isinstance(proof['path'], list)
    # Signature presence (optional) does not fail test but if present should be non-empty
    snap = merkle_service.latest(db_session)
    if snap and snap.signature:
        assert isinstance(snap.signature, str) and len(snap.signature) > 0
    # Export with cursor
    export1 = client.get('/api/v1/settlement/audit-events/export?limit=10', headers=headers)
    assert export1.status_code == 200
    data = export1.json()
    if data['next_cursor']:
        export2 = client.get(f"/api/v1/settlement/audit-events/export?cursor_after_id={data['next_cursor']}&limit=10", headers=headers)
        assert export2.status_code == 200
