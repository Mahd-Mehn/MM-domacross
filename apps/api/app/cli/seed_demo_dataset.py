#!/usr/bin/env python3
"""Full demo dataset seeding script (Phase 9 completion).

Creates deterministic sample data powering the richer replay / demo mode:
  * Users & single active competition
  * Ten .eth domains with synthetic floor prices
  * Active listings & offers (some later cancelled / filled in manifest)
  * Multiple valuation snapshots (drift per round)
  * A sample ETF with positions & share flows (ISSUE / REDEEM)

Idempotent (re-runs skip existing rows; does not purge).

Run:
  cd apps/api
  python -m app.cli.seed_demo_dataset
"""
from __future__ import annotations
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.database import (
    Base, User, Competition, Participant, Domain, Listing, Offer,
    DomainETF, DomainETFPosition, DomainETFShareFlow
)
from app.services.valuation_service import valuation_service

RANDOM_SEED = 42
DOMAINS = [
    "alpha.eth","beta.eth","gamma.eth","delta.eth","omega.eth",
    "fusion.eth","vector.eth","oracle.eth","zen.eth","nova.eth"
]

def ensure_users(db: Session) -> list[User]:
    existing = {u.wallet_address: u for u in db.query(User).all()}
    spec = [
        ("0x1111111111111111111111111111111111111111", "alice"),
        ("0x2222222222222222222222222222222222222222", "bob"),
        ("0x3333333333333333333333333333333333333333", "carol"),
        ("0x4444444444444444444444444444444444444444", "dave")
    ]
    out: list[User] = []
    for addr, name in spec:
        if addr in existing:
            out.append(existing[addr]); continue
        u = User(wallet_address=addr, username=name)
        db.add(u); out.append(u)
    db.flush(); return out

def ensure_competition(db: Session) -> Competition:
    comp = db.query(Competition).filter(Competition.name=="Demo Championship").first()
    now = datetime.now(timezone.utc)
    if comp:
        return comp
    comp = Competition(
        contract_address="0xDEMO000000000000000000000000000000000001",
        chain_id=1,
        name="Demo Championship",
        description="Deterministic seeded competition for replay demo",
        start_time= now - timedelta(hours=2),
        end_time= now + timedelta(days=5),
        entry_fee=Decimal("0.01"),
        rules={"max_participants":50}
    )
    db.add(comp); db.flush(); return comp

def ensure_participants(db: Session, comp: Competition, users: list[User]):
    existing_pairs = {(p.user_id, p.competition_id) for p in db.query(Participant).filter(Participant.competition_id==comp.id).all()}
    for u in users:
        if (u.id, comp.id) in existing_pairs: continue
        db.add(Participant(user_id=u.id, competition_id=comp.id, portfolio_value=Decimal("0")))
    db.flush()

def seed_domains(db: Session):
    existing = {d.name for d in db.query(Domain).filter(Domain.name.in_(DOMAINS)).all()}
    now = datetime.now(timezone.utc)
    for i,name in enumerate(DOMAINS):
        if name in existing: continue
        db.add(Domain(name=name, tld='eth', last_floor_price=Decimal(str(0.08 + i*0.005)), first_seen_at=now - timedelta(minutes=30+i)))
    db.flush()

def seed_listings_offers(db: Session):
    for idx, name in enumerate(DOMAINS[:6]):
        listing = db.query(Listing).filter(Listing.domain_name==name, Listing.active==True).first()  # noqa: E712
        if not listing:
            db.add(Listing(domain_name=name, seller_wallet="0x1111111111111111111111111111111111111111", price=Decimal(str(0.10 + idx*0.01))))
        offer = db.query(Offer).filter(Offer.domain_name==name, Offer.active==True).first()  # noqa: E712
        if not offer:
            db.add(Offer(domain_name=name, buyer_wallet="0x2222222222222222222222222222222222222222", price=Decimal(str(0.09 + idx*0.008))))
    db.flush()

def seed_valuations(db: Session):
    random.seed(RANDOM_SEED)
    for _round in range(3):
        context = {'tld_counts': {'eth': len(DOMAINS)}, 'floors': {}}
        for d in db.query(Domain).filter(Domain.name.in_(DOMAINS)).all():
            if d.last_floor_price:
                d.last_floor_price = Decimal(str(float(d.last_floor_price) * (1 + (random.random()-0.5)*0.02)))
        valuation_service.value_domains(db, DOMAINS, context)  # commits inside

def seed_etf(db: Session):
    etf = db.query(DomainETF).filter(DomainETF.symbol=="DEMO").first()
    if etf:
        return etf
    owner = db.query(User).first()
    etf = DomainETF(owner_user_id=owner.id if owner else 1, name="Demo Domain Basket", symbol="DEMO", description="Synthetic diversified basket", total_shares=Decimal("1000"), nav_last=Decimal("1.00"))
    db.add(etf); db.flush()
    weight = 10000 // 5
    for name in DOMAINS[:5]:
        db.add(DomainETFPosition(etf_id=etf.id, domain_name=name, weight_bps=weight))
    db.add(DomainETFShareFlow(etf_id=etf.id, user_id=etf.owner_user_id, flow_type='ISSUE', shares=Decimal('500'), cash_value=Decimal('500'), nav_per_share=Decimal('1.00')))
    db.add(DomainETFShareFlow(etf_id=etf.id, user_id=etf.owner_user_id, flow_type='REDEEM', shares=Decimal('120'), cash_value=Decimal('130'), nav_per_share=Decimal('1.05')))
    db.commit(); return etf

def main():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        users = ensure_users(db)
        comp = ensure_competition(db)
        ensure_participants(db, comp, users)
        seed_domains(db)
        seed_listings_offers(db)
        seed_valuations(db)
        etf = seed_etf(db)
        print("✅ Demo dataset seeded")
        print(f"Users={len(users)} Domains={db.query(Domain).count()} Listings={db.query(Listing).count()} Offers={db.query(Offer).count()} ETF={etf.symbol}")
    except Exception as e:
        db.rollback(); print("❌ Error seeding demo dataset:", e)
    finally:
        db.close()

if __name__ == '__main__':
    main()
