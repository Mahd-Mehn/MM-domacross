from fastapi import APIRouter, HTTPException
from eth_account import Account
from eth_account.messages import encode_defunct

from app.schemas.auth import NonceRequest, NonceResponse, VerifyRequest, TokenResponse
from app.services import nonce_service, jwt_service

router = APIRouter()


@router.post("/nonce", response_model=NonceResponse)
async def get_nonce(payload: NonceRequest):
    address = payload.address
    if not address or not address.startswith("0x"):
        raise HTTPException(status_code=400, detail="Invalid address")
    nonce = await nonce_service.issue_nonce(address)
    return NonceResponse(address=address.lower(), nonce=nonce)


@router.post("/verify", response_model=TokenResponse)
async def verify_signature(payload: VerifyRequest):
    address = payload.address.lower()
    if not address or not address.startswith("0x"):
        raise HTTPException(status_code=400, detail="Invalid address")

    # Nonce must match and be consumed (single-use)
    if payload.nonce not in payload.message:
        raise HTTPException(status_code=400, detail="Nonce not present in message")
    ok = await nonce_service.consume_nonce(address, payload.nonce)
    if not ok:
        raise HTTPException(status_code=400, detail="Nonce invalid or expired")

    # Recover address from signature using personal_sign (EIP-191)
    try:
        msg = encode_defunct(text=payload.message)
        recovered = Account.recover_message(msg, signature=payload.signature)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if recovered.lower() != address:
        raise HTTPException(status_code=401, detail="Signature does not match address")

    token = jwt_service.issue_token(address)
    return TokenResponse(access_token=token)
