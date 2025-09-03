import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from app.database import SessionLocal
from app.models.database import DomainETF as DomainETFModel, DomainETFPosition as DomainETFPositionModel, Domain as DomainModel, Valuation as ValuationModel

logger = logging.getLogger(__name__)

class NavService:
    def __init__(self):
        self.last_run: Optional[datetime] = None
        self.total_recomputes: int = 0

    def _compute_nav(self, session, etf: DomainETFModel) -> Decimal:
        positions = session.query(DomainETFPositionModel).filter(DomainETFPositionModel.etf_id == etf.id).all()
        total = Decimal(0)
        if not positions:
            return total
        for p in positions:
            val = (
                session.query(ValuationModel.value)
                .filter(ValuationModel.domain_name == p.domain_name)
                .order_by(ValuationModel.created_at.desc())
                .limit(1)
                .scalar()
            )
            if val is None:
                val = (
                    session.query(DomainModel.last_floor_price)
                    .filter(DomainModel.name == p.domain_name)
                    .scalar()
                ) or Decimal(0)
            weight_pct = Decimal(p.weight_bps) / Decimal(10000)
            total += (val or Decimal(0)) * weight_pct
        return total

    def run_once(self, stale_seconds: int = 600):
        session = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            etfs = session.query(DomainETFModel).all()
            for etf in etfs:
                if etf.nav_updated_at is None or (now - etf.nav_updated_at).total_seconds() > stale_seconds:
                    try:
                        nav = self._compute_nav(session, etf)
                        etf.nav_last = nav
                        etf.nav_updated_at = now
                        session.add(etf)
                        self.total_recomputes += 1
                    except Exception:
                        logger.exception("[nav] failed recompute etf_id=%s", etf.id)
            session.commit()
            self.last_run = now
        finally:
            try:
                session.close()
            except Exception:
                pass

nav_service = NavService()