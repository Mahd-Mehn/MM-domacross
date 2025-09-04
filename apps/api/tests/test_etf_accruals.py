from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.services.nav_service import nav_service
# Imports inside tests to avoid static analysis import noise in certain environments.


def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_management_fee_accrual(client, auth_token, db_session):
    headers = _auth_headers(auth_token)
    payload = {
        "name": "Mgmt ETF",
        "symbol": "MGMT",
        "description": "Test",
        "competition_id": None,
        "positions": [["mgmt1.eth", 5000], ["mgmt2.eth", 5000]],
    }
    r = client.post("/api/v1/etfs?management_fee_bps=200", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    etf_id = r.json()["id"]
    # Set domain floor prices so NAV > 0
    from app.models import Domain as DomainModel, DomainETFFeeEvent as DomainETFFeeEventModel  # type: ignore
    domains = db_session.query(DomainModel).filter(DomainModel.name.in_(["mgmt1.eth", "mgmt2.eth"]))
    for d in domains:
        d.last_floor_price = Decimal(100)
    db_session.commit()
    # Load ETF ORM instance via session
    from app.models import DomainETF as DomainETFModel  # type: ignore
    etf = db_session.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    # Compute nav using same internal logic
    nav = nav_service._compute_nav(db_session, etf)  # type: ignore
    # Simulate 1 hour elapsed since last accrual
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    # Ensure all stored timestamps are timezone-aware
    past = past.replace(tzinfo=timezone.utc)
    etf.nav_last = nav
    etf.nav_updated_at = past
    etf.management_fee_last_accrued_at = past
    db_session.commit()
    now = datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
    nav_service._accrue_management_fee(db_session, etf, nav, now)  # type: ignore
    db_session.commit()
    # Assertions
    events = db_session.query(DomainETFFeeEventModel).filter(DomainETFFeeEventModel.etf_id == etf_id, DomainETFFeeEventModel.event_type == 'MANAGEMENT_ACCRUAL').all()
    assert len(events) == 1, f"Expected 1 management accrual event, found {len(events)}"
    fee_amount = Decimal(events[0].amount)
    assert fee_amount > 0
    # Expected theoretical fee: nav * (rate * elapsed / year)
    elapsed_seconds = 3600
    expected = (nav * Decimal(0.02) * Decimal(elapsed_seconds) / Decimal(31536000)).quantize(Decimal('0.00000001'))
    # Allow small deviation due to quantization
    assert abs(fee_amount - expected) <= Decimal('0.00000002')


def test_performance_fee_crystallization(client, auth_token, db_session):
    headers = _auth_headers(auth_token)
    payload = {
        "name": "Perf ETF",
        "symbol": "PERF",
        "description": "Test",
        "competition_id": None,
        "positions": [["perf1.eth", 5000], ["perf2.eth", 5000]],
    }
    r = client.post("/api/v1/etfs?performance_fee_bps=1000", json=payload, headers=headers)  # 10%
    assert r.status_code == 200, r.text
    etf_id = r.json()["id"]
    from app.models import DomainETF as DomainETFModel, Domain as DomainModel, DomainETFFeeEvent as DomainETFFeeEventModel  # type: ignore
    etf = db_session.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    # Base prices
    for name in ["perf1.eth", "perf2.eth"]:
        d = db_session.query(DomainModel).filter(DomainModel.name == name).first()
        d.last_floor_price = Decimal(100)
    db_session.commit()
    base_nav = nav_service._compute_nav(db_session, etf)  # type: ignore
    now = datetime.now(timezone.utc)
    nav_service._crystallize_performance_fee(db_session, etf, base_nav, now)  # sets high-water, no event
    db_session.commit()
    # Increase one domain value -> NAV gain
    d1 = db_session.query(DomainModel).filter(DomainModel.name == "perf1.eth").first()
    d1.last_floor_price = Decimal(150)  # 50% increase on half weight -> +25% NAV
    db_session.commit()
    new_nav = nav_service._compute_nav(db_session, etf)  # type: ignore
    nav_service._crystallize_performance_fee(db_session, etf, new_nav, now + timedelta(minutes=5))  # type: ignore
    db_session.commit()
    events = db_session.query(DomainETFFeeEventModel).filter(DomainETFFeeEventModel.etf_id == etf_id, DomainETFFeeEventModel.event_type == 'PERFORMANCE_ACCRUAL').all()
    assert len(events) == 1, "Performance fee event not created"
    fee_amount = Decimal(events[0].amount)
    gain = new_nav - base_nav
    expected_fee = (gain * Decimal('0.10')).quantize(Decimal('0.00000001'))
    assert fee_amount == expected_fee


def test_nav_apy_estimation(db_session, client, auth_token):
    headers = _auth_headers(auth_token)
    payload = {
        "name": "APY ETF",
        "symbol": "APY1",
        "description": "Test",
        "competition_id": None,
        "positions": [["apy1.eth", 5000], ["apy2.eth", 5000]],
    }
    r = client.post("/api/v1/etfs", json=payload, headers=headers)
    assert r.status_code == 200, r.text
    etf_id = r.json()["id"]
    from app.models import DomainETF as DomainETFModel, DomainETFNavHistory  # type: ignore
    etf = db_session.query(DomainETFModel).filter(DomainETFModel.id == etf_id).first()
    # Insert two nav history points 30 days apart (nav per share 1.0 -> 1.1)
    start_time = datetime.now(timezone.utc) - timedelta(days=30)
    db_session.add(DomainETFNavHistory(etf_id=etf.id, snapshot_time=start_time, nav_per_share=Decimal('1.0')))
    db_session.add(DomainETFNavHistory(etf_id=etf.id, snapshot_time=start_time + timedelta(days=30), nav_per_share=Decimal('1.1')))
    db_session.commit()
    apy = nav_service.estimate_apy(db_session, etf.id, lookback_days=60)
    assert apy is not None
    # Expected APY from 10% return over 30 days annualized
    total_return = Decimal('0.1')
    expected = ((Decimal(1) + total_return) ** (Decimal(365) / Decimal(30)) - Decimal(1)).quantize(Decimal('0.00000001'))
    # Allow minimal difference due to exponentiation rounding
    assert abs(apy - expected) <= Decimal('0.00000005')