#!/usr/bin/env python3
"""
Clear test/dummy listings from the database
Run this to remove old test data and ensure only real fractional tokens are shown
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.database import SessionLocal
from app.models.database import DomainListing, DomainOffer
from sqlalchemy import or_

def clear_test_listings():
    """Clear all test listings from the database"""
    db = SessionLocal()
    try:
        # Delete listings with test/dummy data patterns
        deleted_listings = db.query(DomainListing).filter(
            or_(
                DomainListing.domain_name.like('domain_%'),
                DomainListing.domain_name.like('test_%'),
                DomainListing.token_id == '100',
                DomainListing.contract_address == '0x3456789012345678901234567890123456789012'
            )
        ).delete(synchronize_session=False)
        
        # Delete test offers
        deleted_offers = db.query(DomainOffer).filter(
            or_(
                DomainOffer.domain_name.like('domain_%'),
                DomainOffer.domain_name.like('test_%')
            )
        ).delete(synchronize_session=False)
        
        db.commit()
        
        print(f"✅ Cleared {deleted_listings} test listings")
        print(f"✅ Cleared {deleted_offers} test offers")
        print("✨ Database is now clean and ready for real fractional token data")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error clearing test data: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("🧹 Clearing test listings from database...")
    clear_test_listings()
