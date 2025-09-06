#!/usr/bin/env python3

"""
Seed script to populate the database with test data for development
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from sqlalchemy import inspect
from decimal import Decimal
from app.models.database import (
    Base,
    User,
    Competition,
    Participant,
    Domain,
    DomainETF,
    DomainETFPosition,
    DomainETFShare,
    DomainETFShareFlow,
    DomainETFNavHistory,
    DomainETFFeeEvent,
)

def seed_etfs(db: Session, users, competitions):
    """Idempotently seed demo ETFs, positions, shares & nav history.

    Safe to call multiple times (skips existing symbols & holders).
    Returns dict with created/loaded ETF objects.
    """
    now = datetime.utcnow()

    # Domains (ensure present)
    domain_names = [
        ("alpha.eth", "eth"),
        ("beta.eth", "eth"),
        ("gamma.eth", "eth"),
        ("delta.eth", "eth"),
        ("omega.eth", "eth"),
        ("navstar.eth", "eth"),
    ]
    existing = {d.name for d in db.query(Domain).filter(Domain.name.in_([n for n,_ in domain_names])).all()}
    for name, tld in domain_names:
        if name in existing:
            continue
        db.add(Domain(name=name, tld=tld, last_floor_price=Decimal("100"), last_estimated_value=Decimal("120")))
    db.flush()

    # Helper to get or create ETF
    def get_or_create_etf(symbol: str, **kwargs):
        etf = db.query(DomainETF).filter_by(symbol=symbol).first()
        if etf:
            return etf, False
        etf = DomainETF(symbol=symbol, **kwargs)
        db.add(etf)
        db.flush()
        return etf, True

    etf1, created1 = get_or_create_etf(
        "PDMF",
        owner_user_id=users[0].id,
        competition_id=competitions[0].id if competitions else None,
        name="Premier Domain Momentum Fund",
        description="Demo ETF tracking momentum-weighted basket of showcase domains",
        management_fee_bps=200,
        performance_fee_bps=1000,
        nav_last=Decimal("1.00"),
        nav_updated_at=now,
    )
    etf2, created2 = get_or_create_etf(
        "AIDM",
        owner_user_id=users[1].id if len(users) > 1 else users[0].id,
        competition_id=None,
        name="AI Narrative Domain Basket",
        description="Curated AI / narrative domains for demo",
        management_fee_bps=150,
        performance_fee_bps=500,
        nav_last=Decimal("1.00"),
        nav_updated_at=now,
    )

    # Positions only if freshly created (avoid duplicate unique constraint)
    if created1:
        for domain_name, w in [("alpha.eth",2500),("beta.eth",2000),("gamma.eth",2000),("delta.eth",1500),("omega.eth",2000)]:
            db.add(DomainETFPosition(etf_id=etf1.id, domain_name=domain_name, weight_bps=w))
    if created2:
        for domain_name, w in [("alpha.eth",1500),("beta.eth",1500),("gamma.eth",2000),("delta.eth",1500),("omega.eth",1500),("navstar.eth",2000)]:
            db.add(DomainETFPosition(etf_id=etf2.id, domain_name=domain_name, weight_bps=w))
    db.flush()

    # Issue helper (skip if share holder exists)
    def issue_if_absent(etf: DomainETF, user: User, shares: Decimal, nav_ps: Decimal):
        existing_share = db.query(DomainETFShare).filter_by(etf_id=etf.id, user_id=user.id).first()
        if existing_share:
            return False
        db.add(DomainETFShareFlow(
            etf_id=etf.id,
            user_id=user.id,
            flow_type="ISSUE",
            shares=shares,
            cash_value=shares * nav_ps,
            nav_per_share=nav_ps,
        ))
        db.add(DomainETFShare(etf_id=etf.id, user_id=user.id, shares=shares))
        etf.total_shares = (etf.total_shares or Decimal("0")) + shares
        return True

    issued = []
    issued.append(issue_if_absent(etf1, users[0], Decimal("100"), Decimal("1.00")))
    if len(users) > 1:
        issued.append(issue_if_absent(etf1, users[1], Decimal("50"), Decimal("1.00")))
        issued.append(issue_if_absent(etf2, users[1], Decimal("120"), Decimal("1.00")))
    if len(users) > 2:
        issued.append(issue_if_absent(etf2, users[2], Decimal("80"), Decimal("1.00")))

    # NAV history only if no history yet
    if not db.query(DomainETFNavHistory).filter_by(etf_id=etf1.id).first():
        for idx in range(5):
            ts = now + timedelta(minutes=idx * 5)
            nav1 = Decimal("1.00") + Decimal("0.01") * idx
            nav2 = Decimal("1.00") + Decimal("0.005") * idx
            db.add(DomainETFNavHistory(etf_id=etf1.id, snapshot_time=ts, nav_per_share=nav1))
            db.add(DomainETFNavHistory(etf_id=etf2.id, snapshot_time=ts, nav_per_share=nav2))
            if idx == 4:
                db.add(DomainETFFeeEvent(
                    etf_id=etf1.id,
                    event_type="MANAGEMENT_ACCRUAL",
                    amount=Decimal("0.25"),
                    nav_per_share_snapshot=nav1,
                    meta={"period_minutes": 20},
                ))

    return {"PDMF": etf1, "AIDM": etf2}


def seed_database():
    # Create tables only if migrations haven't been applied yet (no alembic_version table)
    inspector = inspect(engine)
    if 'alembic_version' not in inspector.get_table_names():
        Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        # Create test users
        users_data = [
            {"wallet_address": "0x742d35cc6634c0532925a3b844bc454e4438f44e", "username": "alice_trader"},
            {"wallet_address": "0x742d35cc6634c0532925a3b844bc454e4438f44f", "username": "bob_domains"},
            {"wallet_address": "0x742d35cc6634c0532925a3b844bc454e4438f450", "username": "charlie_spec"},
        ]

        users = []
        existing_users = {u.wallet_address: u for u in db.query(User).filter(User.wallet_address.in_([u['wallet_address'] for u in users_data])).all()}
        for user_data in users_data:
            if user_data['wallet_address'] in existing_users:
                users.append(existing_users[user_data['wallet_address']])
            else:
                user = User(**user_data)
                db.add(user)
                users.append(user)

        db.flush()  # Get IDs

    # Create test competitions
        now = datetime.utcnow()
        competitions_data = [
            {
                "contract_address": "0x1234567890123456789012345678901234567890",
                "chain_id": 1,
                "name": "Q3 Domain Championship 2025",
                "description": "Quarterly domain trading championship with $10K prize pool",
                "start_time": now - timedelta(hours=1),
                "end_time": now + timedelta(days=7),
                "entry_fee": "0.01",
                "rules": {"max_participants": 100, "min_portfolio": "0.1"}
            },
            {
                "contract_address": "0x1234567890123456789012345678901234567891",
                "chain_id": 1,
                "name": ".com Masters Tournament",
                "description": "Exclusive competition for premium .com domains",
                "start_time": now + timedelta(days=1),
                "end_time": now + timedelta(days=8),
                "entry_fee": "0.05",
                "rules": {"domain_tld": "com", "min_domain_value": "1000"}
            }
        ]

        competitions = []
        existing_contracts = [c['contract_address'] for c in competitions_data if c['contract_address']]
        if existing_contracts:
            existing_db = db.query(Competition).filter(Competition.contract_address.in_(existing_contracts)).all()
        else:
            existing_db = []
        existing_map = {c.contract_address: c for c in existing_db}
        for comp_data in competitions_data:
            addr = comp_data['contract_address']
            if addr in existing_map:
                competitions.append(existing_map[addr])
            else:
                competition = Competition(**comp_data)
                db.add(competition)
                competitions.append(competition)

        db.flush()

        # Create participants
        participants_data = [
            {"user_id": users[0].id, "competition_id": competitions[0].id, "portfolio_value": "2.5"},
            {"user_id": users[1].id, "competition_id": competitions[0].id, "portfolio_value": "1.8"},
            {"user_id": users[2].id, "competition_id": competitions[0].id, "portfolio_value": "3.2"},
            {"user_id": users[0].id, "competition_id": competitions[1].id, "portfolio_value": "0.0"},
        ]

        for part_data in participants_data:
            participant = Participant(**part_data)
            db.add(participant)

        # Seed ETFs & related data
        etfs = seed_etfs(db, users, competitions)

        db.commit()
        print("✅ Database seeded successfully (users, competitions, participants, domains, ETFs)!")

        # Print summary / counts
        print(f"Created {len(users)} users")
        print(f"Created {len(competitions)} competitions")
        print(f"Created {len(participants_data)} participants")
        print("Seeded ETFs:", ", ".join(etfs.keys()))

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
