#!/usr/bin/env python3
"""Seed database with sample domains for marketplace"""

import asyncio
import sys
from datetime import datetime, timedelta
import random
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.models.base import get_db
from sqlalchemy.orm import Session
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
        # Clear existing domains (optional)
        print("Clearing existing domains...")
        db.execute(text("DELETE FROM domain_offers"))
        db.execute(text("DELETE FROM domains"))
        db.commit()
        
        print(f"Seeding {len(SAMPLE_DOMAINS)} domains...")
        
        for domain_data in SAMPLE_DOMAINS:
            # Insert domain
            domain_insert = text("""
                INSERT INTO domains (name, tld, contract, token_id, owner, price, views, created_at, updated_at)
                VALUES (:name, :tld, :contract, :token_id, :owner, :price, :views, :created_at, :updated_at)
                RETURNING id
            """)
            
            result = db.execute(domain_insert, {
                "name": domain_data["name"],
                "tld": domain_data["tld"],
                "contract": domain_data["contract"],
                "token_id": domain_data["token_id"],
                "owner": domain_data["owner"],
                "price": domain_data["price"],
                "views": domain_data["views"],
                "created_at": datetime.utcnow() - timedelta(days=random.randint(1, 30)),
                "updated_at": datetime.utcnow() - timedelta(hours=random.randint(1, 48)),
            })
            
            domain_id = result.scalar()
            
            # Add some sample offers for each domain
            num_offers = random.randint(0, 5)
            for i in range(num_offers):
                if domain_data["price"]:
                    # Offer is 60-90% of listing price
                    offer_amount = int(float(domain_data["price"]) * random.uniform(0.6, 0.9))
                else:
                    # Random offer amount for unlisted domains
                    offer_amount = random.randint(1, 10) * 1000000000000000000
                
                offer_insert = text("""
                    INSERT INTO domain_offers (domain_id, offerer, amount, expires_at, status, message, created_at)
                    VALUES (:domain_id, :offerer, :amount, :expires_at, :status, :message, :created_at)
                """)
                
                # Random offerer addresses
                offerers = [
                    "0x1234567890123456789012345678901234567890",
                    "0x2345678901234567890123456789012345678901", 
                    "0x3456789012345678901234567890123456789012",
                    "0x4567890123456789012345678901234567890123",
                    "0x5678901234567890123456789012345678901234",
                ]
                
                expires_at = datetime.utcnow() + timedelta(hours=random.randint(1, 72))
                status = random.choice(['active', 'active', 'active', 'expired', 'accepted'])
                if status == 'expired':
                    expires_at = datetime.utcnow() - timedelta(hours=random.randint(1, 24))
                
                db.execute(offer_insert, {
                    "domain_id": domain_id,
                    "offerer": random.choice(offerers),
                    "amount": str(offer_amount),
                    "expires_at": expires_at,
                    "status": status,
                    "message": f"Interested in {domain_data['name']}.eth for my collection",
                    "created_at": datetime.utcnow() - timedelta(hours=random.randint(1, 168)),
                })
            
            print(f"✅ Added {domain_data['name']}.{domain_data['tld']} with {num_offers} offers")
        
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
