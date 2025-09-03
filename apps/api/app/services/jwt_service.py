from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from jose import jwt

from app.config import settings
from app.utils.crypto import load_keys_from_b64

ALGORITHM = "RS256"

_PRIV_PEM: str | None = None
_PUB_PEM: str | None = None


def _ensure_keys() -> None:
    global _PRIV_PEM, _PUB_PEM
    if _PRIV_PEM is None or _PUB_PEM is None:
        if not settings.jwt_private_key_b64 or not settings.jwt_public_key_b64:
            raise RuntimeError("JWT keys not configured. Set JWT_PRIVATE_KEY_BASE64 and JWT_PUBLIC_KEY_BASE64.")
        priv, pub = load_keys_from_b64(settings.jwt_private_key_b64, settings.jwt_public_key_b64)
        _PRIV_PEM, _PUB_PEM = priv, pub


def issue_token(subject_address: str, extra: Dict[str, Any] | None = None) -> str:
    _ensure_keys()
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=settings.jwt_ttl_seconds)
    payload: Dict[str, Any] = {
        "sub": subject_address.lower(),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        **(extra or {}),
    }
    token = jwt.encode(payload, _PRIV_PEM, algorithm=ALGORITHM)  # type: ignore[arg-type]
    return token


def verify_token(token: str) -> Dict[str, Any]:
    _ensure_keys()
    claims = jwt.decode(
        token,
        _PUB_PEM,  # type: ignore[arg-type]
        algorithms=[ALGORITHM],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
    )
    return claims
