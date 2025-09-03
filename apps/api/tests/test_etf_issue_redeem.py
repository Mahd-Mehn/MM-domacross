from decimal import Decimal
from app.services.jwt_service import issue_token
from app.config import settings


def test_etf_issue_redeem_intent_execute(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Create ETF
    payload = {
        "name": "Test ETF",
        "symbol": "TETF",
        "description": "Test basket",
        "competition_id": None,
        "positions": [["alpha.eth", 5000], ["beta.eth", 5000]]
    }
    r = client.post("/api/v1/etfs?creation_unit_size=10", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    etf_id = r.json()["id"]

    # Issue shares (20, multiple of creation unit 10)
    r = client.post(f"/api/v1/etfs/{etf_id}/issue", json={"shares": "20"}, headers=headers)
    assert r.status_code == 200, r.text

    # Force recompute NAV (will be zero with no valuations, but allowed)
    r = client.post(f"/api/v1/etfs/{etf_id}/nav/recompute", headers=headers)
    assert r.status_code == 200

    # Create redemption intent for 10 shares
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/intent", json={"shares": "10"}, headers=headers)
    assert r.status_code == 200, r.text
    intent_id = r.json()["id"]

    # Execute redemption intent
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/execute/{intent_id}", headers=headers)
    assert r.status_code == 200, r.text

    # Check remaining holdings by issuing a flow listing
    r = client.get(f"/api/v1/etfs/{etf_id}/flows", headers=headers)
    assert r.status_code == 200
    flows = r.json()
    assert any(f["flow_type"] == "ISSUE" for f in flows)
    assert any(f["flow_type"] == "REDEEM" for f in flows)
