import redis.asyncio as redis
from app.config import settings

# Create a single global async Redis client
redis_client: redis.Redis = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)
