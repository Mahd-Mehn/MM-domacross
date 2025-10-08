import asyncio
import logging
import os
import sys
import json

# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

import httpx
from app.config import settings

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def test_graphql_queries():
    """Test various GraphQL queries to find the correct schema"""
    
    if not settings.doma_subgraph_url:
        logger.error("DOMA_SUBGRAPH_URL not configured in settings")
        return
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    if settings.doma_api_key:
        headers["Api-Key"] = settings.doma_api_key
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test 1: Introspection query to get schema
        logger.info("=" * 60)
        logger.info("Test 1: Schema Introspection")
        logger.info("=" * 60)
        
        introspection_query = """
        query IntrospectionQuery {
          __schema {
            types {
              name
              kind
              fields {
                name
                type {
                  name
                  kind
                }
              }
            }
          }
        }
        """
        
        try:
            resp = await client.post(
                settings.doma_subgraph_url,
                json={"query": introspection_query},
                headers=headers
            )
            logger.info(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                # Find fractionalTokens type
                for type_info in data.get("data", {}).get("__schema", {}).get("types", []):
                    if "fractional" in type_info.get("name", "").lower():
                        logger.info(f"\nFound type: {type_info['name']}")
                        logger.info(f"Fields: {json.dumps(type_info.get('fields', []), indent=2)}")
            else:
                logger.error(f"Response: {resp.text}")
        except Exception as e:
            logger.error(f"Introspection failed: {e}")
        
        # Test 2: Minimal query
        logger.info("\n" + "=" * 60)
        logger.info("Test 2: Minimal Query")
        logger.info("=" * 60)
        
        minimal_query = """
        query {
          fractionalTokens {
            name
          }
        }
        """
        
        try:
            resp = await client.post(
                settings.doma_subgraph_url,
                json={"query": minimal_query},
                headers=headers
            )
            logger.info(f"Status: {resp.status_code}")
            logger.info(f"Response: {resp.text[:500]}")
        except Exception as e:
            logger.error(f"Minimal query failed: {e}")
        
        # Test 3: Query without nested objects
        logger.info("\n" + "=" * 60)
        logger.info("Test 3: Flat Query (no nested objects)")
        logger.info("=" * 60)
        
        flat_query = """
        query {
          fractionalTokens {
            name
            address
            fractionalizedAt
            currentPrice
          }
        }
        """
        
        try:
            resp = await client.post(
                settings.doma_subgraph_url,
                json={"query": flat_query},
                headers=headers
            )
            logger.info(f"Status: {resp.status_code}")
            logger.info(f"Response: {resp.text[:500]}")
        except Exception as e:
            logger.error(f"Flat query failed: {e}")
        
        # Test 4: Alternative field names
        logger.info("\n" + "=" * 60)
        logger.info("Test 4: Testing alternative nested field names")
        logger.info("=" * 60)
        
        alternative_queries = [
            ("tokenParams", """
            query {
              fractionalTokens {
                name
                tokenParams {
                  totalSupply
                }
              }
            }
            """),
            ("token", """
            query {
              fractionalTokens {
                name
                token {
                  totalSupply
                }
              }
            }
            """),
            ("details", """
            query {
              fractionalTokens {
                name
                details {
                  totalSupply
                }
              }
            }
            """),
        ]
        
        for field_name, query in alternative_queries:
            logger.info(f"\nTrying field: {field_name}")
            try:
                resp = await client.post(
                    settings.doma_subgraph_url,
                    json={"query": query},
                    headers=headers
                )
                logger.info(f"Status: {resp.status_code}")
                if resp.status_code == 200:
                    logger.info(f"SUCCESS! Field '{field_name}' works!")
                    logger.info(f"Response: {resp.text[:500]}")
                else:
                    logger.info(f"Failed: {resp.text[:200]}")
            except Exception as e:
                logger.error(f"Query with '{field_name}' failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_graphql_queries())
