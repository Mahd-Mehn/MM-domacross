from __future__ import annotations
"""Shared cost basis update helper to avoid duplicate logic between chain and poll ingestion.

Responsibilities:
 - Maintain ParticipantHolding quantity & avg_cost for BUY / SELL trades (lot size = 1 for now)
 - Prevent negative quantities
"""
from sqlalchemy.orm import Session
from decimal import Decimal
from app.models.database import ParticipantHolding

def apply_trade_cost_basis(db: Session, participant_id: int, domain_key: str, trade_type: str, price: Decimal):
    ph = db.query(ParticipantHolding).filter(ParticipantHolding.participant_id==participant_id, ParticipantHolding.domain_name==domain_key).first()
    if trade_type == 'BUY':
        if not ph:
            ph = ParticipantHolding(participant_id=participant_id, domain_name=domain_key, quantity=1, avg_cost=price)
        else:
            qty = (ph.quantity or 0) + 1
            prev_cost = ph.avg_cost or Decimal(0)
            ph.avg_cost = ((prev_cost * (qty-1)) + price) / qty if qty>0 else price
            ph.quantity = qty
        db.add(ph)
    elif trade_type == 'SELL':
        if ph:
            ph.quantity = (ph.quantity or 0) - 1
            if ph.quantity < 0:
                ph.quantity = 0
            db.add(ph)
    # defer flush/commit to caller
    return ph
