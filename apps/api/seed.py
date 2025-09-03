#!/usr/bin/env python3

"""
Seed script to populate the database with test data for development
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.database import Base, User, Competition, Participant

def seed_database():
    # Create tables
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
        for user_data in users_data:
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
        for comp_data in competitions_data:
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

        db.commit()
        print("✅ Database seeded successfully!")

        # Print summary
        print(f"Created {len(users)} users")
        print(f"Created {len(competitions)} competitions")
        print(f"Created {len(participants_data)} participants")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
