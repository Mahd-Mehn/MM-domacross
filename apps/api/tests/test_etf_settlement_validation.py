from decimal import Decimal

def test_redeem_with_valid_settlement_ids(client, auth_token, db_session):
    headers = {"Authorization": f"Bearer {auth_token}"}
    # Create ETF and issue
    payload = {"name":"Val ETF","symbol":"VALD","description":"Test","competition_id":None,"positions":[["vald1.eth",5000],["vald2.eth",5000]]}
    r = client.post("/api/v1/etfs", json=payload, headers=headers)
    assert r.status_code==200, r.text
    etf_id = r.json()["id"]
    r = client.post(f"/api/v1/etfs/{etf_id}/issue", json={"shares":"30"}, headers=headers)
    assert r.status_code==200, r.text
    # Insert dummy listings with external_order_id matching we will send
    from app.models.database import Listing, Domain
    # Ensure domains exist
    for d in ["vald1.eth","vald2.eth"]:
        if not db_session.query(Domain).filter(Domain.name==d).first():
            db_session.add(Domain(name=d))
            db_session.flush()
    db_session.add(Listing(domain_name="vald1.eth", seller_wallet="0xabc1234567890000000000000000000000000001", price=Decimal('1'), external_order_id="ordA"))
    db_session.add(Listing(domain_name="vald2.eth", seller_wallet="0xabc1234567890000000000000000000000000001", price=Decimal('1'), external_order_id="ordB"))
    db_session.commit()
    # Create intent
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/intent", json={"shares":"10"}, headers=headers)
    assert r.status_code==200, r.text
    intent_id = r.json()["id"]
    # Execute with valid settlement ids
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/execute/{intent_id}?tx_hash=0xabc123", json={"settlement_order_ids":["ordA","ordB"]}, headers=headers)
    assert r.status_code==200, r.text
    # Execute with invalid id should fail
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/intent", json={"shares":"5"}, headers=headers)
    assert r.status_code==200
    new_intent = r.json()["id"]
    r = client.post(f"/api/v1/etfs/{etf_id}/redeem/execute/{new_intent}?tx_hash=0xabc124", json={"settlement_order_ids":["unknownOrd"]}, headers=headers)
    assert r.status_code==400
