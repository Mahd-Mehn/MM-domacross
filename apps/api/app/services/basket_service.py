from __future__ import annotations
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import Dict
from app.models.database import Domain, Valuation

class BasketValuationService:
    """Derive basket values from constituent domain last valuations (simple sum for hackathon)."""
    def compute_value(self, db: Session, domain_contracts: list[str], token_ids: list[int], weights: list[int]) -> Decimal:
        # Placeholder: treat each underlying (domain name) by mapping token id->domain if present in Domain table
        # Real implementation would resolve mapping via a registry.
        total = Decimal(0)
        for i, tid in enumerate(token_ids):
            # naive key join by fabricated name pattern
            name_guess = f"domain-{tid}.eth"
            dom = db.query(Domain).filter(Domain.name==name_guess).first()
            if dom and dom.last_estimated_value is not None:
                w = Decimal(weights[i]) / Decimal(10000)
                total += Decimal(dom.last_estimated_value) * w
        return total.quantize(Decimal('0.01'))

basket_valuation_service = BasketValuationService()

__all__ = ["basket_valuation_service"]