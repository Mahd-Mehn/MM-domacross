#!/usr/bin/env python3
"""Seed database with sample domains for marketplace"""

import sys
import os
from datetime import datetime, timedelta, timezone
import random
from decimal import Decimal
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import get_db
from sqlalchemy import text

# Sample domains with realistic data
SAMPLE_DOMAINS = [
    {
        "name": "crypto",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "123456789",
        "price": "5000000000000000000",  # 5 ETH
        "owner": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        "views": 342,
    },
    {
        "name": "defi",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "223456789",
        "price": "3000000000000000000",  # 3 ETH
        "owner": "0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed",
        "views": 256,
    },
    {
        "name": "web3",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "323456789",
        "price": "10000000000000000000",  # 10 ETH
        "owner": "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359",
        "views": 567,
    },
    {
        "name": "nft",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "423456789",
        "price": "7500000000000000000",  # 7.5 ETH
        "owner": "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB",
        "views": 423,
    },
    {
        "name": "dao",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "523456789",
        "price": "4000000000000000000",  # 4 ETH
        "owner": "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb",
        "views": 189,
    },
    {
        "name": "metaverse",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "623456789",
        "price": "2500000000000000000",  # 2.5 ETH
        "owner": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        "views": 298,
    },
    {
        "name": "gaming",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "723456789",
        "price": "1500000000000000000",  # 1.5 ETH
        "owner": "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
        "views": 145,
    },
    {
        "name": "protocol",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "823456789",
        "price": None,  # Make offer only
        "owner": "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c",
        "views": 512,
    },
    {
        "name": "exchange",
        "tld": "eth", 
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "923456789",
        "price": "8000000000000000000",  # 8 ETH
        "owner": "0x14723A09ACff6D2A60DcdF7aA4AFf308FDDC160C",
        "views": 678,
    },
    {
        "name": "wallet",
        "tld": "eth",
        "contract": "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85",
        "token_id": "1023456789",
        "price": "6000000000000000000",  # 6 ETH
        "owner": "0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB",
        "views": 389,
    },
]

def seed_domains():
    """Seed the database with sample domains"""
    db = next(get_db())
    
    try:
        
        print(f"Seeding {len(SAMPLE_DOMAINS)} domains...")
        
        for domain_data in SAMPLE_DOMAINS:
            # Insert domain (matching actual schema)
            domain_insert = text("""
                INSERT INTO domains (name, tld, first_seen_at, last_estimated_value)
                VALUES (:name, :tld, :first_seen_at, :last_estimated_value)
                RETURNING id
            """)
            
            # Convert wei to ETH for database storage (precision 18,8 = max 10^10)
            price_in_eth = float(domain_data["price"]) / 1e18 if domain_data["price"] else None
            
            result = db.execute(domain_insert, {
                "name": domain_data["name"],
                "tld": domain_data["tld"],
                "first_seen_at": datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30)),
                "last_estimated_value": price_in_eth,
            })
            
            domain_id = result.scalar()
            
            print(f"  ✓ Created domain: {domain_data['name']}.{domain_data['tld']} (ID: {domain_id})")
        
        db.commit()
        print("\n✨ Successfully seeded all domains!")
        
    except Exception as e:
        print(f"❌ Error seeding domains: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_domains()
