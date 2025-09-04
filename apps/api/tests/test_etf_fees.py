from decimal import Decimal
from datetime import datetime, timezone, timedelta

def test_issue_redeem_fee_events(client, auth_token, db_session):
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {"name":"Fee ETF","symbol":"FEES","description":"Test","competition_id":None,"positions":[["fee1.eth",5000],["fee2.eth",5000]]}
    r = client.post("/api/v1/etfs?creation_unit_size=10&creation_fee_bps=50&redemption_fee_bps=25", json=payload, headers=headers)
    assert r.status_code==200, r.text
    etf_id = r.json()["id"]
    # Issue
    r = client.post(f"/api/v1/etfs/{etf_id}/issue", json={"shares":"20"}, headers=headers)
    assert r.status_code==200, r.text
    # Redeem part
    r2 = client.post(f"/api/v1/etfs/{etf_id}/redeem", json={"shares":"10"}, headers=headers)
    assert r2.status_code==200, r2.text
    # Fee events
    fe = client.get(f"/api/v1/etfs/{etf_id}/fee-events", headers=headers)
    assert fe.status_code==200
    events = fe.json()
    assert any(e["event_type"]=="ISSUE_FEE" for e in events)
    assert any(e["event_type"]=="REDEMPTION_FEE" for e in events)

def test_fee_distribution(client, auth_token, db_session):
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {"name":"Dist ETF","symbol":"DIST","description":"Test","competition_id":None,"positions":[["dist1.eth",5000],["dist2.eth",5000]]}
    r = client.post("/api/v1/etfs?creation_fee_bps=100", json=payload, headers=headers)
    assert r.status_code==200, r.text
    etf_id = r.json()["id"]
    # Issue to build fees
    r = client.post(f"/api/v1/etfs/{etf_id}/issue", json={"shares":"10"}, headers=headers)
    assert r.status_code==200
    # Distribute
    d = client.post(f"/api/v1/etfs/{etf_id}/fees/distribute", headers=headers)
    assert d.status_code==200, d.text
    body = d.json()
    assert Decimal(body['distributed']) >= Decimal('0')
    # Revenue shares
    rs = client.get(f"/api/v1/etfs/{etf_id}/revenue-shares", headers=headers)
    assert rs.status_code==200
    revs = rs.json()
    if Decimal(body['distributed'])>0:
        assert len(revs) >= 1
