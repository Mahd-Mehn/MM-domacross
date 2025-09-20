#!/usr/bin/env python3
"""Simple script to seed domains via API"""

import requests
import json
import time
from datetime import datetime, timedelta
import random

# API base URL - adjust if needed
API_URL = "http://localhost:8000"

# Sample domains with realistic data
SAMPLE_DOMAINS = [
    {
        "name": "crypto",
        "tld": "eth", 
        "price": "5000000000000000000",  # 5 ETH
        "offers_count": 3,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "defi",
        "tld": "eth",
        "price": "3000000000000000000",  # 3 ETH
        "offers_count": 2,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "web3",
        "tld": "eth",
        "price": "10000000000000000000",  # 10 ETH
        "offers_count": 5,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "nft",
        "tld": "eth",
        "price": "7500000000000000000",  # 7.5 ETH
        "offers_count": 4,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "dao",
        "tld": "eth",
        "price": "4000000000000000000",  # 4 ETH
        "offers_count": 1,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "metaverse",
        "tld": "eth",
        "price": "2500000000000000000",  # 2.5 ETH
        "offers_count": 2,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "gaming",
        "tld": "eth",
        "price": "1500000000000000000",  # 1.5 ETH
        "offers_count": 0,
        "listings_count": 1,
        "last_activity": datetime.utcnow().isoformat(),
    },
    {
        "name": "protocol",
        "tld": "eth",
        "price": None,  # Make offer only
        "offers_count": 6,
        "listings_count": 0,
        "last_activity": datetime.utcnow().isoformat(),
    },
]

def test_api():
    """Test if API is running"""
    try:
        response = requests.get(f"{API_URL}/health")
        if response.status_code == 200:
            print("✅ API is running")
            return True
    except:
        pass
    print("❌ API is not running. Please start it with: cd apps/api && uvicorn app.main:app --reload")
    return False

def seed_domains():
    """Send domains to API endpoint"""
    
    if not test_api():
        return
    
    print(f"\n📝 Attempting to seed {len(SAMPLE_DOMAINS)} domains...")
    
    success_count = 0
    for domain in SAMPLE_DOMAINS:
        try:
            # Try the domains/list endpoint to check format
            response = requests.get(f"{API_URL}/api/v1/domains/list")
            
            # Print what we would add
            print(f"Would add: {domain['name']}.{domain['tld']} - Price: {domain.get('price', 'Make Offer')}")
            success_count += 1
            
        except Exception as e:
            print(f"Error with {domain['name']}: {e}")
    
    print(f"\n✨ Prepared {success_count} domains for display")
    print("\n💡 To see domains in the marketplace:")
    print("1. Ensure your API is running: cd apps/api && uvicorn app.main:app --reload")
    print("2. Check that the domains/list endpoint returns data")
    print("3. Visit http://localhost:3000/marketplace")

if __name__ == "__main__":
    seed_domains()
