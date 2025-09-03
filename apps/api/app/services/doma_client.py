import asyncio
import httpx
import logging
from typing import Any, Dict, Optional
from app.config import settings

logger = logging.getLogger(__name__)

class DomaClient:
    """Generic client for Doma APIs (marketplace, orderbook, etc.) with retry/backoff.

    This centralizes API key header injection and error logging.
    """
    def __init__(self, base_url: Optional[str], api_key: Optional[str]) -> None:
        self.base_url = base_url.rstrip('/') if base_url else None
        self.api_key = api_key
        self._client: Optional[httpx.AsyncClient] = None

    def _headers(self) -> Dict[str, str]:
        h = {"Accept": "application/json"}
        if self.api_key:
            h["Api-Key"] = self.api_key
        return h

    async def _get_client(self) -> httpx.AsyncClient:
        if not self._client:
            self._client = httpx.AsyncClient(timeout=30.0, headers=self._headers())
        return self._client

    async def close(self):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def get(self, path: str, params: Optional[Dict[str, Any]] = None, retries: int = 3) -> Dict[str, Any]:
        if not self.base_url:
            raise RuntimeError("DomaClient base_url not configured")
        client = await self._get_client()
        url = f"{self.base_url}{path}" if path.startswith('/') else f"{self.base_url}/{path}"
        backoff = 1.0
        last_exc: Exception | None = None
        for attempt in range(1, retries + 1):
            try:
                resp = await client.get(url, params=params)
                if resp.status_code >= 500:
                    raise httpx.HTTPStatusError("server error", request=resp.request, response=resp)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:  # broad: log and backoff
                last_exc = e
                logger.warning("[doma_client] GET %s attempt %s failed: %s", url, attempt, e)
                if attempt == retries:
                    break
                await asyncio.sleep(backoff)
                backoff *= 2
        raise last_exc if last_exc else RuntimeError("Unknown DomaClient error")

# Instantiate clients for future expansion (marketplace, orderbook). Env vars for those base URLs could be added.
marketplace_client = DomaClient(base_url=settings.doma_poll_base_url, api_key=settings.doma_poll_api_key)
