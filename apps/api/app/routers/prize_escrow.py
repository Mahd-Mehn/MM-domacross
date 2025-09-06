from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db  # type: ignore
from pydantic import BaseModel
from app.broadcast import get_sync_broadcast
from datetime import datetime, timezone

router = APIRouter(prefix="/prize", tags=["prize"])

_ESCROWS: dict[int, dict] = {}
_SEQ_ID = 0

class EscrowCreateRequest(BaseModel):
    competition_id: int
    contract_address: str | None = None
    start_time: int
    end_time: int

class EscrowFinalizeRequest(BaseModel):
    winner_wallet: str

@router.post("/create")
def create_escrow(body: EscrowCreateRequest):
    global _SEQ_ID
    _SEQ_ID += 1
    _ESCROWS[_SEQ_ID] = {
        'id': _SEQ_ID,
        'competition_id': body.competition_id,
        'contract_address': body.contract_address,
        'start_time': body.start_time,
        'end_time': body.end_time,
        'finalized': False,
        'winner_wallet': None
    }
    return _ESCROWS[_SEQ_ID]

@router.post("/{escrow_id}/finalize")
def finalize_escrow(escrow_id: int, body: EscrowFinalizeRequest):
    esc = _ESCROWS.get(escrow_id)
    if not esc:
        raise HTTPException(status_code=404, detail='escrow not found')
    if esc['finalized']:
        raise HTTPException(status_code=400, detail='already finalized')
    now = int(datetime.now(timezone.utc).timestamp())
    if now < esc['end_time']:
        raise HTTPException(status_code=400, detail='competition not ended')
    esc['finalized'] = True
    esc['winner_wallet'] = body.winner_wallet.lower()
    bc = get_sync_broadcast()
    if bc:
        bc({
            'type': 'winner_claim',
            'competition_id': esc['competition_id'],
            'winner_wallet': esc['winner_wallet'],
            'escrow_id': esc['id']
        })
    return {'status': 'finalized', 'escrow_id': esc['id'], 'winner_wallet': esc['winner_wallet']}

@router.get("/status")
def prize_status():
    return {'escrows': list(_ESCROWS.values())}
