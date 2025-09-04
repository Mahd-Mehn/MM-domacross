from decimal import Decimal
from app.services.jwt_service import issue_token

def test_etf_holdings_and_flows(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Create ETF
    payload = {
        "name": "Flow ETF",
        "symbol": "FLOW",
        "description": "Test",
        "competition_id": None,
        "positions": [["flowa.eth", 6000], ["flowb.eth", 4000]]
    }
    r = client.post("/api/v1/etfs", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    etf_id = r.json()["id"]

    # Initial holdings should be zero
    r = client.get(f"/api/v1/etfs/{etf_id}/my/shares", headers=headers)
    assert r.status_code == 200
    assert r.json()["shares"] == '0'

    # Issue 50 shares
    r = client.post(f"/api/v1/etfs/{etf_id}/issue", json={"shares": "50"}, headers=headers)
    assert r.status_code == 200, r.text

    # Holdings updated
    r = client.get(f"/api/v1/etfs/{etf_id}/my/shares", headers=headers)
    assert r.status_code == 200
    assert r.json()["shares"].startswith('50')

    # Create redemption intent for 20 shares (nav likely zero allowed)
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/intent", json={"shares": "20"}, headers=headers)
    assert r.status_code == 200, r.text
    intent_id = r.json()["id"]

    # Execute redemption (no settlement ids provided since validation now checks existence)
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/execute/{intent_id}?tx_hash=0xdeadbeef", json={}, headers=headers)
    assert r.status_code == 200, r.text

    # Flows list contains ISSUE and REDEEM with settlement ids on redeem
    r = client.get(f"/api/v1/etfs/{etf_id}/flows", headers=headers)
    assert r.status_code == 200
    flows = r.json()
    issue = [f for f in flows if f["flow_type"]=="ISSUE"]
    redeem = [f for f in flows if f["flow_type"]=="REDEEM"]
    assert issue and redeem
    # settlement_order_ids optional; none provided in this test
    assert redeem[0].get("settlement_order_ids") is None
