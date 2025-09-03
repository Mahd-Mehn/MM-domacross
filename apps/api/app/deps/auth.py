from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.database import User
from app.services.jwt_service import verify_token

security = HTTPBearer(auto_error=False)


def get_current_address(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = credentials.credentials
    try:
        claims = verify_token(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")
    return str(sub).lower()


def get_current_user(
    db: Session = Depends(get_db),
    address: str = Depends(get_current_address),
) -> User:
    user = db.query(User).filter(User.wallet_address == address).first()
    if not user:
        user = User(wallet_address=address)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_address_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    token = credentials.credentials
    try:
        claims = verify_token(token)
    except Exception:
        return None
    sub = claims.get("sub")
    if not sub:
        return None
    return str(sub).lower()


def get_current_user_optional(
    db: Session = Depends(get_db),
    address: str | None = Depends(get_current_address_optional),
) -> User | None:
    if address is None:
        return None
    user = db.query(User).filter(User.wallet_address == address).first()
    if not user:
        user = User(wallet_address=address)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user
