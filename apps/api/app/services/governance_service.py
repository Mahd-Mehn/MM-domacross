from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.database import GovernanceConfig

class GovernanceService:
    def get_risk_param(self, db: Session, key: str, default: float | int) -> float:
        row = db.query(GovernanceConfig).filter(GovernanceConfig.key==key).first()
        if not row or not row.value:
            return float(default)
        val = row.value.get('value') if isinstance(row.value, dict) else None
        try:
            return float(val)
        except Exception:
            return float(default)

governance_service = GovernanceService()

__all__ = ["governance_service"]